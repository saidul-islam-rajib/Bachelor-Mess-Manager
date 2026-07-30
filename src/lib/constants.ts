import { strings } from '@/lib/i18n';

export const USER_ROLES = {
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  MEMBER: 'MEMBER'
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_ROLE_VALUES = Object.values(USER_ROLES) as string[];

export const ASSIGNABLE_ROLES = [USER_ROLES.SUPERVISOR, USER_ROLES.MEMBER] as string[];

export const USER_STATUS = {
  UNVERIFIED: 'UNVERIFIED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const USER_STATUS_VALUES = Object.values(USER_STATUS) as string[];

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

export const BILL_TYPES = BILL_TYPE_VALUES.map((value) => ({
  value,
  label: strings.expenseTypes[value as keyof typeof strings.expenseTypes]
}));

export const EXPENSE_TYPE_LABELS: Record<string, string> = strings.expenseTypes;

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
  PARTIAL: 'PARTIAL'
} as const;

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
