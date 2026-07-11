import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin, requireSupervisorOrAdmin } from '@/lib/auth-utils';
import { badRequest, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
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

    return ok(res, {
      groups: sorted.map((group) => ({
        id: group.id,
        name: group.name,
        supervisor: { id: group.supervisor.id, name: group.supervisor.name, email: group.supervisor.email },
        status: group.status,
        memberCount: group.memberships.length,
        createdAt: group.createdAt
      }))
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

    if (!name) {
      return badRequest(res, 'Group name is required.');
    }

    let supervisorId = sessionUser.id;

    // Admins may create a group on behalf of another supervisor; supervisors own the groups they create.
    if (requireAdmin(sessionUser)) {
      if (!supervisorEmail) {
        return badRequest(res, 'Supervisor email is required.');
      }
      const supervisor = await prisma.user.findUnique({ where: { email: supervisorEmail } });
      if (!supervisor) {
        return notFound(res, 'Supervisor user not found.');
      }
      supervisorId = supervisor.id;
    }

    const group = await prisma.group.create({
      data: {
        name,
        supervisorId,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
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
