import { prisma } from '@/lib/prisma';
import { invalidate } from '@/lib/cache';
import { sessionUserKey } from '@/lib/cache-keys';
import { PERMISSION_DEFINITIONS, permissionsForRole, type PermissionCode } from '@/lib/permissions';
import { traced } from '@/lib/log';

export const PERMISSION_EFFECTS = {
  ALLOW: 'ALLOW',
  DENY: 'DENY'
} as const;

export type PermissionEffect = (typeof PERMISSION_EFFECTS)[keyof typeof PERMISSION_EFFECTS];

export const PERMISSION_EFFECT_VALUES = Object.values(PERMISSION_EFFECTS) as string[];

export type PermissionOverride = { permissionCode: string; effect: string };

const PERMISSION_CODES = new Set<string>(PERMISSION_DEFINITIONS.map((definition) => definition.code));

const READ_ONLY_SUFFIXES = ['.view', '.view_own', '.view_group', '.view_all'];

export const READ_ONLY_PERMISSIONS: PermissionCode[] = PERMISSION_DEFINITIONS.filter((definition) =>
  READ_ONLY_SUFFIXES.some((suffix) => definition.code.endsWith(suffix))
).map((definition) => definition.code);

export function isKnownPermission(code: unknown): code is PermissionCode {
  return typeof code === 'string' && PERMISSION_CODES.has(code);
}

export function isKnownEffect(effect: unknown): effect is PermissionEffect {
  return typeof effect === 'string' && PERMISSION_EFFECT_VALUES.includes(effect);
}

export function applyOverrides(rolePermissions: string[], overrides: PermissionOverride[]): string[] {
  const effective = new Set(rolePermissions);

  for (const override of overrides) {
    if (!PERMISSION_CODES.has(override.permissionCode)) continue;
    if (override.effect === PERMISSION_EFFECTS.ALLOW) effective.add(override.permissionCode);
  }
  for (const override of overrides) {
    if (override.effect === PERMISSION_EFFECTS.DENY) effective.delete(override.permissionCode);
  }

  return [...effective];
}

export function effectivePermissions(role: string, overrides: PermissionOverride[]): string[] {
  return applyOverrides(permissionsForRole(role), overrides);
}

export async function loadOverrides(userId: string): Promise<PermissionOverride[]> {
  return prisma.userPermission.findMany({
    where: { userId },
    select: { permissionCode: true, effect: true },
    orderBy: { permissionCode: 'asc' }
  });
}

export async function resolveUserPermissions(userId: string, role: string): Promise<string[]> {
  return effectivePermissions(role, await loadOverrides(userId));
}

async function replaceOverridesImpl(params: {
  userId: string;
  role: string;
  overrides: PermissionOverride[];
  grantedById: string | null;
}): Promise<PermissionOverride[]> {
  const rolePermissions = new Set(permissionsForRole(params.role));

  const meaningful = new Map<string, string>();
  for (const override of params.overrides) {
    if (!PERMISSION_CODES.has(override.permissionCode)) continue;
    if (!isKnownEffect(override.effect)) continue;

    const grantedByRole = rolePermissions.has(override.permissionCode);
    if (override.effect === PERMISSION_EFFECTS.ALLOW && grantedByRole) continue;
    if (override.effect === PERMISSION_EFFECTS.DENY && !grantedByRole) continue;

    meaningful.set(override.permissionCode, override.effect);
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.userPermission.deleteMany({ where: { userId: params.userId } }),
    ...(meaningful.size > 0
      ? [
          prisma.userPermission.createMany({
            data: [...meaningful.entries()].map(([permissionCode, effect]) => ({
              userId: params.userId,
              permissionCode,
              effect,
              grantedById: params.grantedById,
              publishedAt: now
            }))
          })
        ]
      : [])
  ]);

  invalidate(sessionUserKey(params.userId));

  return [...meaningful.entries()]
    .map(([permissionCode, effect]) => ({ permissionCode, effect }))
    .sort((a, b) => a.permissionCode.localeCompare(b.permissionCode));
}

export function readOnlyOverridesFor(role: string): PermissionOverride[] {
  const rolePermissions = new Set(permissionsForRole(role));
  const readOnly = new Set<string>(READ_ONLY_PERMISSIONS);

  return PERMISSION_DEFINITIONS.filter(
    (definition) => rolePermissions.has(definition.code) && !readOnly.has(definition.code)
  ).map((definition) => ({ permissionCode: definition.code, effect: PERMISSION_EFFECTS.DENY }));
}

export const replaceOverrides = traced('replaceOverrides', replaceOverridesImpl);
