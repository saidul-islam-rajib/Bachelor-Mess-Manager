export const APP_TITLE = 'Mess Management';

export const ROUTES = {
  home: '/',
  login: '/auth/login',
  register: '/auth/register',
  dashboard: '/dashboard',
  profile: '/profile',
  meals: '/meals',
  expenses: '/expenses',
  payments: '/payments',
  members: '/members',
  comments: '/comments'
};

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
