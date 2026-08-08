import { prisma } from '@/lib/prisma';
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS } from '@/lib/permissions';

export type RoleSyncResult = {
  roles: number;
  permissions: number;
  assignments: number;
};

export async function syncRolesAndPermissions(): Promise<RoleSyncResult> {
  const now = new Date();

  const [existingRoles, existingPermissions, existingAssignments] = await Promise.all([
    prisma.role.findMany({ select: { code: true, name: true, description: true, rank: true, isSystem: true } }),
    prisma.permission.findMany({ select: { code: true, name: true, description: true, category: true } }),
    prisma.rolePermission.findMany({
      where: { roleCode: { in: ROLE_DEFINITIONS.map((role) => role.code) } },
      select: { id: true, roleCode: true, permissionCode: true }
    })
  ]);

  const roleByCode = new Map(existingRoles.map((row) => [row.code, row]));
  const staleRoles = ROLE_DEFINITIONS.filter((role) => {
    const current = roleByCode.get(role.code);
    return (
      !current ||
      current.name !== role.name ||
      current.description !== role.description ||
      current.rank !== role.rank ||
      !current.isSystem
    );
  });

  for (const role of staleRoles) {
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

  const permissionByCode = new Map(existingPermissions.map((row) => [row.code, row]));
  const stalePermissions = PERMISSION_DEFINITIONS.filter((permission) => {
    const current = permissionByCode.get(permission.code);
    return (
      !current ||
      current.name !== permission.name ||
      current.description !== permission.description ||
      current.category !== permission.category
    );
  });

  for (const permission of stalePermissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { name: permission.name, description: permission.description, category: permission.category },
      create: {
        code: permission.code,
        name: permission.name,
        description: permission.description,
        category: permission.category,
        publishedAt: now
      }
    });
  }

  const assignmentsByRole = new Map<string, { id: string; permissionCode: string }[]>();
  for (const row of existingAssignments) {
    const list = assignmentsByRole.get(row.roleCode);
    if (list) list.push(row);
    else assignmentsByRole.set(row.roleCode, [row]);
  }

  const toCreate: { roleCode: string; permissionCode: string; publishedAt: Date }[] = [];
  const toRemove: string[] = [];
  let assignments = 0;

  for (const role of ROLE_DEFINITIONS) {
    const desired = new Set<string>(role.permissions);
    const existing = assignmentsByRole.get(role.code) ?? [];
    const existingCodes = new Set(existing.map((row) => row.permissionCode));

    for (const permissionCode of desired) {
      if (!existingCodes.has(permissionCode)) toCreate.push({ roleCode: role.code, permissionCode, publishedAt: now });
    }
    for (const row of existing) {
      if (!desired.has(row.permissionCode)) toRemove.push(row.id);
    }

    assignments += desired.size;
  }

  if (toCreate.length > 0) {
    await prisma.rolePermission.createMany({ data: toCreate });
  }
  if (toRemove.length > 0) {
    await prisma.rolePermission.deleteMany({ where: { id: { in: toRemove } } });
  }

  return {
    roles: ROLE_DEFINITIONS.length,
    permissions: PERMISSION_DEFINITIONS.length,
    assignments
  };
}
