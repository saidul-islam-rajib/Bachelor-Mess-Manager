const USER_ROLES = { ADMIN: 'ADMIN', SUPERVISOR: 'SUPERVISOR', MEMBER: 'MEMBER' };

const PERMISSION_CATEGORIES = {
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
};

const PERMISSION_DEFINITIONS = [
  { code: 'user.view', name: 'View users', description: 'List and search registered accounts', category: PERMISSION_CATEGORIES.USERS },
  { code: 'user.approve', name: 'Approve users', description: 'Approve or reject pending registrations', category: PERMISSION_CATEGORIES.USERS },
  { code: 'user.update', name: 'Update users', description: 'Edit account details', category: PERMISSION_CATEGORIES.USERS },
  { code: 'user.assign_role', name: 'Assign roles', description: 'Change a user role', category: PERMISSION_CATEGORIES.USERS },

  { code: 'group.view', name: 'View groups', description: 'See groups and their details', category: PERMISSION_CATEGORIES.GROUPS },
  { code: 'group.create', name: 'Create groups', description: 'Create a new mess group', category: PERMISSION_CATEGORIES.GROUPS },
  { code: 'group.update', name: 'Update groups', description: 'Edit group settings and meal weights', category: PERMISSION_CATEGORIES.GROUPS },
  { code: 'group.delete', name: 'Delete groups', description: 'Remove a group', category: PERMISSION_CATEGORIES.GROUPS },

  { code: 'membership.view', name: 'View members', description: 'See the roster and stay history', category: PERMISSION_CATEGORIES.MEMBERSHIPS },
  { code: 'membership.invite', name: 'Invite members', description: 'Send group invitations', category: PERMISSION_CATEGORIES.MEMBERSHIPS },
  { code: 'membership.add', name: 'Add members', description: 'Add a member to a group directly', category: PERMISSION_CATEGORIES.MEMBERSHIPS },
  { code: 'membership.remove', name: 'Remove members', description: 'Remove or deactivate a member', category: PERMISSION_CATEGORIES.MEMBERSHIPS },
  { code: 'membership.leave', name: 'Leave a group', description: 'Leave the group you belong to', category: PERMISSION_CATEGORIES.MEMBERSHIPS },

  { code: 'meal.view', name: 'View meals', description: 'See the monthly meal table', category: PERMISSION_CATEGORIES.MEALS },
  { code: 'meal.record_own', name: 'Record own meals', description: 'Enter your own meal counts', category: PERMISSION_CATEGORIES.MEALS },
  { code: 'meal.record_any', name: 'Record any meals', description: 'Adjust meal counts for any member', category: PERMISSION_CATEGORIES.MEALS },
  { code: 'meal.plan_manage', name: 'Manage meal plans', description: 'Create repeating weekly meal plans', category: PERMISSION_CATEGORIES.MEALS },

  { code: 'expense.view', name: 'View bazar', description: 'See grocery purchases', category: PERMISSION_CATEGORIES.EXPENSES },
  { code: 'expense.create', name: 'Record bazar', description: 'Log a grocery purchase', category: PERMISSION_CATEGORIES.EXPENSES },
  { code: 'expense.update_own', name: 'Edit own bazar', description: 'Edit purchases you recorded', category: PERMISSION_CATEGORIES.EXPENSES },
  { code: 'expense.update_any', name: 'Edit any bazar', description: 'Edit any purchase in the group', category: PERMISSION_CATEGORIES.EXPENSES },

  { code: 'bill.view', name: 'View bills', description: 'See rent, utilities and other costs', category: PERMISSION_CATEGORIES.BILLS },
  { code: 'bill.manage', name: 'Manage bills', description: 'Record, edit and split bills', category: PERMISSION_CATEGORIES.BILLS },

  { code: 'payment.view', name: 'View payments', description: 'See balances and payments received', category: PERMISSION_CATEGORIES.PAYMENTS },
  { code: 'payment.record', name: 'Record payments', description: 'Record money received from a member', category: PERMISSION_CATEGORIES.PAYMENTS },

  { code: 'comment.view', name: 'View comments', description: 'Read group messages', category: PERMISSION_CATEGORIES.COMMENTS },
  { code: 'comment.create', name: 'Post comments', description: 'Post messages and replies', category: PERMISSION_CATEGORIES.COMMENTS },
  { code: 'comment.delete_own', name: 'Delete own comments', description: 'Delete your own messages', category: PERMISSION_CATEGORIES.COMMENTS },
  { code: 'comment.delete_any', name: 'Delete any comment', description: 'Delete any message in the group', category: PERMISSION_CATEGORIES.COMMENTS },

  { code: 'settings.view', name: 'View settings', description: 'Read site settings', category: PERMISSION_CATEGORIES.SETTINGS },
  { code: 'settings.update', name: 'Update settings', description: 'Change site settings', category: PERMISSION_CATEGORIES.SETTINGS },
  { code: 'security.manage', name: 'Manage security', description: 'Change security policy and unlock accounts', category: PERMISSION_CATEGORIES.SETTINGS },

  { code: 'report.view_own', name: 'View own reports', description: 'See your own dashboard', category: PERMISSION_CATEGORIES.REPORTS },
  { code: 'report.view_group', name: 'View group reports', description: 'See reports for groups you run', category: PERMISSION_CATEGORIES.REPORTS },
  { code: 'report.view_all', name: 'View all reports', description: 'See system-wide reports', category: PERMISSION_CATEGORIES.REPORTS }
];

const MEMBER_PERMISSIONS = [
  'group.view',
  'membership.view',
  'membership.leave',
  'meal.view',
  'meal.record_own',
  'meal.plan_manage',
  'expense.view',
  'expense.create',
  'expense.update_own',
  'bill.view',
  'payment.view',
  'comment.view',
  'comment.create',
  'comment.delete_own',
  'settings.view',
  'report.view_own'
];

const SUPERVISOR_PERMISSIONS = [
  ...MEMBER_PERMISSIONS,
  'group.create',
  'group.update',
  'membership.invite',
  'membership.remove',
  'bill.manage',
  'payment.record',
  'comment.delete_any',
  'report.view_group'
];

const ADMIN_PERMISSIONS = PERMISSION_DEFINITIONS.map((definition) => definition.code);

const ROLE_DEFINITIONS = [
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
];

async function syncRolesAndPermissions(prisma) {
  const now = new Date();

  for (const role of ROLE_DEFINITIONS) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description, rank: role.rank, isSystem: true },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        rank: role.rank,
        isSystem: true,
        publishedAt: now
      }
    });
  }

  for (const permission of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { name: permission.name, description: permission.description, category: permission.category },
      create: { ...permission, publishedAt: now }
    });
  }

  let assignments = 0;
  for (const role of ROLE_DEFINITIONS) {
    const desired = new Set(role.permissions);

    const existing = await prisma.rolePermission.findMany({
      where: { roleCode: role.code },
      select: { id: true, permissionCode: true }
    });
    const existingCodes = new Set(existing.map((row) => row.permissionCode));

    const toCreate = [...desired].filter((code) => !existingCodes.has(code));
    if (toCreate.length > 0) {
      await prisma.rolePermission.createMany({
        data: toCreate.map((permissionCode) => ({ roleCode: role.code, permissionCode, publishedAt: now }))
      });
    }

    const toRemove = existing.filter((row) => !desired.has(row.permissionCode)).map((row) => row.id);
    if (toRemove.length > 0) {
      await prisma.rolePermission.deleteMany({ where: { id: { in: toRemove } } });
    }

    assignments += desired.size;
  }

  return { roles: ROLE_DEFINITIONS.length, permissions: PERMISSION_DEFINITIONS.length, assignments };
}

module.exports = {
  USER_ROLES,
  PERMISSION_CATEGORIES,
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
  syncRolesAndPermissions
};
