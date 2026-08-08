import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { listExpenseHistory } from '@/lib/expense-history';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const groupId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!groupId) {
    return badRequest(res, 'Group ID is required.');
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      supervisorId: true,
      memberships: {
        where: { userId: sessionUser.id, isActive: true },
        select: { id: true },
        take: 1
      }
    }
  });
  if (!group) {
    return notFound(res, 'Group not found.');
  }

  const isMember = group.supervisorId === sessionUser.id || group.memberships.length > 0;
  if (!isMember && !requireAdmin(sessionUser)) {
    return forbidden(res, 'You are not a member of this group.');
  }

  const monthKey = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
  const history = await listExpenseHistory(groupId, monthKey);

  return ok(res, { history });
}

export default withAudit(handler);
