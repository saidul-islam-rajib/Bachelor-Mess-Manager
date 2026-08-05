import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser } from '@/lib/auth-utils';
import { badRequest, conflict, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { reopenMonth } from '@/lib/closings';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return methodNotAllowed(res, ['DELETE']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) {
    return badRequest(res, 'Closing ID is required.');
  }

  const closing = await prisma.monthClosing.findUnique({ where: { id }, select: { groupId: true } });
  if (!closing) {
    return notFound(res, 'That closing no longer exists.');
  }
  if (!(await canManageGroup(closing.groupId, sessionUser))) {
    return forbidden(res, "Only this group's supervisor can reopen a month.");
  }

  const result = await reopenMonth(id, { id: sessionUser.id, name: sessionUser.name });
  if (!result.ok) {
    return conflict(res, result.error);
  }

  return ok(res, { reopened: true });
}

export default withAudit(handler);
