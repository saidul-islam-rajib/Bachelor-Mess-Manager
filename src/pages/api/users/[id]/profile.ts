import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { stayDays } from '@/lib/groups';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const targetId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!targetId) {
    return badRequest(res, 'User ID is required.');
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      profileImage: true,
      role: true,
      status: true,
      createdAt: true
    }
  });

  if (!target) {
    return notFound(res, 'That member could not be found.');
  }

  const isSelf = target.id === sessionUser.id;
  const isAdmin = requireAdmin(sessionUser);

  const [viewerMemberships, supervised] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: sessionUser.id, isActive: true },
      select: { groupId: true }
    }),
    prisma.group.findMany({ where: { supervisorId: sessionUser.id }, select: { id: true } })
  ]);

  const visibleGroupIds = [
    ...new Set([...viewerMemberships.map((m) => m.groupId), ...supervised.map((g) => g.id)])
  ];

  const memberships = await prisma.membership.findMany({
    where: {
      userId: target.id,
      ...(isAdmin ? {} : { groupId: { in: visibleGroupIds } })
    },
    include: { group: { select: { id: true, name: true, supervisorId: true, status: true } } },
    orderBy: [{ isActive: 'desc' }, { joinedAt: 'asc' }]
  });

  if (!isSelf && !isAdmin && memberships.length === 0) {
    return forbidden(res, 'You do not share a mess with that member.');
  }

  return ok(res, {
    member: {
      id: target.id,
      name: target.name,
      email: target.email,
      phone: target.phone,
      profileImage: target.profileImage,
      role: target.role,
      status: target.status,
      memberSince: target.createdAt.toISOString(),
      isSelf,
      groups: memberships.map((m) => ({
        id: m.group.id,
        name: m.group.name,
        status: m.group.status,
        isSupervisor: m.group.supervisorId === target.id,
        isActive: m.isActive,
        joinedAt: m.joinedAt.toISOString(),
        leftAt: m.leftAt ? m.leftAt.toISOString() : null,
        stayDays: stayDays(m.joinedAt, m.leftAt)
      }))
    }
  });
}

export default withAudit(handler);
