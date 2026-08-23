import { TOLET_AMENITIES, TOLET_GENDER_PREFERENCE, TOLET_MONTHS, TOLET_TENANT_RESTRICTION, TOLET_TYPES } from '@/lib/constants';
import { strings } from '@/lib/i18n';

export type ToLetImportResult = {
  title: string;
  text: string;
  listingType: string;
  tenantRestriction: string;
  genderPreference: string;
  isSublet: boolean;
  rent: string;
  advanceMonths: string;
  seatsAvailable: string;
  availableMonth: string;
  attachedBath: boolean;
  attachedBalcony: boolean;
  roomCount: string;
  balconyCount: string;
  bathroomCount: string;
  attachedBathroomCount: string;
  floorNumber: string;
  mealsProvided: boolean;
  serviceChargeIncluded: boolean;
  amenities: string[];
  location: string;
  contactPhone: string;
  contactFacebook: string;
};

const BENGALI_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9'
};

const BENGALI_MONTHS: Record<string, string> = {
  জানুয়ারি: 'JANUARY',
  ফেব্রুয়ারি: 'FEBRUARY',
  মার্চ: 'MARCH',
  এপ্রিল: 'APRIL',
  মে: 'MAY',
  জুন: 'JUNE',
  জুলাই: 'JULY',
  আগস্ট: 'AUGUST',
  অগাস্ট: 'AUGUST',
  সেপ্টেম্বর: 'SEPTEMBER',
  অক্টোবর: 'OCTOBER',
  নভেম্বর: 'NOVEMBER',
  ডিসেম্বর: 'DECEMBER'
};

const ENGLISH_MONTHS: Record<string, string> = {
  january: 'JANUARY',
  jan: 'JANUARY',
  february: 'FEBRUARY',
  feb: 'FEBRUARY',
  march: 'MARCH',
  mar: 'MARCH',
  april: 'APRIL',
  apr: 'APRIL',
  may: 'MAY',
  june: 'JUNE',
  jun: 'JUNE',
  july: 'JULY',
  jul: 'JULY',
  august: 'AUGUST',
  aug: 'AUGUST',
  september: 'SEPTEMBER',
  sept: 'SEPTEMBER',
  sep: 'SEPTEMBER',
  october: 'OCTOBER',
  oct: 'OCTOBER',
  november: 'NOVEMBER',
  nov: 'NOVEMBER',
  december: 'DECEMBER',
  dec: 'DECEMBER'
};

const WORD_BOUNDARY_CHARS = /[\s.,।!?()/\-–—:;'"]/;

function normalizeDigits(value: string): string {
  return value.replace(/[০-৯]/g, (digit) => BENGALI_DIGITS[digit] ?? digit);
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function isStandaloneAt(text: string, index: number, length: number): boolean {
  const before = text[index - 1];
  const after = text[index + length];
  return (before === undefined || WORD_BOUNDARY_CHARS.test(before)) && (after === undefined || WORD_BOUNDARY_CHARS.test(after));
}

function findStandaloneIndex(text: string, word: string): number {
  let searchFrom = 0;
  while (searchFrom <= text.length) {
    const index = text.indexOf(word, searchFrom);
    if (index === -1) return -1;
    if (isStandaloneAt(text, index, word.length)) return index;
    searchFrom = index + word.length;
  }
  return -1;
}

function extractAmount(normalizedText: string, keywords: string[], min: number, max: number): string {
  const candidates: { value: number; score: number; index: number }[] = [];
  const numberPattern = /\d+(?:,\d{3})*/g;
  let match: RegExpExecArray | null;

  while ((match = numberPattern.exec(normalizedText)) !== null) {
    const raw = match[0];
    const value = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(value) || value < min || value > max) continue;

    const start = match.index;
    const end = start + raw.length;
    const beforeRaw = normalizedText.slice(Math.max(0, start - 25), start);
    const afterRaw = normalizedText.slice(end, Math.min(normalizedText.length, end + 25));
    const beforeNewline = beforeRaw.lastIndexOf('\n');
    const afterNewline = afterRaw.indexOf('\n');
    const before = (beforeNewline === -1 ? beforeRaw : beforeRaw.slice(beforeNewline + 1)).toLowerCase();
    const after = (afterNewline === -1 ? afterRaw : afterRaw.slice(0, afterNewline)).toLowerCase();

    const followedBySlashMonth =
      /^\s*\//.test(after) &&
      (Object.keys(BENGALI_MONTHS).some((m) => after.slice(0, 20).includes(m)) ||
        Object.keys(ENGLISH_MONTHS).some((m) => new RegExp(`^\\s*/\\s*${m}\\b`, 'i').test(after)));
    if (followedBySlashMonth) continue;

    const hasCurrencyMarker = /৳\s*$/.test(before) || /^\s*৳/.test(after) || /^\s*(টাকা|taka|tk\b)/.test(after) || /^\s*\/[-=]/.test(after);
    const hasKeyword = keywords.some(
      (keyword) => findStandaloneIndex(before, keyword) !== -1 || findStandaloneIndex(after, keyword) !== -1
    );
    const looksLikeYear = value >= 1900 && value <= 2099 && raw.length === 4;

    if (looksLikeYear && !hasCurrencyMarker) continue;

    let score = 0;
    if (hasKeyword) score += 5;
    if (hasCurrencyMarker) score += 2;

    if (score > 0) candidates.push({ value, score, index: start });
  }

  if (candidates.length === 0) return '';
  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  return String(candidates[0].value);
}

function detectListingType(text: string): string {
  if (includesAny(text, ['মাস্টার বেড', 'master bed'])) return TOLET_TYPES.MASTER_BED;
  if (includesAny(text, ['সেমি মাস্টার', 'semi master', 'semi-master'])) return TOLET_TYPES.SEMI_MASTER;
  if (includesAny(text, ['সিঙ্গেল রুম', 'single room'])) return TOLET_TYPES.SINGLE_ROOM;
  if (includesAny(text, ['ফ্ল্যাট', 'apartment', 'flat'])) return TOLET_TYPES.FLAT;
  if (findStandaloneIndex(text, 'সিট') !== -1 || /\bseat\b/.test(text)) return TOLET_TYPES.SEAT;
  return TOLET_TYPES.ROOM;
}

function detectTenantRestriction(text: string): string {
  if (includesAny(text, ['হাসব্যান্ড ওয়াইফ', 'husband wife', 'couple', 'ফ্যামিলি', 'family'])) {
    return TOLET_TENANT_RESTRICTION.FAMILY;
  }
  return TOLET_TENANT_RESTRICTION.BACHELOR;
}

function detectGenderPreference(text: string): string {
  if (includesAny(text, ['মেয়ে', 'ladies', 'female', 'নারী'])) return TOLET_GENDER_PREFERENCE.FEMALE;
  return TOLET_GENDER_PREFERENCE.MALE;
}

function detectLocation(text: string): string {
  const match = text.match(/(?:ঠিকানা|address|location)\s*[:\-।]*\s*([^\n]+)/i);
  return match ? match[1].trim().replace(/[.।]+$/, '') : '';
}

function detectPhone(text: string): string {
  const match = normalizeDigits(text).match(/(?:\+?88)?01[3-9]\d{8}/);
  return match ? match[0] : '';
}

function detectFacebookLink(text: string): string {
  const match = text.match(/https?:\/\/(www\.)?(facebook\.com|fb\.com|m\.me|messenger\.com)\/\S+/i);
  return match ? match[0].replace(/[)\].,।]+$/, '') : '';
}

function detectAvailableMonth(cleanedText: string, lowerText: string): string {
  let bestIndex = Infinity;
  let bestKey = '';

  for (const [bn, key] of Object.entries(BENGALI_MONTHS)) {
    const index = findStandaloneIndex(cleanedText, bn);
    if (index !== -1 && index < bestIndex) {
      bestIndex = index;
      bestKey = key;
    }
  }

  for (const [en, key] of Object.entries(ENGLISH_MONTHS)) {
    const match = lowerText.match(new RegExp(`\\b${en}\\b`, 'i'));
    if (match && match.index !== undefined && match.index < bestIndex) {
      bestIndex = match.index;
      bestKey = key;
    }
  }

  return (TOLET_MONTHS as readonly string[]).includes(bestKey) ? bestKey : '';
}

function detectAmenities(text: string): string[] {
  const found = new Set<string>();
  if (includesAny(text, ['লিফট', 'lift'])) found.add(TOLET_AMENITIES.LIFT);
  if (includesAny(text, ['জেনারেটর', 'জেনারেটার', 'generator'])) found.add(TOLET_AMENITIES.GENERATOR);
  if (includesAny(text, ['ওয়াইফাই', 'wifi', 'wi-fi'])) found.add(TOLET_AMENITIES.WIFI);
  if (includesAny(text, ['পানির ফিল্টার', 'water filter'])) found.add(TOLET_AMENITIES.WATER_FILTER);
  if (includesAny(text, ['ফ্রিজ', 'fridge', 'refrigerator'])) found.add(TOLET_AMENITIES.FRIDGE);
  if (includesAny(text, ['গ্যাস', 'gas'])) found.add(TOLET_AMENITIES.GAS);
  if (includesAny(text, ['সিসিটিভি', 'সিকিউরিটি', 'cctv', 'security', 'গার্ড'])) found.add(TOLET_AMENITIES.SECURITY);
  if (includesAny(text, ['বুয়া', 'maid'])) found.add(TOLET_AMENITIES.MAID_SERVICE);
  if (includesAny(text, ['ফার্নিচার', 'furnished', 'furniture'])) found.add(TOLET_AMENITIES.FURNISHED);
  if (includesAny(text, ['ডাইনিং', 'dining'])) found.add(TOLET_AMENITIES.DINING_SPACE);
  if (includesAny(text, ['মসজিদ', 'mosque'])) found.add(TOLET_AMENITIES.NEAR_MOSQUE);
  if (includesAny(text, ['খেলার মাঠ', 'মাঠ', 'playground', 'park'])) found.add(TOLET_AMENITIES.NEAR_PLAYGROUND);
  return [...found];
}

function buildTitle(result: {
  listingType: string;
  tenantRestriction: string;
  genderPreference: string;
  isSublet: boolean;
  seatsAvailable: string;
}): string {
  const roomLabel = strings.toLet.types[result.listingType as keyof typeof strings.toLet.types];
  const prefix = result.isSublet ? `${strings.toLet.sublet} ` : '';

  if (result.tenantRestriction === TOLET_TENANT_RESTRICTION.FAMILY) {
    return `${prefix}${roomLabel} — ${strings.toLet.tenantRestriction.FAMILY}`;
  }

  const genderLabel = strings.toLet.genderPreference[result.genderPreference as keyof typeof strings.toLet.genderPreference];
  const seatsPrefix = result.listingType === TOLET_TYPES.SEAT && result.seatsAvailable ? `${result.seatsAvailable} ` : '';
  return `${prefix}${seatsPrefix}${roomLabel} — ${genderLabel} ${strings.toLet.tenantRestriction.BACHELOR}`;
}

export function parseToLetImportText(rawText: string): ToLetImportResult {
  const cleaned = rawText
    .replace(/[♦️►▶✅✔️★☑️]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const lower = cleaned.toLowerCase();
  const normalized = normalizeDigits(lower);

  const listingType = detectListingType(lower);
  const tenantRestriction = detectTenantRestriction(lower);
  const genderPreference = detectGenderPreference(lower);
  const isSublet = includesAny(lower, ['সাবলেট', 'sublet']);
  const seatsAvailable = extractAmount(normalized, ['সিট', 'seat'], 1, 20);

  return {
    title: buildTitle({ listingType, tenantRestriction, genderPreference, isSublet, seatsAvailable }),
    text: cleaned,
    listingType,
    tenantRestriction,
    genderPreference,
    isSublet,
    rent: extractAmount(normalized, ['ভাড়া', 'rent'], 500, 500000),
    advanceMonths: extractAmount(normalized, ['অগ্রিম', 'advance'], 0, 12),
    seatsAvailable,
    availableMonth: detectAvailableMonth(cleaned, lower),
    attachedBath: includesAny(lower, ['ওয়াশরুম', 'বাথরুম', 'attached bath', 'attach bath']),
    attachedBalcony: includesAny(lower, ['বারান্দা', 'balcony']),
    roomCount: extractAmount(normalized, ['বেডরুম', 'বেড রুম', 'bedroom', 'রুম', 'room'], 1, 20),
    balconyCount: extractAmount(normalized, ['বারান্দা', 'balcony'], 0, 10),
    bathroomCount: extractAmount(normalized, ['বাথরুম', 'ওয়াশরুম', 'bathroom', 'washroom'], 0, 10),
    attachedBathroomCount: extractAmount(normalized, ['এটাচ', 'attached bath', 'attach bath'], 0, 10),
    floorNumber: extractAmount(normalized, ['তলা', 'floor'], 0, 100),
    mealsProvided: includesAny(lower, ['মেসের খাবার', 'রান্নার ব্যবস্থা', 'meal provided', 'meals provided']),
    serviceChargeIncluded: includesAny(lower, ['সার্ভিস চার্জ সহ', 'including service charge', 'service charge included']),
    amenities: detectAmenities(lower),
    location: detectLocation(cleaned),
    contactPhone: detectPhone(cleaned),
    contactFacebook: detectFacebookLink(cleaned)
  };
}
