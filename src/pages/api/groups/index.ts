import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin, requireSupervisorOrAdmin } from '@/lib/auth-utils';
import { badRequest, conflict, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { canCreateGroup, MAX_GROUPS_PER_SUPERVISOR } from '@/lib/groups';
import { normalizeEmail } from '@/lib/validation';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  if (req.method === 'GET') {
    // Admin sees every group; others see groups they supervise or actively belong to.
    const where = requireAdmin(sessionUser)
      ? undefined
      : {
          OR: [
            { supervisorId: sessionUser.id },
            { memberships: { some: { userId: sessionUser.id, isActive: true } } }
          ]
        };

    const groups = await prisma.group.findMany({
      where,
      include: {
        supervisor: { select: { id: true, name: true, email: true } },
        memberships: { where: { isActive: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const orders = await prisma.groupOrder.findMany({
      where: { userId: sessionUser.id, groupId: { in: groups.map((g) => g.id) } },
      select: { groupId: true, position: true }
    });
    const positionOf = new Map(orders.map((o) => [o.groupId, o.position]));

    const sorted = [...groups].sort((a, b) => {
      const pa = positionOf.get(a.id);
      const pb = positionOf.get(b.id);
      if (pa !== undefined && pb !== undefined) return pa - pb;
      if (pa !== undefined) return -1;
      if (pb !== undefined) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // How much of their 10-group allowance a supervisor has left, so the UI can
    // disable the create form before the request is refused.
    const ownedCount = requireSupervisorOrAdmin(sessionUser)
      ? await prisma.group.count({ where: { supervisorId: sessionUser.id } })
      : 0;

    return ok(res, {
      groups: sorted.map((group) => ({
        id: group.id,
        name: group.name,
        supervisor: { id: group.supervisor.id, name: group.supervisor.name, email: group.supervisor.email },
        status: group.status,
        memberCount: group.memberships.length,
        createdAt: group.createdAt
      })),
      limits: {
        maxGroups: MAX_GROUPS_PER_SUPERVISOR,
        ownedCount,
        canCreate: requireAdmin(sessionUser) || (requireSupervisorOrAdmin(sessionUser) && ownedCount < MAX_GROUPS_PER_SUPERVISOR)
      }
    });
  }

  if (req.method === 'POST') {
    if (!requireSupervisorOrAdmin(sessionUser)) {
      return forbidden(res, 'Only supervisors can create a group.');
    }

    const { name, supervisorEmail, status } = req.body as {
      name?: string;
      supervisorEmail?: string;
      status?: string;
    };

    const trimmedName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
    if (!trimmedName) {
      return badRequest(res, 'Group name is required.');
    }
    if (trimmedName.length > 80) {
      return badRequest(res, 'Group name must be at most 80 characters.');
    }

    let supervisorId = sessionUser.id;

    // Admins may create a group on behalf of another supervisor; supervisors own the groups they create.
    if (requireAdmin(sessionUser)) {
      if (!supervisorEmail) {
        return badRequest(res, 'Supervisor email is required.');
      }
      const supervisor = await prisma.user.findUnique({ where: { email: normalizeEmail(supervisorEmail) } });
      if (!supervisor) {
        return notFound(res, 'Supervisor user not found.');
      }
      if (!requireSupervisorOrAdmin(supervisor)) {
        return badRequest(res, 'That user is not a supervisor. Promote them first from the admin panel.');
      }
      supervisorId = supervisor.id;
    }

    // Spec rule: a supervisor manages at most 10 groups.
    const capacity = await canCreateGroup(supervisorId);
    if (!capacity.ok) {
      return conflict(res, capacity.error);
    }

    const group = await prisma.group.create({
      data: {
        name: trimmedName,
        supervisorId,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        publishedAt: new Date(),
        memberships: {
          create: { userId: supervisorId, isActive: true }
        }
      }
    });

    return created(res, { group });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler);
