import { toLetConfig } from '@/config';
import {
  TOLET_AMENITY_VALUES,
  TOLET_GENDER_PREFERENCE_VALUES,
  TOLET_HOUSE_RULES_VALUES,
  TOLET_MONTHS,
  TOLET_TENANT_RESTRICTION,
  TOLET_TENANT_RESTRICTION_VALUES,
  TOLET_TYPE_VALUES
} from '@/lib/constants';
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
    tenantRestriction,
    houseRules,
    seatsAvailable,
    attachedBath,
    attachedBalcony,
    serviceChargeIncluded,
    advanceMonths,
    amenities,
    mealsProvided,
    contactWhatsapp,
    availableMonth,
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

  let tenantRestrictionValue: string = TOLET_TENANT_RESTRICTION.ANY;
  if (tenantRestriction !== undefined && tenantRestriction !== null && tenantRestriction !== '') {
    if (typeof tenantRestriction !== 'string' || !TOLET_TENANT_RESTRICTION_VALUES.includes(tenantRestriction)) {
      return { ok: false, error: strings.toLet.tenantRestrictionInvalid };
    }
    tenantRestrictionValue = tenantRestriction;
  }

  let genderPref: string | null = null;
  if (tenantRestrictionValue === TOLET_TENANT_RESTRICTION.BACHELOR) {
    if (typeof genderPreference !== 'string' || !TOLET_GENDER_PREFERENCE_VALUES.includes(genderPreference)) {
      return { ok: false, error: strings.toLet.genderPreferenceInvalid };
    }
    genderPref = genderPreference;
  }

  let houseRulesValue: string | null = null;
  if (houseRules !== undefined && houseRules !== null && houseRules !== '') {
    if (typeof houseRules !== 'string' || !TOLET_HOUSE_RULES_VALUES.includes(houseRules)) {
      return { ok: false, error: strings.toLet.houseRulesInvalid };
    }
    houseRulesValue = houseRules;
  }

  let seatsAvailableValue: number | null = null;
  if (seatsAvailable !== undefined && seatsAvailable !== null && seatsAvailable !== '') {
    const parsed = Number(seatsAvailable);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > toLetConfig.maxSeatsAvailable) {
      return { ok: false, error: strings.toLet.seatsAvailableInvalid(toLetConfig.maxSeatsAvailable) };
    }
    seatsAvailableValue = parsed;
  }

  let advanceMonthsValue: number | null = null;
  if (advanceMonths !== undefined && advanceMonths !== null && advanceMonths !== '') {
    const parsed = Number(advanceMonths);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > toLetConfig.maxAdvanceMonths) {
      return { ok: false, error: strings.toLet.advanceMonthsInvalid(toLetConfig.maxAdvanceMonths) };
    }
    advanceMonthsValue = parsed;
  }

  const amenitiesList = Array.isArray(amenities) ? amenities : [];
  const invalidAmenity = amenitiesList.find((item) => typeof item !== 'string' || !TOLET_AMENITY_VALUES.includes(item));
  if (invalidAmenity !== undefined) {
    return { ok: false, error: strings.toLet.amenitiesInvalid };
  }
  const amenitiesValue = [...new Set(amenitiesList as string[])];

  const whatsappCheck = validatePhone(contactWhatsapp);
  if (!whatsappCheck.ok) return { ok: false, error: whatsappCheck.error };

  let availableMonthValue: string | null = null;
  if (availableMonth !== undefined && availableMonth !== null && availableMonth !== '') {
    if (typeof availableMonth !== 'string' || !(TOLET_MONTHS as readonly string[]).includes(availableMonth)) {
      return { ok: false, error: strings.toLet.availableMonthInvalid };
    }
    availableMonthValue = availableMonth;
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
      tenantRestriction: tenantRestrictionValue,
      houseRules: tenantRestrictionValue === TOLET_TENANT_RESTRICTION.BACHELOR ? houseRulesValue : null,
      seatsAvailable: seatsAvailableValue,
      attachedBath: Boolean(attachedBath),
      attachedBalcony: Boolean(attachedBalcony),
      serviceChargeIncluded: Boolean(serviceChargeIncluded),
      advanceMonths: advanceMonthsValue,
      amenities: amenitiesValue,
      mealsProvided: Boolean(mealsProvided),
      contactWhatsapp: whatsappCheck.value,
      availableMonth: availableMonthValue,
      contactName: typeof contactName === 'string' && contactName.trim() ? contactName.trim() : null,
      contactPhone: phoneCheck.value,
      expiryDays: expiryDaysValue
    }
  };
}
