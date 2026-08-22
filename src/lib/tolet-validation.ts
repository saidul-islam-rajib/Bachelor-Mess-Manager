import { toLetConfig } from '@/config';
import { TOLET_GENDER_PREFERENCE, TOLET_GENDER_PREFERENCE_VALUES, TOLET_TYPE_VALUES } from '@/lib/constants';
import { strings } from '@/lib/i18n';
import { validateAmount, validatePhone } from '@/lib/validation';
import type { PostMessageToLetInput } from '@/lib/community';

export type ToLetFieldsCheck =
  | { ok: true; title: string; text: string; value: PostMessageToLetInput }
  | { ok: false; error: string };

function parseCoordinate(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseToLetFields(body: Record<string, unknown>): ToLetFieldsCheck {
  const {
    title,
    text,
    listingType,
    rent,
    rentNegotiable,
    location,
    latitude,
    longitude,
    genderPreference,
    contactName,
    contactPhone,
    expiryDays
  } = body;

  const titleValue = typeof title === 'string' ? title.trim() : '';
  if (!titleValue) return { ok: false, error: strings.toLet.titleRequired };
  if (titleValue.length > toLetConfig.maxTitleLength) {
    return { ok: false, error: strings.toLet.titleTooLong(toLetConfig.maxTitleLength) };
  }

  const textValue = typeof text === 'string' ? text.trim() : '';
  if (!textValue) return { ok: false, error: strings.toLet.descriptionRequired };
  if (textValue.length > toLetConfig.maxDescriptionLength) {
    return { ok: false, error: strings.toLet.descriptionTooLong(toLetConfig.maxDescriptionLength) };
  }

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
    title: titleValue,
    text: textValue,
    value: {
      listingType,
      rent: rentCheck.value,
      rentNegotiable: Boolean(rentNegotiable),
      location: locationValue,
      latitude: parseCoordinate(latitude) ?? null,
      longitude: parseCoordinate(longitude) ?? null,
      genderPreference: genderPref,
      contactName: typeof contactName === 'string' && contactName.trim() ? contactName.trim() : null,
      contactPhone: phoneCheck.value,
      expiryDays: expiryDaysValue
    }
  };
}
