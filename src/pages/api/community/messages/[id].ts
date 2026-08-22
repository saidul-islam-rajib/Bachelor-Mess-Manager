import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { toLetConfig } from '@/config';
import {
  computeExpiresAt,
  deleteMessage,
  findMessage,
  getMessageForView,
  incrementView,
  isSystemMessage,
  markListingExpired,
  updateListing,
  type UpdateListingInput
} from '@/lib/community';
import { strings } from '@/lib/i18n';
import {
  COMMUNITY_MESSAGE_TYPES,
  TOLET_GENDER_PREFERENCE,
  TOLET_GENDER_PREFERENCE_VALUES,
  TOLET_STATUS,
  TOLET_TYPE_VALUES
} from '@/lib/constants';
import { geocode } from '@/lib/geo';
import { firstValue } from '@/lib/query';
import { validateAmount, validatePhone } from '@/lib/validation';
import { saveImage } from '@/lib/uploads';
import { findXssField } from '@/lib/xss';
import { withAudit } from '@/lib/with-audit';

export const config = {
  api: {
    bodyParser: { sizeLimit: '54mb' }
  }
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = firstValue(req.query.id);
  if (!id) {
    return badRequest(res, strings.community.idRequired);
  }

  const sessionUser = await getSessionUser(req, res);

  if (req.method === 'GET') {
    const message = await getMessageForView(id, sessionUser?.id ?? null);
    const isOwnerOrAdmin = Boolean(sessionUser) && (sessionUser?.id === message?.authorId || requireAdmin(sessionUser));

    if (
      !message ||
      (message.type === COMMUNITY_MESSAGE_TYPES.TOLET && message.effectiveListingStatus !== TOLET_STATUS.ACTIVE && !isOwnerOrAdmin)
    ) {
      return notFound(res, strings.community.notFound);
    }

    if (message.type === COMMUNITY_MESSAGE_TYPES.TOLET && !isOwnerOrAdmin) await incrementView(id);

    return ok(res, { message });
  }

  if (!sessionUser) {
    return unauthorized(res, strings.community.signedOut);
  }

  if (req.method === 'DELETE') {
    const message = await findMessage(id);
    if (!message) {
      return notFound(res, strings.community.notFound);
    }

    const isModerator = requireAdmin(sessionUser);

    if (!isModerator) {
      if (isSystemMessage(message.type)) {
        return forbidden(res, strings.community.systemNotDeletable);
      }
      if (message.authorId !== sessionUser.id) {
        return forbidden(res, strings.community.deleteNotAllowed);
      }
    }

    await deleteMessage(id);

    return ok(res, { deleted: true });
  }

  if (req.method === 'PATCH') {
    const existing = await findMessage(id);
    if (!existing || existing.type !== COMMUNITY_MESSAGE_TYPES.TOLET) {
      return notFound(res, strings.toLet.notFound);
    }

    const canManage = existing.authorId === sessionUser.id || requireAdmin(sessionUser);
    if (!canManage) return forbidden(res, strings.toLet.forbidden);

    const body = req.body as Record<string, unknown>;

    if (body.markExpired === true) {
      await markListingExpired(id, sessionUser.id);
      const updated = await getMessageForView(id, sessionUser.id);
      return ok(res, { message: updated });
    }

    const patch: UpdateListingInput = {};

    if (body.listingType !== undefined) {
      if (typeof body.listingType !== 'string' || !TOLET_TYPE_VALUES.includes(body.listingType)) {
        return badRequest(res, strings.toLet.typeInvalid);
      }
      patch.listingType = body.listingType;
    }

    if (body.genderPreference !== undefined) {
      if (
        body.genderPreference !== null &&
        body.genderPreference !== '' &&
        (typeof body.genderPreference !== 'string' || !TOLET_GENDER_PREFERENCE_VALUES.includes(body.genderPreference))
      ) {
        return badRequest(res, strings.toLet.genderPreferenceInvalid);
      }
      patch.genderPreference =
        typeof body.genderPreference === 'string' && body.genderPreference ? body.genderPreference : TOLET_GENDER_PREFERENCE.ANY;
    }

    if (body.title !== undefined) {
      const value = typeof body.title === 'string' ? body.title.trim() : '';
      if (!value) return badRequest(res, strings.toLet.titleRequired);
      if (value.length > toLetConfig.maxTitleLength) return badRequest(res, strings.toLet.titleTooLong(toLetConfig.maxTitleLength));
      patch.title = value;
    }

    if (body.text !== undefined) {
      const value = typeof body.text === 'string' ? body.text.trim() : '';
      if (!value) return badRequest(res, strings.toLet.descriptionRequired);
      if (value.length > toLetConfig.maxDescriptionLength) {
        return badRequest(res, strings.toLet.descriptionTooLong(toLetConfig.maxDescriptionLength));
      }
      patch.text = value;
    }

    if (body.location !== undefined) {
      const value = typeof body.location === 'string' ? body.location.trim() : '';
      if (!value) return badRequest(res, strings.toLet.locationRequired);
      if (value.length > toLetConfig.maxLocationLength) return badRequest(res, strings.toLet.locationTooLong(toLetConfig.maxLocationLength));
      patch.location = value;

      if (body.latitude !== undefined || body.longitude !== undefined) {
        const lat = Number(body.latitude);
        const lng = Number(body.longitude);
        patch.latitude = Number.isFinite(lat) ? lat : null;
        patch.longitude = Number.isFinite(lng) ? lng : null;
      } else {
        const point = await geocode(value);
        patch.latitude = point?.lat ?? null;
        patch.longitude = point?.lng ?? null;
      }
    }

    if (body.rent !== undefined) {
      const rentCheck = validateAmount(body.rent);
      if (!rentCheck.ok) return badRequest(res, rentCheck.error);
      patch.rent = rentCheck.value;
    }

    if (body.rentNegotiable !== undefined) {
      patch.rentNegotiable = Boolean(body.rentNegotiable);
    }

    if (body.contactPhone !== undefined) {
      const phoneCheck = validatePhone(body.contactPhone);
      if (!phoneCheck.ok) return badRequest(res, phoneCheck.error);
      patch.contactPhone = phoneCheck.value;
    }

    if (body.contactName !== undefined) {
      patch.contactName = typeof body.contactName === 'string' && body.contactName.trim() ? body.contactName.trim() : null;
    }

    if (body.expiryDays !== undefined) {
      const expiryDaysValue = Number(body.expiryDays);
      if (!(toLetConfig.expiryOptionsDays as readonly number[]).includes(expiryDaysValue)) {
        return badRequest(res, strings.toLet.expiryInvalid);
      }
      patch.expiresAt = computeExpiresAt(expiryDaysValue);
      patch.listingStatus = TOLET_STATUS.ACTIVE;
    }

    if (
      findXssField({
        title: patch.title ?? '',
        text: patch.text ?? '',
        location: patch.location ?? '',
        contactName: patch.contactName ?? ''
      })
    ) {
      return badRequest(res, strings.errors.suspiciousInput);
    }

    if (body.images !== undefined) {
      const imageInputs = Array.isArray(body.images) ? body.images.filter((item): item is string => typeof item === 'string') : [];
      if (imageInputs.length > toLetConfig.maxImagesPerListing) {
        return badRequest(res, strings.toLet.tooManyPhotos(toLetConfig.maxImagesPerListing));
      }

      const savedImages: string[] = [];
      for (const image of imageInputs) {
        if (image.startsWith('data:')) {
          const saved = await saveImage(image, sessionUser.id);
          if (!saved.ok) return badRequest(res, saved.error);
          savedImages.push(saved.url);
        } else {
          savedImages.push(image);
        }
      }
      patch.images = savedImages;
    }

    const message = await updateListing(id, patch, sessionUser.id);
    return ok(res, { message });
  }

  return methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
}

export default withAudit(handler, { maxRequestBodyBytes: toLetConfig.postMaxRequestBodyBytes });
