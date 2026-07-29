import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { BILL_TYPE_VALUES, SPLIT_METHODS } from '@/lib/constants';
import { computeShares, isBillType } from '@/lib/bills';
import { dayToUtcDate, round2, utcDateToDay } from '@/lib/month';
import { recordExpenseDeleted, recordExpenseUpdated } from '@/lib/expense-history';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    return methodNotAllowed(res, ['PATCH', 'DELETE']);
  }

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const billId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!billId) {
    return badRequest(res, 'Bill ID is required.');
  }

  const bill = await prisma.expenseEntry.findUnique({ where: { id: billId } });
  if (!bill || !BILL_TYPE_VALUES.includes(bill.type)) {

    return notFound(res, 'Bill not found.');
  }

  if (!(await canManageGroup(bill.groupId, sessionUser))) {
    return forbidden(res, "Only this group's supervisor can change bills.");
  }

  if (req.method === 'DELETE') {

    await prisma.expenseEntry.delete({ where: { id: billId } });

    await recordExpenseDeleted({
      expenseId: billId,
      groupId: bill.groupId,
      actorId: sessionUser.id,
      previous: { amount: bill.amount, date: bill.date, note: bill.note }
    });

    return ok(res, { deleted: true });
  }

  const { type, amount, date, note, splitMethod, shares, isReceived, payerId } = req.body as Record<string, unknown>;

  const data: Record<string, unknown> = {};

  if (type !== undefined) {
    if (!isBillType(type)) return badRequest(res, 'Choose a valid cost type.');
    data.type = type;
  }

  if (amount !== undefined) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return badRequest(res, 'Amount must be a positive number.');
    }
    if (value > 100_000_000) {
      return badRequest(res, 'That amount looks wrong. Please check it.');
    }
    data.amount = round2(value);
  }

  if (date !== undefined) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return badRequest(res, 'A valid date (YYYY-MM-DD) is required.');
    }
    data.date = dayToUtcDate(date);
  }

  if (note !== undefined) {
    data.note = typeof note === 'string' ? note.trim() : '';
  }

  if (isReceived !== undefined) {
    data.isReceived = isReceived === true;
  }

  if (payerId !== undefined) {
    if (payerId === null || payerId === '') {
      data.payerId = null;
    } else if (typeof payerId === 'string' && (await isGroupMember(bill.groupId, payerId))) {
      data.payerId = payerId;
    } else {
      return badRequest(res, 'The person who paid must be a member of this group.');
    }
  }

  if (Object.keys(data).length === 0 && splitMethod === undefined && shares === undefined) {
    return badRequest(res, 'Nothing to update.');
  }

  const total = (data.amount as number | undefined) ?? bill.amount;
  const method =
    splitMethod === undefined
      ? bill.splitMethod
      : splitMethod === SPLIT_METHODS.CUSTOM
        ? SPLIT_METHODS.CUSTOM
        : SPLIT_METHODS.EQUAL;

  const mustRecompute = data.amount !== undefined || splitMethod !== undefined || shares !== undefined;

  let computedShares: { userId: string; amount: number }[] | null = null;
  if (mustRecompute) {

    const shareInput =
      shares !== undefined
        ? shares
        : method === SPLIT_METHODS.CUSTOM
          ? (await prisma.expenseShare.findMany({ where: { expenseId: billId }, select: { userId: true, amount: true } }))
          : undefined;

    const computed = await computeShares({ groupId: bill.groupId, total, splitMethod: method, shares: shareInput });
    if (!computed.ok) {
      return badRequest(res, computed.error);
    }
    computedShares = computed.shares;
    data.splitMethod = method;
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (computedShares) {
      await tx.expenseShare.deleteMany({ where: { expenseId: billId } });
      await tx.expenseShare.createMany({
        data: computedShares.map((s) => ({ expenseId: billId, userId: s.userId, amount: s.amount }))
      });
    }
    return tx.expenseEntry.update({
      where: { id: billId },
      data,
      include: { shares: { include: { user: { select: { id: true, name: true } } } } }
    });
  });

  await recordExpenseUpdated({
    expenseId: billId,
    groupId: bill.groupId,
    actorId: sessionUser.id,
    previous: { amount: bill.amount, date: bill.date, note: bill.note },
    next: { amount: updated.amount, date: updated.date, note: updated.note }
  });

  return ok(res, {
    bill: {
      id: updated.id,
      type: updated.type,
      amount: round2(updated.amount),
      date: utcDateToDay(updated.date),
      note: updated.note ?? '',
      isReceived: updated.isReceived,
      splitMethod: updated.splitMethod,
      shares: updated.shares.map((s) => ({ userId: s.userId, userName: s.user.name, amount: round2(s.amount) }))
    }
  });
}

export default withAudit(handler);
