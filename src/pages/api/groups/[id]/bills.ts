import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { BILL_TYPE_FILTER, SPLIT_METHODS } from '@/lib/constants';
import { buildCollectionState, collectionsByBill } from '@/lib/bill-collections';
import { computeShares, isBillType } from '@/lib/bills';
import { categoryLabels, isValidBillType, listCategories } from '@/lib/expense-categories';
import { dayToUtcDate, parseMonth, round2, utcDateToDay } from '@/lib/month';
import { recordExpenseCreated } from '@/lib/expense-history';
import { GROUP_CLOSED_MESSAGE, isGroupWritable } from '@/lib/groups';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
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
    if (!hasPermission(sessionUser, PERMISSIONS.BILL_VIEW)) {
      return forbidden(res, strings.errors.permissionDenied);
    }

    const monthKey = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
    const { start, nextStart } = parseMonth(monthKey);

    const [rows, memberships] = await Promise.all([
      prisma.expenseEntry.findMany({
        where: { groupId, type: BILL_TYPE_FILTER, date: { gte: start, lt: nextStart } },
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

    const collections = await collectionsByBill(rows.map((row) => row.id));

    const bills = rows.map((row) => {
      const state = buildCollectionState(
        row.shares.map((s) => ({ userId: s.userId, userName: s.user.name, amount: s.amount })),
        collections.get(row.id) ?? []
      );

      return {
        id: row.id,
        type: row.type,
        amount: round2(row.amount),
        date: utcDateToDay(row.date),
        note: row.note ?? '',
        isReceived: row.isReceived,
        splitMethod: row.splitMethod,
        payer: row.payer ? { id: row.payer.id, name: row.payer.name } : null,
        shares: state.shares.map((s) => ({
          userId: s.userId,
          userName: s.userName,
          amount: s.share,
          paid: s.paid,
          outstanding: s.outstanding,
          advance: s.advance,
          status: s.status,
          collections: s.collections.map((c) => ({
            id: c.id,
            amount: round2(c.amount),
            date: utcDateToDay(c.date),
            recordedAt: c.recordedAt.toISOString(),
            recordedByName: c.recordedByName,
            isReversal: Boolean(c.reversalOfId),
            isReversed: c.isReversed,
            toUserName: c.toUserName,
            fromUserName: c.fromUserName
          }))
        })),
        collected: state.collected,
        uncollected: state.outstanding,
        advance: state.advance,
        isFullyCollected: state.isFullyCollected,
        unpaidMemberCount: state.unpaidMemberCount
      };
    });

    const byType: Record<string, number> = {};
    const byMember = new Map<string, number>();
    const dueByMember = new Map<string, number>();
    for (const bill of bills) {
      byType[bill.type] = round2((byType[bill.type] ?? 0) + bill.amount);
      for (const share of bill.shares) {
        byMember.set(share.userId, round2((byMember.get(share.userId) ?? 0) + share.amount));
        dueByMember.set(share.userId, round2((dueByMember.get(share.userId) ?? 0) + share.outstanding));
      }
    }

    const [categories, labels] = await Promise.all([listCategories(groupId), categoryLabels(groupId)]);

    return ok(res, {
      canManage,
      canRecordOwn: hasPermission(sessionUser, PERMISSIONS.PAYMENT_RECORD_OWN),
      currentUserId: sessionUser.id,
      categories,
      categoryLabels: labels,
      bills,
      members: memberships.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email })),
      totals: {
        total: round2(bills.reduce((a, b) => a + b.amount, 0)),
        settled: round2(bills.filter((b) => b.isReceived).reduce((a, b) => a + b.amount, 0)),
        outstanding: round2(bills.filter((b) => !b.isReceived).reduce((a, b) => a + b.amount, 0)),
        collected: round2(bills.reduce((a, b) => a + b.collected, 0)),
        uncollected: round2(bills.reduce((a, b) => a + b.uncollected, 0)),
        byType,
        byMember: Object.fromEntries(byMember),
        dueByMember: Object.fromEntries(dueByMember)
      }
    });
  }

  if (req.method === 'POST') {

    if (!canManage) {
      return forbidden(res, "Only this group's supervisor can record bills.");
    }
    if (!hasPermission(sessionUser, PERMISSIONS.BILL_MANAGE)) {
      return forbidden(res, strings.errors.permissionDenied);
    }
    if (!isGroupWritable(group)) {
      return forbidden(res, GROUP_CLOSED_MESSAGE);
    }

    const { type, amount, date, note, splitMethod, shares, isReceived, payerId } = req.body as Record<string, unknown>;

    if (!isBillType(type) || !(await isValidBillType(groupId, type))) {
      return badRequest(res, 'Choose a cost type from this group’s list.');
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
