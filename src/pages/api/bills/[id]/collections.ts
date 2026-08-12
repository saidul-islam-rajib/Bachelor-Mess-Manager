import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember } from '@/lib/auth-utils';
import { badRequest, conflict, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { EXPENSE_TYPES, PAYMENT_STATUS } from '@/lib/constants';
import { buildCollectionState, collectionsByBill, reversePayment, shareStatus } from '@/lib/bill-collections';
import { dayToUtcDate, round2, todayKey, utcDateToDay } from '@/lib/month';
import { GROUP_CLOSED_MESSAGE, isGroupWritable } from '@/lib/groups';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return methodNotAllowed(res, ['POST', 'DELETE']);
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

  if (!(await canManageGroup(bill.groupId, sessionUser))) {
    return forbidden(res, "Only this group's supervisor can record who paid a bill.");
  }
  if (!hasPermission(sessionUser, PERMISSIONS.PAYMENT_RECORD)) {
    return forbidden(res, strings.errors.permissionDenied);
  }
  if (!isGroupWritable(bill.group)) {
    return forbidden(res, GROUP_CLOSED_MESSAGE);
  }

  if (req.method === 'DELETE') {
    const collectionId = Array.isArray(req.query.collectionId)
      ? req.query.collectionId[0]
      : req.query.collectionId;
    if (!collectionId) {
      return badRequest(res, 'Which entry should be reversed?');
    }

    const existing = await prisma.paymentStatus.findUnique({ where: { id: collectionId } });
    if (!existing || existing.expenseId !== billId) {
      return notFound(res, 'That entry is not recorded against this bill.');
    }

    const reversed = await reversePayment({
      paymentId: collectionId,
      actorId: sessionUser.id,
      groupId: bill.groupId
    });
    if (!reversed.ok) {
      return conflict(res, reversed.error);
    }

    return ok(res, { reversed: true, amount: reversed.amount });
  }

  const { userId, amount, date, settle } = req.body as Record<string, unknown>;

  if (typeof userId !== 'string' || !userId) {
    return badRequest(res, 'Select the member who paid.');
  }
  if (!(await isGroupMember(bill.groupId, userId))) {
    return badRequest(res, 'That member does not belong to this group.');
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

  const collection = await prisma.paymentStatus.create({
    data: {
      userId,
      groupId: bill.groupId,
      expenseId: billId,
      recordedById: sessionUser.id,
      amountDue: owed,
      amountPaid: paid,
      status: owed > 0 ? shareStatus(Math.round(owed * 100), Math.round(paidAfter * 100)) : PAYMENT_STATUS.PAID,
      dueDate: dayToUtcDate(day),
      publishedAt: new Date()
    },
    include: { user: { select: { name: true } } }
  });

  const refreshed = buildCollectionState(shares, [
    ...existingRows,
    {
      id: collection.id,
      userId: collection.userId,
      userName: collection.user.name,
      amount: collection.amountPaid,
      date: collection.dueDate,
      recordedAt: collection.createdAt,
      recordedByName: sessionUser.name,
      reversalOfId: null,
      isReversed: false
    }
  ]);

  return created(res, {
    collection: {
      id: collection.id,
      userId: collection.userId,
      userName: collection.user.name,
      amount: round2(collection.amountPaid),
      date: utcDateToDay(collection.dueDate)
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
