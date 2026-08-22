import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, noContent, notFound, ok, unauthorized } from '@/lib/http';
import { toLetConfig } from '@/config';
import { TOLET_GENDER_PREFERENCE, TOLET_GENDER_PREFERENCE_VALUES, TOLET_STATUS, TOLET_TYPE_VALUES } from '@/lib/constants';
import {
  computeExpiresAt,
  deleteListing,
  findListing,
  getListingForView,
  incrementView,
  markExpired,
  updateListing
} from '@/lib/tolet';
import { strings } from '@/lib/i18n';
import { validateAmount, validateDayKey, validatePhone } from '@/lib/validation';
import { saveImage } from '@/lib/uploads';
import { findXssField } from '@/lib/xss';
import { withAudit } from '@/lib/with-audit';

export const config = {
  api: {
    bodyParser: { sizeLimit: '54mb' }
  }
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = firstParam(req.query.id);
  if (!id) return badRequest(res, strings.toLet.idRequired);

  const sessionUser = await getSessionUser(req, res);

  if (req.method === 'GET') {
    const listing = await getListingForView(id, sessionUser?.id ?? null);
    const isOwnerOrAdmin = Boolean(sessionUser) && (sessionUser?.id === listing?.authorId || requireAdmin(sessionUser));

    if (!listing || (listing.effectiveStatus !== TOLET_STATUS.ACTIVE && !isOwnerOrAdmin)) {
      return notFound(res, strings.toLet.notFound);
    }

    if (!isOwnerOrAdmin) await incrementView(id);

    return ok(res, { listing });
  }

  if (!sessionUser) {
    return unauthorized(res, strings.toLet.signedOut);
  }

  const existing = await findListing(id);
  if (!existing) return notFound(res, strings.toLet.notFound);

  const canManage = existing.authorId === sessionUser.id || requireAdmin(sessionUser);
  if (!canManage) return forbidden(res, strings.toLet.forbidden);

  if (req.method === 'PATCH') {
    const body = req.body as Record<string, unknown>;

    if (body.markExpired === true) {
      await markExpired(id, sessionUser.id);
      const listing = await getListingForView(id, sessionUser.id);
      return ok(res, { listing });
    }

    const patch: Parameters<typeof updateListing>[1] = {};

    if (body.type !== undefined) {
      if (typeof body.type !== 'string' || !TOLET_TYPE_VALUES.includes(body.type)) {
        return badRequest(res, strings.toLet.typeInvalid);
      }
      patch.type = body.type;
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

    if (body.description !== undefined) {
      const value = typeof body.description === 'string' ? body.description.trim() : '';
      if (!value) return badRequest(res, strings.toLet.descriptionRequired);
      if (value.length > toLetConfig.maxDescriptionLength) {
        return badRequest(res, strings.toLet.descriptionTooLong(toLetConfig.maxDescriptionLength));
      }
      patch.description = value;
    }

    if (body.location !== undefined) {
      const value = typeof body.location === 'string' ? body.location.trim() : '';
      if (!value) return badRequest(res, strings.toLet.locationRequired);
      if (value.length > toLetConfig.maxLocationLength) return badRequest(res, strings.toLet.locationTooLong(toLetConfig.maxLocationLength));
      patch.location = value;
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

    if (body.availableFrom !== undefined) {
      if (body.availableFrom === null || body.availableFrom === '') {
        patch.availableFrom = null;
      } else {
        const dayCheck = validateDayKey(body.availableFrom);
        if (!dayCheck.ok) return badRequest(res, strings.toLet.availableFromInvalid);
        patch.availableFrom = new Date(`${dayCheck.value}T00:00:00.000Z`);
      }
    }

    if (body.expiryDays !== undefined) {
      const expiryDaysValue = Number(body.expiryDays);
      if (!(toLetConfig.expiryOptionsDays as readonly number[]).includes(expiryDaysValue)) {
        return badRequest(res, strings.toLet.expiryInvalid);
      }
      patch.expiresAt = computeExpiresAt(expiryDaysValue);
      patch.status = TOLET_STATUS.ACTIVE;
    }

    if (
      findXssField({
        title: patch.title ?? '',
        description: patch.description ?? '',
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

    const listing = await updateListing(id, patch, sessionUser.id);
    return ok(res, { listing });
  }

  if (req.method === 'DELETE') {
    await deleteListing(id, sessionUser.id);
    return noContent(res);
  }

  return methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
}

export default withAudit(handler, { maxRequestBodyBytes: toLetConfig.postMaxRequestBodyBytes });
