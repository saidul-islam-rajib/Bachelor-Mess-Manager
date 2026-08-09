import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import {
  hasPermission,
  PERMISSION_DEFINITIONS,
  permissionsForRole,
  PERMISSIONS
} from '@/lib/permissions';
import {
  effectivePermissions,
  isKnownEffect,
  isKnownPermission,
  loadOverrides,
  replaceOverrides,
  type PermissionOverride
} from '@/lib/user-permissions';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

function parseOverrides(input: unknown): PermissionOverride[] | { error: string } {
  if (input === undefined || input === null) return [];

  const rows = Array.isArray(input)
    ? input
    : typeof input === 'object'
      ? Object.entries(input as Record<string, unknown>).map(([permissionCode, effect]) => ({
          permissionCode,
          effect
        }))
      : null;

  if (!rows) return { error: strings.admin.permissions.invalidPayload };

  const overrides: PermissionOverride[] = [];
  for (const row of rows) {
    const { permissionCode, effect } = (row ?? {}) as { permissionCode?: unknown; effect?: unknown };
    if (effect === null || effect === '' || effect === undefined) continue;
    if (!isKnownPermission(permissionCode)) {
      return { error: strings.admin.permissions.unknownPermission(String(permissionCode)) };
    }
    if (!isKnownEffect(effect)) {
      return { error: strings.admin.permissions.unknownEffect(String(effect)) };
    }
    overrides.push({ permissionCode, effect });
  }

  return overrides;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    return methodNotAllowed(res, ['GET', 'PUT']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, strings.errors.unauthorized);
  }
  if (!hasPermission(sessionUser, PERMISSIONS.USER_ASSIGN_ROLE)) {
    return forbidden(res, strings.errors.adminOnly);
  }

  const userId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!userId) {
    return badRequest(res, strings.admin.users.idRequired);
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, status: true }
  });
  if (!target) {
    return notFound(res, strings.admin.users.notFound);
  }

  if (req.method === 'GET') {
    const overrides = await loadOverrides(target.id);
    return ok(res, {
      user: target,
      catalog: PERMISSION_DEFINITIONS,
      rolePermissions: permissionsForRole(target.role),
      overrides,
      effective: effectivePermissions(target.role, overrides)
    });
  }

  if (target.id === sessionUser.id) {
    return forbidden(res, strings.admin.permissions.cannotChangeSelf);
  }

  const parsed = parseOverrides((req.body as { overrides?: unknown })?.overrides);
  if (!Array.isArray(parsed)) {
    return badRequest(res, parsed.error);
  }

  const saved = await replaceOverrides({
    userId: target.id,
    role: target.role,
    overrides: parsed,
    grantedById: sessionUser.id
  });

  return ok(res, {
    user: target,
    rolePermissions: permissionsForRole(target.role),
    overrides: saved,
    effective: effectivePermissions(target.role, saved)
  });
}

export default withAudit(handler);
