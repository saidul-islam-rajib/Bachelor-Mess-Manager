import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
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

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) {
    return notFound(res, 'Group not found.');
  }

  if (!(await isGroupMember(groupId, sessionUser.id)) && !requireAdmin(sessionUser)) {
    return forbidden(res, 'You are not a member of this group.');
  }

  const history = await listExpenseHistory(groupId);

  return ok(res, { history });
}

export default withAudit(handler);
