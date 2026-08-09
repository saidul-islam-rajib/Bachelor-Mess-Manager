import type { NextApiRequest, NextApiResponse } from 'next';
import {
  clearImpersonationCookie,
  IDENTITY_COOKIE,
  IMPERSONATION_COOKIE_NAME,
  parseCookies,
  setSessionCookie,
  SESSION_COOKIE_NAME
} from '@/lib/auth';
import { readIdentity } from '@/lib/identity';
import { shouldRefresh, verifyImpersonationToken, verifySessionToken } from '@/lib/session';
import { USER_ROLES, USER_STATUS } from '@/lib/constants';
import { normalizeEmail, validateName } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import { cached } from '@/lib/cache';
import { sessionUserKey } from '@/lib/cache-keys';
import { effectivePermissions } from '@/lib/user-permissions';
import { cacheConfig } from '@/config';

export type ImpersonatedBy = {
  id: string;
  name: string;
  email: string;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone: string | null;
  profileImage: string | null;
  permissions: string[];
  impersonatedBy?: ImpersonatedBy;
};

type SessionUserRow = SessionUser & { tokenVersion: number };

const SESSION_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  phone: true,
  profileImage: true,
  tokenVersion: true,
  permissionOverrides: { select: { permissionCode: true, effect: true } }
} as const;

export function readSessionToken(req: NextApiRequest): string | undefined {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME];
}

export function readImpersonationToken(req: NextApiRequest): string | undefined {
  return parseCookies(req.headers.cookie)[IMPERSONATION_COOKIE_NAME];
}

export function readIdentityToken(req: NextApiRequest): string | undefined {
  return parseCookies(req.headers.cookie)[IDENTITY_COOKIE];
}

async function loadActiveUser(userId: string, tokenVersion: number): Promise<SessionUserRow | null> {
  const row = await cached(sessionUserKey(userId), cacheConfig.sessionUserMs, () =>
    prisma.user.findUnique({ where: { id: userId }, select: SESSION_USER_SELECT })
  );

  if (!row) return null;
  if (row.tokenVersion !== tokenVersion) return null;
  if (row.status !== USER_STATUS.APPROVED) return null;

  const { permissionOverrides, ...user } = row;
  return { ...user, permissions: effectivePermissions(row.role, permissionOverrides) };
}

function toSessionUser(row: SessionUserRow, impersonatedBy?: ImpersonatedBy): SessionUser {
  const { tokenVersion: _tokenVersion, ...user } = row;
  return impersonatedBy ? { ...user, impersonatedBy } : user;
}

/**
 * Adopt somebody carrying a valid session from a sibling Team Sober app.
 *
 * The address is proven — the cookie is signed with the secret only our own
 * apps hold — so there is no password to check and nothing to email. What it
 * is *not* is an approval: a Bachelor Point account reaches group dues, bills
 * and payments, so a stranger who signed up on the tutorials site lands in the
 * ordinary PENDING queue and waits for an admin, exactly as if they had filled
 * in the signup form here.
 */
async function adoptFromIdentity(req: NextApiRequest): Promise<SessionUserRow | null> {
  const claims = await readIdentity(readIdentityToken(req));
  if (!claims) return null;

  const email = normalizeEmail(claims.email);
  if (!email) return null;

  const existing = await prisma.user.findUnique({ where: { email }, select: SESSION_USER_SELECT });

  if (!existing) {
    const name = validateName(claims.name);

    await prisma.user.create({
      data: {
        name: name.ok ? name.value : email,
        email,
        password: '',
        role: USER_ROLES.MEMBER,
        status: USER_STATUS.PENDING
      }
    });

    // Created, but deliberately not admitted: PENDING is not APPROVED.
    return null;
  }

  if (existing.status !== USER_STATUS.APPROVED) return null;

  const { permissionOverrides, ...user } = existing;
  return { ...user, permissions: effectivePermissions(existing.role, permissionOverrides) };
}

export async function getRealSessionUser(req: NextApiRequest, res?: NextApiResponse): Promise<SessionUser | null> {
  const payload = await verifySessionToken(readSessionToken(req));

  if (!payload) {
    // No session of our own. A sibling app may still vouch for them.
    const adopted = await adoptFromIdentity(req);
    if (!adopted) return null;

    // Give them one of ours, so every later request takes the normal path.
    if (res) await setSessionCookie(res, adopted);

    return toSessionUser(adopted);
  }

  const user = await loadActiveUser(payload.uid, payload.sv);
  if (!user) return null;

  if (res && shouldRefresh(payload)) {
    await setSessionCookie(res, user);
  }

  return toSessionUser(user);
}

export async function getSessionUser(req: NextApiRequest, res?: NextApiResponse): Promise<SessionUser | null> {
  const realUser = await getRealSessionUser(req, res);
  if (!realUser) return null;

  const impersonation = await verifyImpersonationToken(readImpersonationToken(req));
  if (!impersonation) return realUser;

  if (realUser.role !== USER_ROLES.ADMIN || impersonation.aid !== realUser.id) {
    if (res) clearImpersonationCookie(res);
    return realUser;
  }

  const target = await loadActiveUser(impersonation.uid, impersonation.sv);
  if (!target || target.role === USER_ROLES.ADMIN) {
    if (res) clearImpersonationCookie(res);
    return realUser;
  }

  return toSessionUser(target, { id: realUser.id, name: realUser.name, email: realUser.email });
}

export function requireAdmin(user: { role?: string } | null) {
  return user?.role === USER_ROLES.ADMIN;
}

export function requireSupervisorOrAdmin(user: { role?: string } | null) {
  return user?.role === USER_ROLES.ADMIN || user?.role === USER_ROLES.SUPERVISOR;
}

export async function isGroupMember(groupId: string, userId: string) {
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [{ supervisorId: userId }, { memberships: { some: { userId, isActive: true } } }]
    },
    select: { id: true }
  });

  return Boolean(group);
}

export async function canManageGroup(groupId: string, user: { id: string; role: string } | null) {
  if (!user) return false;
  if (requireAdmin(user)) return true;
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { supervisorId: true } });
  return group?.supervisorId === user.id;
}

export async function getActiveMembership(userId: string) {
  return prisma.membership.findFirst({
    where: { userId, isActive: true },
    include: { group: { select: { id: true, name: true, supervisorId: true, status: true } } },
    orderBy: { joinedAt: 'asc' }
  });
}
