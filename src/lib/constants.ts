import { strings } from '@/lib/i18n';

export const USER_ROLES = {
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  MEMBER: 'MEMBER'
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_ROLE_VALUES = Object.values(USER_ROLES) as string[];

export const USER_STATUS = {
  UNVERIFIED: 'UNVERIFIED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const USER_STATUS_VALUES = Object.values(USER_STATUS) as string[];

export const THEME_OPTIONS = {
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark'
} as const;

export type ThemeOption = (typeof THEME_OPTIONS)[keyof typeof THEME_OPTIONS];

export const THEME_OPTION_VALUES = Object.values(THEME_OPTIONS) as string[];

export const GROUP_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE'
} as const;

export const GROUP_STATUS_VALUES = Object.values(GROUP_STATUS) as string[];

export const INVITATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED'
} as const;

export const INVITATION_STATUS_VALUES = Object.values(INVITATION_STATUS) as string[];

export const NOTIFICATION_TYPES = {
  MENTION_COMMENT: 'MENTION_COMMENT',
  MENTION_REPLY: 'MENTION_REPLY',
  MENTION_EXPENSE_COMMENT: 'MENTION_EXPENSE_COMMENT',
  MEAL_CHANGED_BY_SUPERVISOR: 'MEAL_CHANGED_BY_SUPERVISOR',
  MEAL_CHANGE_REQUESTED: 'MEAL_CHANGE_REQUESTED',
  MEAL_CHANGE_APPROVED: 'MEAL_CHANGE_APPROVED',
  MEAL_CHANGE_REJECTED: 'MEAL_CHANGE_REJECTED',
  MONTH_CLOSED: 'MONTH_CLOSED',
  MONTH_REOPENED: 'MONTH_REOPENED',
  MENTION_COMMUNITY: 'MENTION_COMMUNITY',
  COMMUNITY_ANNOUNCEMENT: 'COMMUNITY_ANNOUNCEMENT',
  COMMUNITY_WELCOME: 'COMMUNITY_WELCOME',
  COMMUNITY_COMMENT: 'COMMUNITY_COMMENT',
  MEAL_PROMPT: 'MEAL_PROMPT',
  SUPERVISOR_CHANGED: 'SUPERVISOR_CHANGED'
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPES) as string[];

export const COMMUNITY_MESSAGE_TYPES = {
  MEMBER: 'MEMBER',
  TOLET: 'TOLET',
  WELCOME: 'WELCOME',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  SYSTEM: 'SYSTEM'
} as const;

export type CommunityMessageType = (typeof COMMUNITY_MESSAGE_TYPES)[keyof typeof COMMUNITY_MESSAGE_TYPES];

export const COMMUNITY_MESSAGE_TYPE_VALUES = Object.values(COMMUNITY_MESSAGE_TYPES) as string[];

export const COMMUNITY_INTERACTIVE_TYPES: string[] = [COMMUNITY_MESSAGE_TYPES.MEMBER, COMMUNITY_MESSAGE_TYPES.TOLET];

export const COMMUNITY_SYSTEM_TYPES: string[] = COMMUNITY_MESSAGE_TYPE_VALUES.filter(
  (type) => !COMMUNITY_INTERACTIVE_TYPES.includes(type)
);

export const TOLET_TYPES = {
  MASTER_BED: 'MASTER_BED',
  SEMI_MASTER: 'SEMI_MASTER',
  SINGLE_ROOM: 'SINGLE_ROOM',
  ROOM: 'ROOM',
  SEAT: 'SEAT',
  FLAT: 'FLAT'
} as const;

export type ToLetType = (typeof TOLET_TYPES)[keyof typeof TOLET_TYPES];

export const TOLET_TYPE_VALUES = Object.values(TOLET_TYPES) as string[];

export const TOLET_STATUS = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED'
} as const;

export type ToLetStatus = (typeof TOLET_STATUS)[keyof typeof TOLET_STATUS];

export const TOLET_STATUS_VALUES = Object.values(TOLET_STATUS) as string[];

export const TOLET_GENDER_PREFERENCE = {
  MALE: 'MALE',
  FEMALE: 'FEMALE'
} as const;

export type ToLetGenderPreference = (typeof TOLET_GENDER_PREFERENCE)[keyof typeof TOLET_GENDER_PREFERENCE];

export const TOLET_GENDER_PREFERENCE_VALUES = Object.values(TOLET_GENDER_PREFERENCE) as string[];

export const TOLET_TENANT_RESTRICTION = {
  ANY: 'ANY',
  BACHELOR: 'BACHELOR',
  FAMILY: 'FAMILY'
} as const;

export type ToLetTenantRestriction = (typeof TOLET_TENANT_RESTRICTION)[keyof typeof TOLET_TENANT_RESTRICTION];

export const TOLET_TENANT_RESTRICTION_VALUES = Object.values(TOLET_TENANT_RESTRICTION) as string[];

export const TOLET_CATEGORY_VALUES: string[] = [TOLET_TENANT_RESTRICTION.BACHELOR, TOLET_TENANT_RESTRICTION.FAMILY];

export const TOLET_HOUSE_RULES = {
  STRICT: 'STRICT',
  FLEXIBLE: 'FLEXIBLE'
} as const;

export type ToLetHouseRules = (typeof TOLET_HOUSE_RULES)[keyof typeof TOLET_HOUSE_RULES];

export const TOLET_HOUSE_RULES_VALUES = Object.values(TOLET_HOUSE_RULES) as string[];

export const TOLET_AMENITIES = {
  FURNISHED: 'FURNISHED',
  LIFT: 'LIFT',
  GENERATOR: 'GENERATOR',
  WIFI: 'WIFI',
  WATER_FILTER: 'WATER_FILTER',
  FRIDGE: 'FRIDGE',
  GAS: 'GAS',
  SECURITY: 'SECURITY',
  MAID_SERVICE: 'MAID_SERVICE',
  DINING_SPACE: 'DINING_SPACE',
  NEAR_MOSQUE: 'NEAR_MOSQUE',
  NEAR_PLAYGROUND: 'NEAR_PLAYGROUND'
} as const;

export type ToLetAmenity = (typeof TOLET_AMENITIES)[keyof typeof TOLET_AMENITIES];

export const TOLET_AMENITY_VALUES = Object.values(TOLET_AMENITIES) as string[];

export const TOLET_POST_LAYOUTS = {
  SIGNBOARD: 'SIGNBOARD',
  WALKTHROUGH: 'WALKTHROUGH'
} as const;

export type ToLetPostLayout = (typeof TOLET_POST_LAYOUTS)[keyof typeof TOLET_POST_LAYOUTS];

export const TOLET_POST_LAYOUT_VALUES = Object.values(TOLET_POST_LAYOUTS) as string[];

export const TOLET_MONTHS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER'
] as const;

export type ToLetMonth = (typeof TOLET_MONTHS)[number];

export const MEAL_PROMPT_ANSWERS = {
  YES: 'YES',
  NO: 'NO',
  CUSTOM: 'CUSTOM'
} as const;

export type MealPromptAnswer = (typeof MEAL_PROMPT_ANSWERS)[keyof typeof MEAL_PROMPT_ANSWERS];

export const MEAL_PROMPT_ANSWER_VALUES = Object.values(MEAL_PROMPT_ANSWERS) as string[];

export const MEAL_PROMPT_CHANNELS = {
  EMAIL: 'EMAIL',
  IN_APP: 'IN_APP'
} as const;

export type MealPromptChannel = (typeof MEAL_PROMPT_CHANNELS)[keyof typeof MEAL_PROMPT_CHANNELS];

export const EXPENSE_TYPES = {
  BAZAR: 'BAZAR',
  RENT: 'RENT',
  ELECTRICITY: 'ELECTRICITY',
  WATER: 'WATER',
  WASTE: 'WASTE',
  CHEF: 'CHEF',
  WIFI: 'WIFI',
  OTHER: 'OTHER'
} as const;

export type ExpenseType = (typeof EXPENSE_TYPES)[keyof typeof EXPENSE_TYPES];

export const BILL_TYPE_VALUES: string[] = Object.values(EXPENSE_TYPES).filter(
  (type) => type !== EXPENSE_TYPES.BAZAR
);

export const BILL_TYPE_FILTER = { not: EXPENSE_TYPES.BAZAR } as const;

export const BILL_TYPES = BILL_TYPE_VALUES.map((value) => ({
  value,
  label: strings.expenseTypes[value as keyof typeof strings.expenseTypes]
}));

export const EXPENSE_TYPE_LABELS: Record<string, string> = strings.expenseTypes;

export function expenseTypeLabel(code: string): string {
  const known = EXPENSE_TYPE_LABELS[code];
  if (known) return known;

  return code
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export const SPLIT_METHODS = {
  MEAL: 'MEAL',
  EQUAL: 'EQUAL',
  CUSTOM: 'CUSTOM'
} as const;

export const BILL_SPLIT_METHODS = [SPLIT_METHODS.EQUAL, SPLIT_METHODS.CUSTOM] as string[];

export const SPLIT_METHOD_LABELS: Record<string, string> = strings.splitMethods;

export const PAYMENT_STATUS = {
  PAID: 'PAID',
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  REFUND: 'REFUND',
  OFFSET: 'OFFSET'
} as const;

export const MEAL_RATE_MODES = {
  MONTHLY: 'MONTHLY',
  DAILY: 'DAILY'
} as const;

export const MEAL_RATE_MODE_VALUES = Object.values(MEAL_RATE_MODES) as string[];

export const REQUEST_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
} as const;

export const MEAL_EDIT_WINDOW_UNLIMITED = 0;

export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS) as string[];

export const EXPENSE_ACTIONS = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED'
} as const;

export const WEEKDAYS = Object.entries(strings.weekdays).map(([value, labels]) => ({
  value: Number(value),
  label: labels.label,
  short: labels.short
}));

export const MEAL_FIELDS = ['breakfast', 'lunch', 'dinner'] as const;
export type MealField = (typeof MEAL_FIELDS)[number];

export const SETTINGS_SINGLETON_ID = 'singleton';

export const SORT_DIRECTIONS = {
  ASC: 'asc',
  DESC: 'desc'
} as const;

export const USER_SORT_FIELDS = ['createdAt', 'name', 'email', 'lastLoginAt', 'role', 'status'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export const GROUP_SORT_FIELDS = ['createdAt', 'name', 'status'] as const;
export type GroupSortField = (typeof GROUP_SORT_FIELDS)[number];
