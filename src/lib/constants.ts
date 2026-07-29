export const USER_ROLES = {
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  MEMBER: 'MEMBER'
} as const;

export const USER_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
} as const;

export const INVITATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED'
} as const;

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

/**
 * Everything except BAZAR. Bazar is bought day to day and shared by meal count,
 * so it drives the meal rate; these are periodic bills shared by a fixed rule.
 */
export const BILL_TYPES = [
  { value: EXPENSE_TYPES.RENT, label: 'Rent' },
  { value: EXPENSE_TYPES.ELECTRICITY, label: 'Electricity' },
  { value: EXPENSE_TYPES.WATER, label: 'Water' },
  { value: EXPENSE_TYPES.WASTE, label: 'Waste' },
  { value: EXPENSE_TYPES.CHEF, label: 'Chef' },
  { value: EXPENSE_TYPES.WIFI, label: 'Wi-Fi' },
  { value: EXPENSE_TYPES.OTHER, label: 'Other' }
] as const;

export const BILL_TYPE_VALUES = BILL_TYPES.map((t) => t.value) as string[];

export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  [EXPENSE_TYPES.BAZAR]: 'Bazar',
  ...Object.fromEntries(BILL_TYPES.map((t) => [t.value, t.label]))
};

export const SPLIT_METHODS = {
  /** Split in proportion to meals eaten that month — used by bazar. */
  MEAL: 'MEAL',
  /** Split evenly across the members active when the bill was recorded. */
  EQUAL: 'EQUAL',
  /** Assigned to named members with explicit amounts. */
  CUSTOM: 'CUSTOM'
} as const;

export const SPLIT_METHOD_LABELS: Record<string, string> = {
  [SPLIT_METHODS.MEAL]: 'By meals',
  [SPLIT_METHODS.EQUAL]: 'Split equally',
  [SPLIT_METHODS.CUSTOM]: 'Selected members'
};

export const PAYMENT_STATUS = {
  PAID: 'PAID',
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL'
} as const;

export const WEEKDAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' }
] as const;

export const MEAL_FIELDS = ['breakfast', 'lunch', 'dinner'] as const;
export type MealField = (typeof MEAL_FIELDS)[number];
