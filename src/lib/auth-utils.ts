import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies, setSessionCookie, SESSION_COOKIE_NAME } from '@/lib/auth';
import { shouldRefresh, verifySessionToken } from '@/lib/session';
import { USER_ROLES, USER_STATUS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone: string | null;
  profileImage: string | null;
};

export function readSessionToken(req: NextApiRequest): string | undefined {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME];
}

/**
 * Resolve the signed-in user, or null.
 *
 * A session is only good if the cookie's signature verifies, it has not expired,
 * the user still exists, their tokenVersion still matches (so a password change
 * kills older sessions), and their account is still APPROVED (so a rejected or
 * suspended user is logged out at their next request rather than at next login).
 *
 * Pass `res` to let an ageing-but-valid session slide forward.
 */
export async function getSessionUser(req: NextApiRequest, res?: NextApiResponse): Promise<SessionUser | null> {
  const payload = await verifySessionToken(readSessionToken(req));
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      phone: true,
      profileImage: true,
      tokenVersion: true
    }
  });

  if (!user) return null;
  if (user.tokenVersion !== payload.sv) return null;
  if (user.status !== USER_STATUS.APPROVED) return null;

  if (res && shouldRefresh(payload)) {
    await setSessionCookie(res, user.id, user.tokenVersion);
  }

  const { tokenVersion: _tokenVersion, ...sessionUser } = user;
  return sessionUser;
}

export function requireAdmin(user: { role?: string } | null) {
  return user?.role === USER_ROLES.ADMIN;
}

export function requireSupervisorOrAdmin(user: { role?: string } | null) {
  return user?.role === USER_ROLES.ADMIN || user?.role === USER_ROLES.SUPERVISOR;
}

export async function isGroupMember(groupId: string, userId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { supervisorId: true } });
  if (!group) return false;
  if (group.supervisorId === userId) return true;
  const membership = await prisma.membership.findFirst({ where: { groupId, userId, isActive: true } });
  return Boolean(membership);
}

/** The group's own supervisor, or any admin. */
export async function canManageGroup(groupId: string, user: { id: string; role: string } | null) {
  if (!user) return false;
  if (requireAdmin(user)) return true;
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { supervisorId: true } });
  return group?.supervisorId === user.id;
}

/**
 * The single group a user is currently active in, if any.
 *
 * The product rule is one active membership at a time, so this is the whole of a
 * member's group context. Supervisors are exempt: they hold a membership in each
 * group they run so their own meals are counted.
 */
export async function getActiveMembership(userId: string) {
  return prisma.membership.findFirst({
    where: { userId, isActive: true },
    include: { group: { select: { id: true, name: true, supervisorId: true, status: true } } },
    orderBy: { joinedAt: 'asc' }
  });
}
