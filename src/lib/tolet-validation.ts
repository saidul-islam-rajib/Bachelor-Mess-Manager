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
import { validateAmount, validateFacebookLink, validatePhone } from '@/lib/validation';
import type { PostMessageToLetInput } from '@/lib/community';

export type ToLetFieldsCheck =
  | { ok: true; title: string; text: string; value: PostMessageToLetInput }
  | { ok: false; error: string };

function parseCoordinate(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

type OptionalIntCheck = { ok: true; value: number | null } | { ok: false; error: string };

function parseOptionalInt(value: unknown, min: number, max: number, error: string): OptionalIntCheck {
  if (value === undefined || value === null || value === '') return { ok: true, value: null };
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return { ok: false, error };
  return { ok: true, value: parsed };
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
    isSublet,
    seatsAvailable,
    attachedBath,
    attachedBalcony,
    roomCount,
    balconyCount,
    bathroomCount,
    attachedBathroomCount,
    floorNumber,
    serviceChargeIncluded,
    advanceMonths,
    amenities,
    mealsProvided,
    contactWhatsapp,
    contactFacebook,
    availableMonth,
    contactName,
    contactPhone,
    contact2Name,
    contact2Phone,
    contact2Whatsapp,
    contact2Facebook,
    sourceUrl,
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

  const roomCountCheck = parseOptionalInt(roomCount, 1, toLetConfig.maxRoomCount, strings.toLet.roomCountInvalid(toLetConfig.maxRoomCount));
  if (!roomCountCheck.ok) return { ok: false, error: roomCountCheck.error };

  const balconyCountCheck = parseOptionalInt(balconyCount, 0, toLetConfig.maxBalconyCount, strings.toLet.balconyCountInvalid(toLetConfig.maxBalconyCount));
  if (!balconyCountCheck.ok) return { ok: false, error: balconyCountCheck.error };

  const bathroomCountCheck = parseOptionalInt(bathroomCount, 0, toLetConfig.maxBathroomCount, strings.toLet.bathroomCountInvalid(toLetConfig.maxBathroomCount));
  if (!bathroomCountCheck.ok) return { ok: false, error: bathroomCountCheck.error };

  const attachedBathroomCountCheck = parseOptionalInt(
    attachedBathroomCount,
    0,
    toLetConfig.maxBathroomCount,
    strings.toLet.attachedBathroomCountInvalid(toLetConfig.maxBathroomCount)
  );
  if (!attachedBathroomCountCheck.ok) return { ok: false, error: attachedBathroomCountCheck.error };

  const floorNumberCheck = parseOptionalInt(floorNumber, 0, toLetConfig.maxFloorNumber, strings.toLet.floorNumberInvalid(toLetConfig.maxFloorNumber));
  if (!floorNumberCheck.ok) return { ok: false, error: floorNumberCheck.error };

  const amenitiesList = Array.isArray(amenities) ? amenities : [];
  const invalidAmenity = amenitiesList.find((item) => typeof item !== 'string' || !TOLET_AMENITY_VALUES.includes(item));
  if (invalidAmenity !== undefined) {
    return { ok: false, error: strings.toLet.amenitiesInvalid };
  }
  const amenitiesValue = [...new Set(amenitiesList as string[])];

  const whatsappCheck = validatePhone(contactWhatsapp);
  if (!whatsappCheck.ok) return { ok: false, error: whatsappCheck.error };

  const facebookCheck = validateFacebookLink(contactFacebook);
  if (!facebookCheck.ok) return { ok: false, error: facebookCheck.error };

  const contact2WhatsappCheck = validatePhone(contact2Whatsapp);
  if (!contact2WhatsappCheck.ok) return { ok: false, error: contact2WhatsappCheck.error };

  const contact2FacebookCheck = validateFacebookLink(contact2Facebook);
  if (!contact2FacebookCheck.ok) return { ok: false, error: contact2FacebookCheck.error };

  const sourceUrlCheck = validateFacebookLink(sourceUrl);
  if (!sourceUrlCheck.ok) return { ok: false, error: sourceUrlCheck.error };

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

  let rentValue: number | null = null;
  if (rent !== undefined && rent !== null && rent !== '') {
    const rentCheck = validateAmount(rent);
    if (!rentCheck.ok) return { ok: false, error: rentCheck.error };
    rentValue = rentCheck.value;
  }

  const phoneCheck = validatePhone(contactPhone);
  if (!phoneCheck.ok) return { ok: false, error: phoneCheck.error };

  const contact2PhoneCheck = validatePhone(contact2Phone);
  if (!contact2PhoneCheck.ok) return { ok: false, error: contact2PhoneCheck.error };

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
      rent: rentValue,
      rentNegotiable: Boolean(rentNegotiable),
      location: locationValue,
      latitude: parseCoordinate(latitude) ?? null,
      longitude: parseCoordinate(longitude) ?? null,
      genderPreference: genderPref,
      tenantRestriction: tenantRestrictionValue,
      houseRules: tenantRestrictionValue === TOLET_TENANT_RESTRICTION.BACHELOR ? houseRulesValue : null,
      isSublet: Boolean(isSublet),
      seatsAvailable: seatsAvailableValue,
      attachedBath: Boolean(attachedBath),
      attachedBalcony: Boolean(attachedBalcony),
      roomCount: roomCountCheck.value,
      balconyCount: balconyCountCheck.value,
      bathroomCount: bathroomCountCheck.value,
      attachedBathroomCount: attachedBathroomCountCheck.value,
      floorNumber: floorNumberCheck.value,
      serviceChargeIncluded: Boolean(serviceChargeIncluded),
      advanceMonths: advanceMonthsValue,
      amenities: amenitiesValue,
      mealsProvided: Boolean(mealsProvided),
      contactWhatsapp: whatsappCheck.value,
      contactFacebook: facebookCheck.value,
      availableMonth: availableMonthValue,
      contactName: typeof contactName === 'string' && contactName.trim() ? contactName.trim() : null,
      contactPhone: phoneCheck.value,
      contact2Name: typeof contact2Name === 'string' && contact2Name.trim() ? contact2Name.trim() : null,
      contact2Phone: contact2PhoneCheck.value,
      contact2Whatsapp: contact2WhatsappCheck.value,
      contact2Facebook: contact2FacebookCheck.value,
      sourceUrl: sourceUrlCheck.value,
      expiryDays: expiryDaysValue
    }
  };
}
