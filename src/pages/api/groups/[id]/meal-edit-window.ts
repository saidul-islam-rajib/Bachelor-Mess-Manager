import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isGroupMember } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { GROUP_STATUS } from '@/lib/constants';
import { closeEditWindow, openEditWindow, readEditWindow } from '@/lib/meal-edits';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const groupId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!groupId) {
    return badRequest(res, 'Group ID is required.');
  }

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true, status: true } });
  if (!group) {
    return notFound(res, 'Group not found.');
  }
  if (!(await isGroupMember(groupId, sessionUser.id))) {
    return forbidden(res, 'You are not a member of this group.');
  }

  if (req.method === 'GET') {
    return ok(res, { window: await readEditWindow(sessionUser.id, groupId) });
  }

  if (req.method === 'POST') {
    if (group.status === GROUP_STATUS.INACTIVE) {
      return forbidden(res, 'This mess is closed, so past meals cannot be changed.');
    }
    return ok(res, { window: await openEditWindow(sessionUser.id, groupId) });
  }

  if (req.method === 'DELETE') {
    return ok(res, { window: await closeEditWindow(sessionUser.id, groupId) });
  }

  return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
}

export default withAudit(handler);
