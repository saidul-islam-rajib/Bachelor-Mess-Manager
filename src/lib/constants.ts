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
