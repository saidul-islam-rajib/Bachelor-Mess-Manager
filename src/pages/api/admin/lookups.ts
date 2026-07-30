import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { USER_ROLES, USER_STATUS } from '@/lib/constants';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, strings.errors.unauthorized);
  }
  if (!hasPermission(sessionUser, PERMISSIONS.USER_VIEW)) {
    return forbidden(res, strings.errors.adminOnly);
  }

  const [supervisors, groups, roles] = await Promise.all([
    prisma.user.findMany({
      where: { role: USER_ROLES.SUPERVISOR, status: USER_STATUS.APPROVED },
      select: { id: true, name: true, email: true, _count: { select: { groupsSupervised: true } } },
      orderBy: { name: 'asc' }
    }),
    prisma.group.findMany({
      select: { id: true, name: true, status: true, supervisorId: true },
      orderBy: { name: 'asc' }
    }),
    prisma.role.findMany({
      select: { code: true, name: true, rank: true },
      orderBy: { rank: 'desc' }
    })
  ]);

  return ok(res, {
    supervisors: supervisors.map((supervisor) => ({
      id: supervisor.id,
      name: supervisor.name,
      email: supervisor.email,
      groupCount: supervisor._count.groupsSupervised
    })),
    groups,
    roles
  });
}

export default withAudit(handler);
