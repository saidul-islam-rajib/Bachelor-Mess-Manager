import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { advanceBalances, listAdvances, recordAdvanceDeposit, reverseAdvanceDeposit } from '@/lib/advances';
import { GROUP_CLOSED_MESSAGE, isGroupWritable } from '@/lib/groups';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { round2 } from '@/lib/month';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';
import { cached, invalidatePrefix } from '@/lib/cache';
import { advancesKey } from '@/lib/cache-keys';
import { cacheConfig } from '@/config';

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
    if (!hasPermission(sessionUser, PERMISSIONS.PAYMENT_VIEW)) {
      return forbidden(res, strings.errors.permissionDenied);
    }

    const payload = await cached(advancesKey(groupId), cacheConfig.advancesMs, async () => {
      const [memberships, balances, history] = await Promise.all([
        prisma.membership.findMany({
          where: { groupId, isActive: true },
          include: { user: { select: { id: true, name: true } } },
          orderBy: { joinedAt: 'asc' }
        }),
        advanceBalances(groupId),
        listAdvances(groupId)
      ]);

      return {
        members: memberships.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          balance: balances.get(m.user.id) ?? 0
        })),
        history
      };
    });

    return ok(res, { canManage, currentUserId: sessionUser.id, ...payload });
  }

  if (req.method === 'POST') {
    if (!canManage) {
      return forbidden(res, "Only this group's supervisor can collect advances.");
    }
    if (!hasPermission(sessionUser, PERMISSIONS.PAYMENT_RECORD)) {
      return forbidden(res, strings.errors.permissionDenied);
    }
    if (!isGroupWritable(group)) {
      return forbidden(res, GROUP_CLOSED_MESSAGE);
    }

    const { userId, amount, note } = req.body as Record<string, unknown>;

    if (typeof userId !== 'string' || !userId) {
      return badRequest(res, 'Select who this advance is from.');
    }
    if (!(await isGroupMember(groupId, userId))) {
      return badRequest(res, 'That member does not belong to this group.');
    }

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return badRequest(res, 'Amount must be a positive number.');
    }
    if (value > 100_000_000) {
      return badRequest(res, 'That amount looks wrong. Please check it.');
    }

    const deposit = await recordAdvanceDeposit({
      groupId,
      userId,
      amount: round2(value),
      note: typeof note === 'string' && note.trim() ? note.trim() : null,
      recordedById: sessionUser.id
    });

    invalidatePrefix(advancesKey(groupId));

    return created(res, { advance: { id: deposit.id, userId: deposit.userId, amount: round2(deposit.amount) } });
  }

  if (req.method === 'DELETE') {
    if (!canManage) {
      return forbidden(res, "Only this group's supervisor can reverse an advance.");
    }
    if (!hasPermission(sessionUser, PERMISSIONS.PAYMENT_RECORD)) {
      return forbidden(res, strings.errors.permissionDenied);
    }

    const advanceId = Array.isArray(req.query.advanceId) ? req.query.advanceId[0] : req.query.advanceId;
    if (!advanceId) {
      return badRequest(res, 'Which entry should be reversed?');
    }

    const reversed = await reverseAdvanceDeposit({ advanceId, actorId: sessionUser.id, groupId });
    if (!reversed.ok) {
      return badRequest(res, reversed.error);
    }

    invalidatePrefix(advancesKey(groupId));

    return ok(res, { reversed: true, amount: reversed.amount });
  }

  return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
}

export default withAudit(handler);
