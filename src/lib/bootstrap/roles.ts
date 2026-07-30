import { prisma } from '@/lib/prisma';
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS } from '@/lib/permissions';

export type RoleSyncResult = {
  roles: number;
  permissions: number;
  assignments: number;
};

export async function syncRolesAndPermissions(): Promise<RoleSyncResult> {
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
      create: {
        code: permission.code,
        name: permission.name,
        description: permission.description,
        category: permission.category,
        publishedAt: now
      }
    });
  }

  let assignments = 0;
  for (const role of ROLE_DEFINITIONS) {
    const desired = new Set<string>(role.permissions);

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

  return {
    roles: ROLE_DEFINITIONS.length,
    permissions: PERMISSION_DEFINITIONS.length,
    assignments
  };
}
