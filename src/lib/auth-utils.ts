import type { NextApiRequest, NextApiResponse } from 'next';
import {
  clearImpersonationCookie,
  IDENTITY_COOKIE,
  IMPERSONATION_COOKIE_NAME,
  parseCookies,
  setSessionCookie,
  setThemeCookie,
  SESSION_COOKIE_NAME,
  THEME_COOKIE_NAME
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
  theme: string;
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
  theme: true,
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

    return null;
  }

  if (existing.status !== USER_STATUS.APPROVED) return null;

  const { permissionOverrides, ...user } = existing;
  return { ...user, permissions: effectivePermissions(existing.role, permissionOverrides) };
}

export async function getRealSessionUser(req: NextApiRequest, res?: NextApiResponse): Promise<SessionUser | null> {
  const payload = await verifySessionToken(readSessionToken(req));

  if (!payload) {
    const adopted = await adoptFromIdentity(req);
    if (!adopted) return null;

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

function syncThemeCookie(req: NextApiRequest, res: NextApiResponse | undefined, user: SessionUser) {
  if (!res) return;
  if (parseCookies(req.headers.cookie)[THEME_COOKIE_NAME] === user.theme) return;
  setThemeCookie(res, user.theme);
}

export async function getSessionUser(req: NextApiRequest, res?: NextApiResponse): Promise<SessionUser | null> {
  const realUser = await getRealSessionUser(req, res);
  if (!realUser) return null;

  const impersonation = await verifyImpersonationToken(readImpersonationToken(req));
  if (!impersonation) {
    syncThemeCookie(req, res, realUser);
    return realUser;
  }

  if (realUser.role !== USER_ROLES.ADMIN || impersonation.aid !== realUser.id) {
    if (res) clearImpersonationCookie(res);
    syncThemeCookie(req, res, realUser);
    return realUser;
  }

  const target = await loadActiveUser(impersonation.uid, impersonation.sv);
  if (!target || target.role === USER_ROLES.ADMIN) {
    if (res) clearImpersonationCookie(res);
    syncThemeCookie(req, res, realUser);
    return realUser;
  }

  const effectiveUser = toSessionUser(target, { id: realUser.id, name: realUser.name, email: realUser.email });
  syncThemeCookie(req, res, effectiveUser);
  return effectiveUser;
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
      OR: [
        { supervisorId: userId },
        { coSupervisors: { some: { userId } } },
        { memberships: { some: { userId, isActive: true } } }
      ]
    },
    select: { id: true }
  });

  return Boolean(group);
}

export async function canManageGroup(groupId: string, user: { id: string; role: string } | null) {
  if (!user) return false;
  if (requireAdmin(user)) return true;

  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [{ supervisorId: user.id }, { coSupervisors: { some: { userId: user.id } } }]
    },
    select: { id: true }
  });

  return Boolean(group);
}

export async function getActiveMembership(userId: string) {
  return prisma.membership.findFirst({
    where: { userId, isActive: true },
    include: { group: { select: { id: true, name: true, supervisorId: true, status: true } } },
    orderBy: { joinedAt: 'asc' }
  });
}
