import type { NextApiRequest } from 'next';
import { parseCookies, SESSION_COOKIE_NAME } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function getSessionUser(req: NextApiRequest) {
  const cookies = parseCookies(req.headers.cookie);
  const userId = cookies[SESSION_COOKIE_NAME];
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      profileImage: true
    }
  });
}

export function requireAdmin(user: { role?: string } | null) {
  return user?.role === 'ADMIN';
}

export function requireSupervisorOrAdmin(user: { role?: string } | null) {
  return user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
}

// A user "belongs" to a group if they supervise it or have an active membership.
export async function isGroupMember(groupId: string, userId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { supervisorId: true } });
  if (!group) return false;
  if (group.supervisorId === userId) return true;
  const membership = await prisma.membership.findFirst({ where: { groupId, userId, isActive: true } });
  return Boolean(membership);
}
