import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, conflict, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { closeMonth, listClosings } from '@/lib/closings';
import { parseMonth } from '@/lib/month';
import { GROUP_CLOSED_MESSAGE, isGroupWritable } from '@/lib/groups';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const groupId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!groupId) {
    return badRequest(res, 'Group ID is required.');
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return notFound(res, 'Group not found.');
  }
  if (!(await isGroupMember(groupId, sessionUser.id)) && !requireAdmin(sessionUser)) {
    return forbidden(res, 'You are not a member of this group.');
  }

  const canManage = await canManageGroup(groupId, sessionUser);

  if (req.method === 'GET') {
    const monthQuery = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
    const monthKey = monthQuery ? parseMonth(monthQuery).key : undefined;

    return ok(res, { canManage, closings: await listClosings(groupId, monthKey) });
  }

  if (req.method === 'POST') {
    if (!canManage) {
      return forbidden(res, "Only this group's supervisor can close a month.");
    }

    if (!isGroupWritable(group)) {
      return forbidden(res, GROUP_CLOSED_MESSAGE);
    }

    const { month, through, userIds, note, endMembership } = req.body as {
      month?: string;
      through?: string;
      userIds?: unknown;
      note?: string;
      endMembership?: boolean;
    };

    if (userIds !== undefined && (!Array.isArray(userIds) || userIds.some((id) => typeof id !== 'string'))) {
      return badRequest(res, 'Select the members to close for.');
    }

    const result = await closeMonth({
      group,
      monthKey: parseMonth(month).key,
      through,
      userIds: userIds as string[] | undefined,
      note: typeof note === 'string' ? note.trim().slice(0, 300) || null : null,
      endMembership: endMembership === true,
      actorId: sessionUser.id,
      actorName: sessionUser.name
    });

    if (!result.ok) {
      return conflict(res, result.error);
    }

    return created(res, {
      closingId: result.closingId,
      members: result.lines,
      carriedForward: result.carriedForward
    });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler);
