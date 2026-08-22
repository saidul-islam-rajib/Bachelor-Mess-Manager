import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, created, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { toLetConfig } from '@/config';
import { TOLET_GENDER_PREFERENCE, TOLET_GENDER_PREFERENCE_VALUES, TOLET_TYPE_VALUES } from '@/lib/constants';
import { computeExpiresAt, createListing, searchListings } from '@/lib/tolet';
import { strings } from '@/lib/i18n';
import { queryEnum, queryInt, queryString } from '@/lib/query';
import { validateAmount, validateDayKey, validatePhone } from '@/lib/validation';
import { saveImage } from '@/lib/uploads';
import { findXssField } from '@/lib/xss';
import { withAudit } from '@/lib/with-audit';

export const config = {
  api: {
    bodyParser: { sizeLimit: '54mb' }
  }
};

function parseRent(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);

  if (req.method === 'GET') {
    const q = queryString(req, 'q');
    const type = queryEnum(req, 'type', TOLET_TYPE_VALUES);
    const minRent = parseRent(queryString(req, 'minRent'));
    const maxRent = parseRent(queryString(req, 'maxRent'));
    const page = queryInt(req, 'page', 1, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = queryInt(req, 'pageSize', toLetConfig.pageSize, 1, toLetConfig.pageSize);

    const result = await searchListings({
      q,
      type,
      minRent,
      maxRent,
      page,
      pageSize,
      viewerId: sessionUser?.id ?? null
    });

    return ok(res, result);
  }

  if (!sessionUser) {
    return unauthorized(res, strings.toLet.signedOut);
  }

  if (req.method === 'POST') {
    const {
      type,
      title,
      description,
      rent,
      rentNegotiable,
      location,
      genderPreference,
      availableFrom,
      contactName,
      contactPhone,
      expiryDays,
      images
    } = req.body as Record<string, unknown>;

    if (typeof type !== 'string' || !TOLET_TYPE_VALUES.includes(type)) {
      return badRequest(res, strings.toLet.typeInvalid);
    }

    let genderPref: string = TOLET_GENDER_PREFERENCE.ANY;
    if (genderPreference !== undefined && genderPreference !== null && genderPreference !== '') {
      if (typeof genderPreference !== 'string' || !TOLET_GENDER_PREFERENCE_VALUES.includes(genderPreference)) {
        return badRequest(res, strings.toLet.genderPreferenceInvalid);
      }
      genderPref = genderPreference;
    }

    const titleValue = typeof title === 'string' ? title.trim() : '';
    if (!titleValue) return badRequest(res, strings.toLet.titleRequired);
    if (titleValue.length > toLetConfig.maxTitleLength) {
      return badRequest(res, strings.toLet.titleTooLong(toLetConfig.maxTitleLength));
    }

    const descriptionValue = typeof description === 'string' ? description.trim() : '';
    if (!descriptionValue) return badRequest(res, strings.toLet.descriptionRequired);
    if (descriptionValue.length > toLetConfig.maxDescriptionLength) {
      return badRequest(res, strings.toLet.descriptionTooLong(toLetConfig.maxDescriptionLength));
    }

    const locationValue = typeof location === 'string' ? location.trim() : '';
    if (!locationValue) return badRequest(res, strings.toLet.locationRequired);
    if (locationValue.length > toLetConfig.maxLocationLength) {
      return badRequest(res, strings.toLet.locationTooLong(toLetConfig.maxLocationLength));
    }

    const rentCheck = validateAmount(rent);
    if (!rentCheck.ok) return badRequest(res, rentCheck.error);

    const phoneCheck = validatePhone(contactPhone);
    if (!phoneCheck.ok) return badRequest(res, phoneCheck.error);

    const contactNameValue = typeof contactName === 'string' && contactName.trim() ? contactName.trim() : null;

    let availableFromDate: Date | null = null;
    if (availableFrom !== undefined && availableFrom !== null && availableFrom !== '') {
      const dayCheck = validateDayKey(availableFrom);
      if (!dayCheck.ok) return badRequest(res, strings.toLet.availableFromInvalid);
      availableFromDate = new Date(`${dayCheck.value}T00:00:00.000Z`);
    }

    const expiryDaysValue = Number(expiryDays);
    if (!(toLetConfig.expiryOptionsDays as readonly number[]).includes(expiryDaysValue)) {
      return badRequest(res, strings.toLet.expiryInvalid);
    }

    const imageInputs = Array.isArray(images) ? images.filter((item): item is string => typeof item === 'string') : [];
    if (imageInputs.length > toLetConfig.maxImagesPerListing) {
      return badRequest(res, strings.toLet.tooManyPhotos(toLetConfig.maxImagesPerListing));
    }

    if (
      findXssField({
        title: titleValue,
        description: descriptionValue,
        location: locationValue,
        contactName: contactNameValue ?? ''
      })
    ) {
      return badRequest(res, strings.errors.suspiciousInput);
    }

    const savedImages: string[] = [];
    for (const dataUrl of imageInputs) {
      const saved = await saveImage(dataUrl, sessionUser.id);
      if (!saved.ok) return badRequest(res, saved.error);
      savedImages.push(saved.url);
    }

    const listing = await createListing({
      authorId: sessionUser.id,
      type,
      title: titleValue,
      description: descriptionValue,
      rent: rentCheck.value,
      rentNegotiable: Boolean(rentNegotiable),
      location: locationValue,
      genderPreference: genderPref,
      availableFrom: availableFromDate,
      contactName: contactNameValue,
      contactPhone: phoneCheck.value,
      expiresAt: computeExpiresAt(expiryDaysValue),
      images: savedImages
    });

    return created(res, { listing });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler, { maxRequestBodyBytes: toLetConfig.postMaxRequestBodyBytes });
