import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { USER_ROLES, USER_STATUS } from '@/lib/constants';
import { withAudit } from '@/lib/with-audit';

const VALID_STATUSES = Object.values(USER_STATUS) as string[];
const VALID_ROLES = Object.values(USER_ROLES) as string[];

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }
  if (!requireAdmin(sessionUser)) {
    return forbidden(res, 'Only admins can view registrations.');
  }

  const statusFilter = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
  const roleFilter = Array.isArray(req.query.role) ? req.query.role[0] : req.query.role;

  const where: { status?: string; role?: string } = {};
  if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
    where.status = statusFilter;
  }
  if (roleFilter && VALID_ROLES.includes(roleFilter)) {
    where.role = roleFilter;
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, status: true, phone: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });

  return ok(res, { users });
}

export default withAudit(handler);
