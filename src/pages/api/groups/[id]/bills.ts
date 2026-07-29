import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { BILL_TYPE_VALUES, SPLIT_METHODS } from '@/lib/constants';
import { computeShares, isBillType } from '@/lib/bills';
import { dayToUtcDate, parseMonth, round2, utcDateToDay } from '@/lib/month';
import { recordExpenseCreated } from '@/lib/expense-history';
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

  // ------------------------------------------------------------------ list
  if (req.method === 'GET') {
    const monthKey = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
    const { start, nextStart } = parseMonth(monthKey);

    const [rows, memberships] = await Promise.all([
      prisma.expenseEntry.findMany({
        where: { groupId, type: { in: BILL_TYPE_VALUES }, date: { gte: start, lt: nextStart } },
        include: {
          payer: { select: { id: true, name: true } },
          shares: { include: { user: { select: { id: true, name: true } } } }
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
      }),
      prisma.membership.findMany({
        where: { groupId, isActive: true },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: 'asc' }
      })
    ]);

    const bills = rows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: round2(row.amount),
      date: utcDateToDay(row.date),
      note: row.note ?? '',
      isReceived: row.isReceived,
      splitMethod: row.splitMethod,
      payer: row.payer ? { id: row.payer.id, name: row.payer.name } : null,
      shares: row.shares.map((s) => ({ userId: s.userId, userName: s.user.name, amount: round2(s.amount) }))
    }));

    // Per-type and per-member roll-ups, so the page never re-derives the maths.
    const byType: Record<string, number> = {};
    const byMember = new Map<string, number>();
    for (const bill of bills) {
      byType[bill.type] = round2((byType[bill.type] ?? 0) + bill.amount);
      for (const share of bill.shares) {
        byMember.set(share.userId, round2((byMember.get(share.userId) ?? 0) + share.amount));
      }
    }

    return ok(res, {
      canManage,
      currentUserId: sessionUser.id,
      bills,
      members: memberships.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email })),
      totals: {
        total: round2(bills.reduce((a, b) => a + b.amount, 0)),
        settled: round2(bills.filter((b) => b.isReceived).reduce((a, b) => a + b.amount, 0)),
        outstanding: round2(bills.filter((b) => !b.isReceived).reduce((a, b) => a + b.amount, 0)),
        byType,
        byMember: Object.fromEntries(byMember)
      }
    });
  }

  // ---------------------------------------------------------------- create
  if (req.method === 'POST') {
    // Bills are the supervisor's job: they are group-wide obligations, unlike
    // bazar which any member can log after doing the shopping.
    if (!canManage) {
      return forbidden(res, "Only this group's supervisor can record bills.");
    }

    const { type, amount, date, note, splitMethod, shares, isReceived, payerId } = req.body as Record<string, unknown>;

    if (!isBillType(type)) {
      return badRequest(res, 'Choose a valid cost type.');
    }

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return badRequest(res, 'Amount must be a positive number.');
    }
    if (value > 100_000_000) {
      return badRequest(res, 'That amount looks wrong. Please check it.');
    }

    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return badRequest(res, 'A valid date (YYYY-MM-DD) is required.');
    }

    const method = splitMethod === SPLIT_METHODS.CUSTOM ? SPLIT_METHODS.CUSTOM : SPLIT_METHODS.EQUAL;
    const total = round2(value);

    const computed = await computeShares({ groupId, total, splitMethod: method, shares });
    if (!computed.ok) {
      return badRequest(res, computed.error);
    }

    if (payerId !== undefined && payerId !== null && payerId !== '') {
      if (typeof payerId !== 'string' || !(await isGroupMember(groupId, payerId))) {
        return badRequest(res, 'The person who paid must be a member of this group.');
      }
    }

    const bill = await prisma.expenseEntry.create({
      data: {
        groupId,
        type,
        amount: total,
        date: dayToUtcDate(date),
        payerId: typeof payerId === 'string' && payerId ? payerId : null,
        isReceived: isReceived === true,
        splitMethod: method,
        note: typeof note === 'string' ? note.trim() : '',
        publishedAt: new Date(),
        shares: { create: computed.shares.map((s) => ({ userId: s.userId, amount: s.amount })) }
      },
      include: { shares: true }
    });

    // Bills land in the same change history as bazar, so "Change history" stays
    // one honest timeline of everything money-related in the group.
    await recordExpenseCreated({
      expenseId: bill.id,
      groupId,
      actorId: sessionUser.id,
      next: { amount: bill.amount, date: bill.date, note: bill.note }
    });

    return created(res, {
      bill: {
        id: bill.id,
        type: bill.type,
        amount: bill.amount,
        date: utcDateToDay(bill.date),
        note: bill.note ?? '',
        isReceived: bill.isReceived,
        splitMethod: bill.splitMethod,
        shares: bill.shares.map((s) => ({ userId: s.userId, amount: s.amount }))
      }
    });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler);
