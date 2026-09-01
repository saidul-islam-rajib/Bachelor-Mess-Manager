import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, conflict, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { getFinalSettlement, markFinalSettlementSettled } from '@/lib/final-settlement';
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
    const report = await getFinalSettlement(group);
    return ok(res, { canManage, settlement: report });
  }

  if (req.method === 'POST') {
    if (!canManage) {
      return forbidden(res, "Only this group's supervisor can mark a month settled.");
    }

    const { action } = req.body as { action?: string };
    if (action !== 'markSettled') {
      return badRequest(res, 'Unknown action.');
    }

    const result = await markFinalSettlementSettled(group, { id: sessionUser.id, name: sessionUser.name });
    if (!result.ok) {
      return conflict(res, result.error);
    }

    const report = await getFinalSettlement(group);
    return ok(res, { canManage, settlement: report });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler);
