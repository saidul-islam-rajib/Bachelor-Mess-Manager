import { USER_ROLES } from '@/lib/constants';

export const PERMISSION_CATEGORIES = {
  USERS: 'USERS',
  GROUPS: 'GROUPS',
  MEMBERSHIPS: 'MEMBERSHIPS',
  MEALS: 'MEALS',
  EXPENSES: 'EXPENSES',
  BILLS: 'BILLS',
  PAYMENTS: 'PAYMENTS',
  COMMENTS: 'COMMENTS',
  SETTINGS: 'SETTINGS',
  REPORTS: 'REPORTS'
} as const;

export const PERMISSIONS = {
  USER_VIEW: 'user.view',
  USER_APPROVE: 'user.approve',
  USER_UPDATE: 'user.update',
  USER_ASSIGN_ROLE: 'user.assign_role',
  GROUP_VIEW: 'group.view',
  GROUP_CREATE: 'group.create',
  GROUP_UPDATE: 'group.update',
  GROUP_DELETE: 'group.delete',
  MEMBERSHIP_VIEW: 'membership.view',
  MEMBERSHIP_INVITE: 'membership.invite',
  MEMBERSHIP_ADD: 'membership.add',
  MEMBERSHIP_REMOVE: 'membership.remove',
  MEMBERSHIP_LEAVE: 'membership.leave',
  MEAL_VIEW: 'meal.view',
  MEAL_RECORD_OWN: 'meal.record_own',
  MEAL_RECORD_ANY: 'meal.record_any',
  MEAL_PLAN_MANAGE: 'meal.plan_manage',
  EXPENSE_VIEW: 'expense.view',
  EXPENSE_CREATE: 'expense.create',
  EXPENSE_UPDATE_OWN: 'expense.update_own',
  EXPENSE_UPDATE_ANY: 'expense.update_any',
  BILL_VIEW: 'bill.view',
  BILL_MANAGE: 'bill.manage',
  PAYMENT_VIEW: 'payment.view',
  PAYMENT_RECORD: 'payment.record',
  PAYMENT_RECORD_OWN: 'payment.record_own',
  COMMENT_VIEW: 'comment.view',
  COMMENT_CREATE: 'comment.create',
  COMMENT_DELETE_OWN: 'comment.delete_own',
  COMMENT_DELETE_ANY: 'comment.delete_any',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_UPDATE: 'settings.update',
  SECURITY_MANAGE: 'security.manage',
  REPORT_VIEW_OWN: 'report.view_own',
  REPORT_VIEW_GROUP: 'report.view_group',
  REPORT_VIEW_ALL: 'report.view_all'
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

type PermissionDefinition = {
  code: PermissionCode;
  name: string;
  description: string;
  category: string;
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { code: PERMISSIONS.USER_VIEW, name: 'View users', description: 'List and search registered accounts', category: PERMISSION_CATEGORIES.USERS },
  { code: PERMISSIONS.USER_APPROVE, name: 'Approve users', description: 'Approve or reject pending registrations', category: PERMISSION_CATEGORIES.USERS },
  { code: PERMISSIONS.USER_UPDATE, name: 'Update users', description: 'Edit account details', category: PERMISSION_CATEGORIES.USERS },
  { code: PERMISSIONS.USER_ASSIGN_ROLE, name: 'Assign roles', description: 'Change a user role', category: PERMISSION_CATEGORIES.USERS },

  { code: PERMISSIONS.GROUP_VIEW, name: 'View groups', description: 'See groups and their details', category: PERMISSION_CATEGORIES.GROUPS },
  { code: PERMISSIONS.GROUP_CREATE, name: 'Create groups', description: 'Create a new mess group', category: PERMISSION_CATEGORIES.GROUPS },
  { code: PERMISSIONS.GROUP_UPDATE, name: 'Update groups', description: 'Edit group settings and meal weights', category: PERMISSION_CATEGORIES.GROUPS },
  { code: PERMISSIONS.GROUP_DELETE, name: 'Delete groups', description: 'Remove a group', category: PERMISSION_CATEGORIES.GROUPS },

  { code: PERMISSIONS.MEMBERSHIP_VIEW, name: 'View members', description: 'See the roster and stay history', category: PERMISSION_CATEGORIES.MEMBERSHIPS },
  { code: PERMISSIONS.MEMBERSHIP_INVITE, name: 'Invite members', description: 'Send group invitations', category: PERMISSION_CATEGORIES.MEMBERSHIPS },
  { code: PERMISSIONS.MEMBERSHIP_ADD, name: 'Add members', description: 'Add a member to a group directly', category: PERMISSION_CATEGORIES.MEMBERSHIPS },
  { code: PERMISSIONS.MEMBERSHIP_REMOVE, name: 'Remove members', description: 'Remove or deactivate a member', category: PERMISSION_CATEGORIES.MEMBERSHIPS },
  { code: PERMISSIONS.MEMBERSHIP_LEAVE, name: 'Leave a group', description: 'Leave the group you belong to', category: PERMISSION_CATEGORIES.MEMBERSHIPS },

  { code: PERMISSIONS.MEAL_VIEW, name: 'View meals', description: 'See the monthly meal table', category: PERMISSION_CATEGORIES.MEALS },
  { code: PERMISSIONS.MEAL_RECORD_OWN, name: 'Record own meals', description: 'Enter your own meal counts', category: PERMISSION_CATEGORIES.MEALS },
  { code: PERMISSIONS.MEAL_RECORD_ANY, name: 'Record any meals', description: 'Adjust meal counts for any member', category: PERMISSION_CATEGORIES.MEALS },
  { code: PERMISSIONS.MEAL_PLAN_MANAGE, name: 'Manage meal plans', description: 'Create repeating weekly meal plans', category: PERMISSION_CATEGORIES.MEALS },

  { code: PERMISSIONS.EXPENSE_VIEW, name: 'View bazar', description: 'See grocery purchases', category: PERMISSION_CATEGORIES.EXPENSES },
  { code: PERMISSIONS.EXPENSE_CREATE, name: 'Record bazar', description: 'Log a grocery purchase', category: PERMISSION_CATEGORIES.EXPENSES },
  { code: PERMISSIONS.EXPENSE_UPDATE_OWN, name: 'Edit own bazar', description: 'Edit purchases you recorded', category: PERMISSION_CATEGORIES.EXPENSES },
  { code: PERMISSIONS.EXPENSE_UPDATE_ANY, name: 'Edit any bazar', description: 'Edit any purchase in the group', category: PERMISSION_CATEGORIES.EXPENSES },

  { code: PERMISSIONS.BILL_VIEW, name: 'View bills', description: 'See rent, utilities and other costs', category: PERMISSION_CATEGORIES.BILLS },
  { code: PERMISSIONS.BILL_MANAGE, name: 'Manage bills', description: 'Record, edit and split bills', category: PERMISSION_CATEGORIES.BILLS },

  { code: PERMISSIONS.PAYMENT_VIEW, name: 'View payments', description: 'See balances and payments received', category: PERMISSION_CATEGORIES.PAYMENTS },
  { code: PERMISSIONS.PAYMENT_RECORD, name: 'Record payments', description: 'Record money received from any member', category: PERMISSION_CATEGORIES.PAYMENTS },
  { code: PERMISSIONS.PAYMENT_RECORD_OWN, name: 'Record own bill payments', description: 'Mark your own bill share as paid, optionally noting who you paid directly', category: PERMISSION_CATEGORIES.PAYMENTS },

  { code: PERMISSIONS.COMMENT_VIEW, name: 'View comments', description: 'Read group messages', category: PERMISSION_CATEGORIES.COMMENTS },
  { code: PERMISSIONS.COMMENT_CREATE, name: 'Post comments', description: 'Post messages and replies', category: PERMISSION_CATEGORIES.COMMENTS },
  { code: PERMISSIONS.COMMENT_DELETE_OWN, name: 'Delete own comments', description: 'Delete your own messages', category: PERMISSION_CATEGORIES.COMMENTS },
  { code: PERMISSIONS.COMMENT_DELETE_ANY, name: 'Delete any comment', description: 'Delete any message in the group', category: PERMISSION_CATEGORIES.COMMENTS },

  { code: PERMISSIONS.SETTINGS_VIEW, name: 'View settings', description: 'Read site settings', category: PERMISSION_CATEGORIES.SETTINGS },
  { code: PERMISSIONS.SETTINGS_UPDATE, name: 'Update settings', description: 'Change site settings', category: PERMISSION_CATEGORIES.SETTINGS },
  { code: PERMISSIONS.SECURITY_MANAGE, name: 'Manage security', description: 'Change security policy and unlock accounts', category: PERMISSION_CATEGORIES.SETTINGS },

  { code: PERMISSIONS.REPORT_VIEW_OWN, name: 'View own reports', description: 'See your own dashboard', category: PERMISSION_CATEGORIES.REPORTS },
  { code: PERMISSIONS.REPORT_VIEW_GROUP, name: 'View group reports', description: 'See reports for groups you run', category: PERMISSION_CATEGORIES.REPORTS },
  { code: PERMISSIONS.REPORT_VIEW_ALL, name: 'View all reports', description: 'See system-wide reports', category: PERMISSION_CATEGORIES.REPORTS }
];

const MEMBER_PERMISSIONS: PermissionCode[] = [
  PERMISSIONS.GROUP_VIEW,
  PERMISSIONS.MEMBERSHIP_VIEW,
  PERMISSIONS.MEMBERSHIP_LEAVE,
  PERMISSIONS.MEAL_VIEW,
  PERMISSIONS.MEAL_RECORD_OWN,
  PERMISSIONS.MEAL_PLAN_MANAGE,
  PERMISSIONS.EXPENSE_VIEW,
  PERMISSIONS.EXPENSE_CREATE,
  PERMISSIONS.EXPENSE_UPDATE_OWN,
  PERMISSIONS.BILL_VIEW,
  PERMISSIONS.PAYMENT_VIEW,
  PERMISSIONS.PAYMENT_RECORD_OWN,
  PERMISSIONS.COMMENT_VIEW,
  PERMISSIONS.COMMENT_CREATE,
  PERMISSIONS.COMMENT_DELETE_OWN,
  PERMISSIONS.SETTINGS_VIEW,
  PERMISSIONS.REPORT_VIEW_OWN
];

const SUPERVISOR_PERMISSIONS: PermissionCode[] = [
  ...MEMBER_PERMISSIONS,
  PERMISSIONS.GROUP_CREATE,
  PERMISSIONS.GROUP_UPDATE,
  PERMISSIONS.MEMBERSHIP_INVITE,
  PERMISSIONS.MEMBERSHIP_REMOVE,
  PERMISSIONS.BILL_MANAGE,
  PERMISSIONS.PAYMENT_RECORD,
  PERMISSIONS.COMMENT_DELETE_ANY,
  PERMISSIONS.REPORT_VIEW_GROUP
];

const ADMIN_PERMISSIONS: PermissionCode[] = PERMISSION_DEFINITIONS.map((definition) => definition.code);

export const ROLE_DEFINITIONS = [
  {
    code: USER_ROLES.ADMIN,
    name: 'Administrator',
    description: 'Full access to every part of the system',
    rank: 100,
    permissions: ADMIN_PERMISSIONS
  },
  {
    code: USER_ROLES.SUPERVISOR,
    name: 'Supervisor',
    description: 'Runs one or more mess groups',
    rank: 50,
    permissions: SUPERVISOR_PERMISSIONS
  },
  {
    code: USER_ROLES.MEMBER,
    name: 'Member',
    description: 'Belongs to a single mess group',
    rank: 10,
    permissions: MEMBER_PERMISSIONS
  }
] as const;

const PERMISSIONS_BY_ROLE: Record<string, ReadonlySet<string>> = Object.fromEntries(
  ROLE_DEFINITIONS.map((role) => [role.code, new Set<string>(role.permissions)])
);

export function permissionsForRole(role: string): string[] {
  return [...(PERMISSIONS_BY_ROLE[role] ?? new Set<string>())];
}

export function roleHasPermission(role: string | null | undefined, permission: PermissionCode): boolean {
  if (!role) return false;
  return PERMISSIONS_BY_ROLE[role]?.has(permission) ?? false;
}

export type PermissionSubject = { role?: string; permissions?: string[] | null };

export function hasPermission(user: PermissionSubject | null | undefined, permission: PermissionCode): boolean {
  if (!user) return false;
  if (Array.isArray(user.permissions)) return user.permissions.includes(permission);
  return roleHasPermission(user.role, permission);
}

export function hasEveryPermission(
  user: PermissionSubject | null | undefined,
  permissions: PermissionCode[]
): boolean {
  return permissions.every((permission) => hasPermission(user, permission));
}

export function hasAnyPermission(
  user: PermissionSubject | null | undefined,
  permissions: PermissionCode[]
): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}
