import { TOLET_AMENITIES, TOLET_GENDER_PREFERENCE, TOLET_TENANT_RESTRICTION, TOLET_TYPES } from '@/lib/constants';

export type ToLetImportResult = {
  text: string;
  listingType: string;
  tenantRestriction: string;
  genderPreference: string;
  isSublet: boolean;
  rent: string;
  advanceMonths: string;
  attachedBath: boolean;
  attachedBalcony: boolean;
  mealsProvided: boolean;
  serviceChargeIncluded: boolean;
  amenities: string[];
  location: string;
  contactPhone: string;
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

function normalizeDigits(value: string): string {
  return value.replace(/[০-৯]/g, (digit) => BENGALI_DIGITS[digit] ?? digit);
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function firstNumberNear(text: string, keywords: string[], min: number, max: number): string {
  const normalized = normalizeDigits(text);
  for (const keyword of keywords) {
    const index = normalized.toLowerCase().indexOf(keyword);
    if (index === -1) continue;

    const window = normalized.slice(index, index + keyword.length + 30);
    const match = window.match(/[\d,]{3,}/);
    if (match) {
      const value = Number(match[0].replace(/,/g, ''));
      if (Number.isFinite(value) && value >= min && value <= max) return String(value);
    }
  }
  return '';
}

function detectListingType(text: string): string {
  if (includesAny(text, ['মাস্টার বেড', 'master bed'])) return TOLET_TYPES.MASTER_BED;
  if (includesAny(text, ['সেমি মাস্টার', 'semi master', 'semi-master'])) return TOLET_TYPES.SEMI_MASTER;
  if (includesAny(text, ['সিঙ্গেল রুম', 'single room'])) return TOLET_TYPES.SINGLE_ROOM;
  if (includesAny(text, ['ফ্ল্যাট', 'apartment', 'flat'])) return TOLET_TYPES.FLAT;
  if (/\bসিট\b|\bseat\b/.test(text)) return TOLET_TYPES.SEAT;
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
  return [...found];
}

export function parseToLetImportText(rawText: string): ToLetImportResult {
  const cleaned = rawText
    .replace(/[♦️►▶✅✔️★☑️]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const lower = cleaned.toLowerCase();

  const tenantRestriction = detectTenantRestriction(lower);

  return {
    text: cleaned,
    listingType: detectListingType(lower),
    tenantRestriction,
    genderPreference: detectGenderPreference(lower),
    isSublet: includesAny(lower, ['সাবলেট', 'sublet']),
    rent: firstNumberNear(lower, ['ভাড়া', 'rent', '৳', 'taka', 'টাকা'], 500, 500000),
    advanceMonths: firstNumberNear(lower, ['অগ্রিম', 'advance'], 0, 12),
    attachedBath: includesAny(lower, ['ওয়াশরুম', 'বাথরুম', 'attached bath', 'attach bath']),
    attachedBalcony: includesAny(lower, ['বারান্দা', 'balcony']),
    mealsProvided: includesAny(lower, ['মেসের খাবার', 'রান্নার ব্যবস্থা', 'meal provided', 'meals provided']),
    serviceChargeIncluded: includesAny(lower, ['সার্ভিস চার্জ সহ', 'including service charge', 'service charge included']),
    amenities: detectAmenities(lower),
    location: detectLocation(cleaned),
    contactPhone: detectPhone(cleaned)
  };
}
