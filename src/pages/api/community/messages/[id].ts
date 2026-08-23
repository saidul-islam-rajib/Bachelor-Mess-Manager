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
import { COMMUNITY_MESSAGE_TYPES, TOLET_STATUS } from '@/lib/constants';
import { geocode } from '@/lib/geo';
import { firstValue } from '@/lib/query';
import { parseToLetFields } from '@/lib/tolet-validation';
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

    const imageInputs = Array.isArray(body.images)
      ? body.images.filter((item): item is string => typeof item === 'string')
      : undefined;
    if (imageInputs && imageInputs.length > toLetConfig.maxImagesPerListing) {
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

    const patch: UpdateListingInput = {
      listingType: toLetCheck.value.listingType,
      title: toLetCheck.title,
      text: toLetCheck.text,
      rent: toLetCheck.value.rent,
      rentNegotiable: toLetCheck.value.rentNegotiable,
      location: toLetCheck.value.location,
      latitude: toLetCheck.value.latitude ?? null,
      longitude: toLetCheck.value.longitude ?? null,
      genderPreference: toLetCheck.value.genderPreference,
      tenantRestriction: toLetCheck.value.tenantRestriction,
      houseRules: toLetCheck.value.houseRules,
      isSublet: toLetCheck.value.isSublet,
      seatsAvailable: toLetCheck.value.seatsAvailable,
      attachedBath: toLetCheck.value.attachedBath,
      attachedBalcony: toLetCheck.value.attachedBalcony,
      serviceChargeIncluded: toLetCheck.value.serviceChargeIncluded,
      advanceMonths: toLetCheck.value.advanceMonths,
      amenities: toLetCheck.value.amenities,
      mealsProvided: toLetCheck.value.mealsProvided,
      contactWhatsapp: toLetCheck.value.contactWhatsapp,
      availableMonth: toLetCheck.value.availableMonth,
      contactName: toLetCheck.value.contactName,
      contactPhone: toLetCheck.value.contactPhone,
      expiresAt: computeExpiresAt(toLetCheck.value.expiryDays),
      listingStatus: TOLET_STATUS.ACTIVE
    };

    if (imageInputs) {
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
