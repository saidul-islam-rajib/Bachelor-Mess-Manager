import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { communityConfig, toLetConfig } from '@/config';
import {
  directory,
  ensureWelcomeMessage,
  notifyMentions,
  postMessage,
  readFeed,
  unreadCount,
  type PostMessageToLetInput
} from '@/lib/community';
import { strings } from '@/lib/i18n';
import { TOLET_GENDER_PREFERENCE, TOLET_GENDER_PREFERENCE_VALUES, TOLET_TYPE_VALUES } from '@/lib/constants';
import { queryInt, queryString } from '@/lib/query';
import { validateAmount, validatePhone } from '@/lib/validation';
import { saveImage } from '@/lib/uploads';
import { findXssField } from '@/lib/xss';
import { withAudit } from '@/lib/with-audit';

export const config = {
  api: {
    bodyParser: { sizeLimit: '54mb' }
  }
};

function parseToLetInput(
  body: Record<string, unknown>
): { ok: true; value: PostMessageToLetInput } | { ok: false; error: string } {
  const { listingType, rent, rentNegotiable, location, genderPreference, contactName, contactPhone, expiryDays } = body;

  if (typeof listingType !== 'string' || !TOLET_TYPE_VALUES.includes(listingType)) {
    return { ok: false, error: strings.toLet.typeInvalid };
  }

  let genderPref: string = TOLET_GENDER_PREFERENCE.ANY;
  if (genderPreference !== undefined && genderPreference !== null && genderPreference !== '') {
    if (typeof genderPreference !== 'string' || !TOLET_GENDER_PREFERENCE_VALUES.includes(genderPreference)) {
      return { ok: false, error: strings.toLet.genderPreferenceInvalid };
    }
    genderPref = genderPreference;
  }

  const locationValue = typeof location === 'string' ? location.trim() : '';
  if (!locationValue) return { ok: false, error: strings.toLet.locationRequired };
  if (locationValue.length > toLetConfig.maxLocationLength) {
    return { ok: false, error: strings.toLet.locationTooLong(toLetConfig.maxLocationLength) };
  }

  const rentCheck = validateAmount(rent);
  if (!rentCheck.ok) return { ok: false, error: rentCheck.error };

  const phoneCheck = validatePhone(contactPhone);
  if (!phoneCheck.ok) return { ok: false, error: phoneCheck.error };

  const expiryDaysValue = Number(expiryDays);
  if (!(toLetConfig.expiryOptionsDays as readonly number[]).includes(expiryDaysValue)) {
    return { ok: false, error: strings.toLet.expiryInvalid };
  }

  return {
    ok: true,
    value: {
      listingType,
      rent: rentCheck.value,
      rentNegotiable: Boolean(rentNegotiable),
      location: locationValue,
      genderPreference: genderPref,
      contactName: typeof contactName === 'string' && contactName.trim() ? contactName.trim() : null,
      contactPhone: phoneCheck.value,
      expiryDays: expiryDaysValue
    }
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);

  if (req.method === 'GET') {
    const after = queryString(req, 'after');
    const before = queryString(req, 'before');
    const limit = queryInt(req, 'limit', communityConfig.pageSize, 1, communityConfig.pageSize);
    const canMentionEveryone = sessionUser ? requireAdmin(sessionUser) : false;

    if (sessionUser) await ensureWelcomeMessage(sessionUser);

    const feed = await readFeed({ after, before, limit, viewerId: sessionUser?.id ?? null });
    const incremental = Boolean(after);

    return ok(res, {
      ...feed,
      members: incremental ? undefined : await directory(),
      unreadCount: sessionUser ? await unreadCount(sessionUser.id) : 0,
      currentUserId: sessionUser?.id ?? null,
      canMentionEveryone,
      canModerate: canMentionEveryone,
      maxLength: communityConfig.maxMessageLength,
      maxImagesPerPost: communityConfig.maxImagesPerPost,
      pollIntervalMs: communityConfig.pollIntervalMs
    });
  }

  if (!sessionUser) {
    return unauthorized(res, strings.community.signedOut);
  }

  const canMentionEveryone = requireAdmin(sessionUser);

  if (req.method === 'POST') {
    const body = req.body as Record<string, unknown>;
    const { text, images, title, listingType } = body;
    const value = typeof text === 'string' ? text.trim() : '';
    const imageInputs = Array.isArray(images) ? images.filter((item): item is string => typeof item === 'string') : [];
    const isToLet = listingType !== undefined;

    if (isToLet) {
      const titleValue = typeof title === 'string' ? title.trim() : '';
      if (!titleValue) return badRequest(res, strings.toLet.titleRequired);
      if (titleValue.length > toLetConfig.maxTitleLength) {
        return badRequest(res, strings.toLet.titleTooLong(toLetConfig.maxTitleLength));
      }
      if (!value) return badRequest(res, strings.toLet.descriptionRequired);
      if (value.length > toLetConfig.maxDescriptionLength) {
        return badRequest(res, strings.toLet.descriptionTooLong(toLetConfig.maxDescriptionLength));
      }
      if (imageInputs.length > toLetConfig.maxImagesPerListing) {
        return badRequest(res, strings.toLet.tooManyPhotos(toLetConfig.maxImagesPerListing));
      }

      const toLetCheck = parseToLetInput(body);
      if (!toLetCheck.ok) return badRequest(res, toLetCheck.error);

      if (findXssField({ title: titleValue, text: value, location: toLetCheck.value.location })) {
        return badRequest(res, strings.errors.suspiciousInput);
      }

      const savedImages: string[] = [];
      for (const dataUrl of imageInputs) {
        const saved = await saveImage(dataUrl, sessionUser.id);
        if (!saved.ok) return badRequest(res, saved.error);
        savedImages.push(saved.url);
      }

      const message = await postMessage({
        authorId: sessionUser.id,
        title: titleValue,
        text: value,
        images: savedImages,
        toLet: toLetCheck.value
      });

      return created(res, { message });
    }

    if (!value && imageInputs.length === 0) {
      return badRequest(res, strings.community.textRequired);
    }
    if (value.length > communityConfig.maxMessageLength) {
      return badRequest(res, strings.community.tooLong(communityConfig.maxMessageLength));
    }
    if (imageInputs.length > communityConfig.maxImagesPerPost) {
      return badRequest(res, strings.community.tooManyImages(communityConfig.maxImagesPerPost));
    }
    if (findXssField({ text: value })) {
      return badRequest(res, strings.errors.suspiciousInput);
    }

    const savedImages: string[] = [];
    for (const dataUrl of imageInputs) {
      const saved = await saveImage(dataUrl, sessionUser.id);
      if (!saved.ok) return badRequest(res, saved.error);
      savedImages.push(saved.url);
    }

    const message = await postMessage({ authorId: sessionUser.id, text: value, images: savedImages });
    await notifyMentions({ text: value, actorId: sessionUser.id, canMentionEveryone });

    return created(res, { message });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler, { maxRequestBodyBytes: communityConfig.postMaxRequestBodyBytes });
