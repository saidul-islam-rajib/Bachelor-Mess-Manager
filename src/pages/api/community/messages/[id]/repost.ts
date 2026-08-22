import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, forbidden, methodNotAllowed, notFound, unauthorized } from '@/lib/http';
import { toLetConfig } from '@/config';
import { COMMUNITY_MESSAGE_TYPES } from '@/lib/constants';
import { findMessage, repostListing } from '@/lib/community';
import { geocode } from '@/lib/geo';
import { strings } from '@/lib/i18n';
import { firstValue } from '@/lib/query';
import { parseToLetFields } from '@/lib/tolet-validation';
import { saveImage } from '@/lib/uploads';
import { findXssField } from '@/lib/xss';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const id = firstValue(req.query.id);
  if (!id) return badRequest(res, strings.community.idRequired);

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) return unauthorized(res, strings.toLet.signedOut);

  const existing = await findMessage(id);
  if (!existing || existing.type !== COMMUNITY_MESSAGE_TYPES.TOLET) {
    return notFound(res, strings.toLet.notFound);
  }

  const canManage = existing.authorId === sessionUser.id || requireAdmin(sessionUser);
  if (!canManage) return forbidden(res, strings.toLet.forbidden);

  const body = req.body as Record<string, unknown>;
  const imageInputs = Array.isArray(body.images) ? body.images.filter((item): item is string => typeof item === 'string') : [];
  if (imageInputs.length > toLetConfig.maxImagesPerListing) {
    return badRequest(res, strings.toLet.tooManyPhotos(toLetConfig.maxImagesPerListing));
  }

  const toLetCheck = parseToLetFields(body);
  if (!toLetCheck.ok) return badRequest(res, toLetCheck.error);

  if (findXssField({ title: toLetCheck.title, text: toLetCheck.text, location: toLetCheck.value.location })) {
    return badRequest(res, strings.errors.suspiciousInput);
  }

  if (toLetCheck.value.latitude === null || toLetCheck.value.longitude === null) {
    const point = await geocode(toLetCheck.value.location);
    if (point) {
      toLetCheck.value.latitude = point.lat;
      toLetCheck.value.longitude = point.lng;
    }
  }

  const savedImages: string[] = [];
  for (const dataUrl of imageInputs) {
    if (dataUrl.startsWith('data:')) {
      const saved = await saveImage(dataUrl, sessionUser.id);
      if (!saved.ok) return badRequest(res, saved.error);
      savedImages.push(saved.url);
    } else {
      savedImages.push(dataUrl);
    }
  }

  const message = await repostListing(
    id,
    {
      authorId: sessionUser.id,
      title: toLetCheck.title,
      text: toLetCheck.text,
      images: savedImages,
      toLet: toLetCheck.value
    },
    sessionUser.id
  );

  return created(res, { message });
}

export default withAudit(handler, { maxRequestBodyBytes: toLetConfig.postMaxRequestBodyBytes });
