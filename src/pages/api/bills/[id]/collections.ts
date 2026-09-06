import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember } from '@/lib/auth-utils';
import { badRequest, conflict, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { EXPENSE_TYPES, PAYMENT_STATUS } from '@/lib/constants';
import {
  allocateToFronters,
  buildCollectionState,
  collectionsByBill,
  hardDeletePayment,
  reversePayment,
  shareStatus,
  updatePaymentDetails
} from '@/lib/bill-collections';
import { dayToUtcDate, round2, todayKey, utcDateToDay } from '@/lib/month';
import { GROUP_CLOSED_MESSAGE, isGroupWritable } from '@/lib/groups';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';
import { invalidatePrefix } from '@/lib/cache';
import { advancesKey, billsListGroupPrefix } from '@/lib/cache-keys';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'DELETE' && req.method !== 'PATCH') {
    return methodNotAllowed(res, ['POST', 'DELETE', 'PATCH']);
  }

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const billId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!billId) {
    return badRequest(res, 'Bill ID is required.');
  }

  const bill = await prisma.expenseEntry.findUnique({
    where: { id: billId },
    include: {
      group: true,
      shares: { include: { user: { select: { id: true, name: true } } } }
    }
  });
  if (!bill || bill.type === EXPENSE_TYPES.BAZAR) {
    return notFound(res, 'Bill not found.');
  }

  const manages = await canManageGroup(bill.groupId, sessionUser);

  if (!isGroupWritable(bill.group)) {
    return forbidden(res, GROUP_CLOSED_MESSAGE);
  }

  if (req.method === 'DELETE' || req.method === 'PATCH') {
    if (!manages) {
      return forbidden(res, "Only this group's supervisor can change a payment entry.");
    }
    if (!hasPermission(sessionUser, PERMISSIONS.PAYMENT_RECORD)) {
      return forbidden(res, strings.errors.permissionDenied);
    }

    const collectionId = Array.isArray(req.query.collectionId)
      ? req.query.collectionId[0]
      : req.query.collectionId;
    if (!collectionId) {
      return badRequest(res, 'Which entry should be changed?');
    }

    const existing = await prisma.paymentStatus.findUnique({ where: { id: collectionId } });
    if (!existing || existing.expenseId !== billId) {
      return notFound(res, 'That entry is not recorded against this bill.');
    }

    const settleCaches = () => {
      invalidatePrefix(billsListGroupPrefix(bill.groupId));
      invalidatePrefix(advancesKey(bill.groupId));
    };

    if (req.method === 'PATCH') {
      const { amount, date } = req.body as { amount?: number; date?: string };
      const updated = await updatePaymentDetails({
        paymentId: collectionId,
        groupId: bill.groupId,
        amount: amount === undefined ? undefined : Number(amount),
        date: typeof date === 'string' ? date : undefined
      });
      if (!updated.ok) {
        return conflict(res, updated.error);
      }

      settleCaches();
      return ok(res, { updated: true });
    }

    if (req.query.hard === 'true') {
      const deleted = await hardDeletePayment({ paymentId: collectionId, groupId: bill.groupId });
      if (!deleted.ok) {
        return conflict(res, deleted.error);
      }

      settleCaches();
      return ok(res, { deleted: true });
    }

    const reversed = await reversePayment({
      paymentId: collectionId,
      actorId: sessionUser.id,
      groupId: bill.groupId
    });
    if (!reversed.ok) {
      return conflict(res, reversed.error);
    }

    invalidatePrefix(billsListGroupPrefix(bill.groupId));
    if (existing.fromAdvance) invalidatePrefix(advancesKey(bill.groupId));

    return ok(res, { reversed: true, amount: reversed.amount });
  }

  const { userId, amount, date, settle, toUserId } = req.body as Record<string, unknown>;

  if (typeof userId !== 'string' || !userId) {
    return badRequest(res, 'Select the member who paid.');
  }

  if (manages) {
    if (!hasPermission(sessionUser, PERMISSIONS.PAYMENT_RECORD)) {
      return forbidden(res, strings.errors.permissionDenied);
    }
  } else {
    if (!hasPermission(sessionUser, PERMISSIONS.PAYMENT_RECORD_OWN)) {
      return forbidden(res, "Only this group's supervisor can record who paid a bill.");
    }
    if (userId !== sessionUser.id) {
      return forbidden(res, 'You can only record your own payment.');
    }
    if (!(await isGroupMember(bill.groupId, sessionUser.id))) {
      return forbidden(res, 'You are not a member of this group.');
    }
  }

  if (!(await isGroupMember(bill.groupId, userId))) {
    return badRequest(res, 'That member does not belong to this group.');
  }

  let recipientId: string | null = null;
  if (typeof toUserId === 'string' && toUserId) {
    if (toUserId === userId) {
      return badRequest(res, 'Choose someone else to receive the payment.');
    }
    if (!(await isGroupMember(bill.groupId, toUserId))) {
      return badRequest(res, 'The recipient must be a member of this group.');
    }
    recipientId = toUserId;
  }

  const shares = bill.shares.map((s) => ({ userId: s.userId, userName: s.user.name, amount: s.amount }));
  const existingRows = (await collectionsByBill([billId])).get(billId) ?? [];
  const state = buildCollectionState(shares, existingRows);
  const current = state.shares.find((s) => s.userId === userId);

  let value: number;
  if (settle === true) {
    if (!current || current.outstanding <= 0) {
      return badRequest(res, 'That member has nothing left to pay on this bill.');
    }
    value = current.outstanding;
  } else {
    value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return badRequest(res, 'Amount must be a positive number.');
    }
    if (value > 100_000_000) {
      return badRequest(res, 'That amount looks wrong. Please check it.');
    }
  }

  const day = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayKey();

  const paid = round2(value);
  const owed = round2(current?.share ?? 0);
  const paidAfter = round2((current?.paid ?? 0) + paid);

  const offsets = recipientId
    ? [{ userId: recipientId, amount: paid }]
    : allocateToFronters(state.shares, userId, paid);

  const { payerRow, recipientName } = await prisma.$transaction(async (tx) => {
    const row = await tx.paymentStatus.create({
      data: {
        userId,
        groupId: bill.groupId,
        expenseId: billId,
        recordedById: sessionUser.id,
        toUserId: recipientId,
        amountDue: owed,
        amountPaid: paid,
        status: owed > 0 ? shareStatus(Math.round(owed * 100), Math.round(paidAfter * 100)) : PAYMENT_STATUS.PAID,
        dueDate: dayToUtcDate(day),
        publishedAt: new Date()
      },
      include: { user: { select: { name: true } }, toUser: { select: { name: true } } }
    });

    for (const offset of offsets) {
      const recipientCurrent = state.shares.find((s) => s.userId === offset.userId);
      await tx.paymentStatus.create({
        data: {
          userId: offset.userId,
          groupId: bill.groupId,
          expenseId: billId,
          recordedById: sessionUser.id,
          offsetOfId: row.id,
          amountDue: round2(recipientCurrent?.share ?? 0),
          amountPaid: -offset.amount,
          status: PAYMENT_STATUS.OFFSET,
          dueDate: dayToUtcDate(day),
          publishedAt: new Date()
        }
      });
    }

    return { payerRow: row, recipientName: row.toUser?.name ?? null };
  });

  const refreshedRows = [
    ...existingRows,
    {
      id: payerRow.id,
      userId: payerRow.userId,
      userName: payerRow.user.name,
      amount: payerRow.amountPaid,
      date: payerRow.dueDate,
      recordedAt: payerRow.createdAt,
      recordedByName: sessionUser.name,
      reversalOfId: null,
      isReversed: false,
      isLinked: offsets.length > 0,
      toUserId: payerRow.toUserId,
      toUserName: recipientName,
      fromUserId: null,
      fromUserName: null,
      fromAdvance: false
    }
  ];
  for (const offset of offsets) {
    refreshedRows.push({
      id: `${payerRow.id}-offset-${offset.userId}`,
      userId: offset.userId,
      userName: recipientName ?? '',
      amount: -offset.amount,
      date: payerRow.dueDate,
      recordedAt: payerRow.createdAt,
      recordedByName: sessionUser.name,
      reversalOfId: null,
      isReversed: false,
      isLinked: true,
      toUserId: null,
      toUserName: null,
      fromUserId: userId,
      fromUserName: payerRow.user.name,
      fromAdvance: false
    });
  }
  const refreshed = buildCollectionState(shares, refreshedRows);

  invalidatePrefix(billsListGroupPrefix(bill.groupId));

  return created(res, {
    collection: {
      id: payerRow.id,
      userId: payerRow.userId,
      userName: payerRow.user.name,
      amount: round2(payerRow.amountPaid),
      date: utcDateToDay(payerRow.dueDate),
      toUserId: payerRow.toUserId,
      toUserName: recipientName
    },
    totals: {
      collected: refreshed.collected,
      outstanding: refreshed.outstanding,
      unpaidMemberCount: refreshed.unpaidMemberCount,
      isFullyCollected: refreshed.isFullyCollected
    }
  });
}

export default withAudit(handler);
