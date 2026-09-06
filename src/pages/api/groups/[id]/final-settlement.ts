import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, conflict, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import {
  declareMemberSettled,
  getFinalSettlement,
  markFinalSettlementSettled,
  settleMemberBalance,
  settleWholeMonth
} from '@/lib/final-settlement';
import { strings } from '@/lib/i18n';
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
    const { action, userId } = req.body as { action?: string; userId?: string };
    const actor = { id: sessionUser.id, name: sessionUser.name };

    if (action === 'settleMember') {
      const targetId = typeof userId === 'string' && userId ? userId : sessionUser.id;
      const settled =
        targetId === sessionUser.id
          ? await settleMemberBalance(group, targetId, actor)
          : canManage
            ? await declareMemberSettled(group, targetId, actor)
            : null;

      if (!settled) {
        return forbidden(res, strings.settlement.settleMemberOthers);
      }
      if (!settled.ok) {
        return conflict(res, settled.error);
      }

      return ok(res, { canManage, settlement: await getFinalSettlement(group) });
    }

    if (!canManage) {
      return forbidden(res, "Only this group's supervisor can settle a month.");
    }

    if (action === 'settleAll') {
      const result = await settleWholeMonth(group, actor);
      if (!result.ok) {
        return conflict(res, result.error);
      }
      return ok(res, { canManage, settlement: await getFinalSettlement(group) });
    }

    if (action !== 'markSettled') {
      return badRequest(res, 'Unknown action.');
    }

    const result = await markFinalSettlementSettled(group, actor);
    if (!result.ok) {
      return conflict(res, result.error);
    }

    return ok(res, { canManage, settlement: await getFinalSettlement(group) });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler);
