import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { buildGroupReport } from '@/lib/group-report';
import { categoryLabels } from '@/lib/expense-categories';
import { buildCollectionState, collectionsByBill } from '@/lib/bill-collections';
import { BILL_TYPE_FILTER } from '@/lib/constants';
import { EXPENSE_TYPES } from '@/lib/constants';
import { parseMonth, round2, utcDateToDay } from '@/lib/month';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

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
  if (!hasPermission(sessionUser, PERMISSIONS.PAYMENT_VIEW)) {
    return forbidden(res, strings.errors.permissionDenied);
  }

  const canManage = await canManageGroup(groupId, sessionUser);
  const monthParam = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
  const { start, nextStart } = parseMonth(monthParam);

  const [report, bazarRows, billRows, labels] = await Promise.all([
    buildGroupReport(group, monthParam),
    prisma.expenseEntry.findMany({
      where: { groupId, type: EXPENSE_TYPES.BAZAR, date: { gte: start, lt: nextStart }, payerId: { not: null } },
      select: { id: true, date: true, amount: true, payerId: true },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }]
    }),
    prisma.expenseEntry.findMany({
      where: { groupId, type: BILL_TYPE_FILTER, date: { gte: start, lt: nextStart } },
      select: { id: true, type: true, shares: { select: { userId: true, amount: true, user: { select: { name: true } } } } }
    }),
    categoryLabels(groupId)
  ]);

  const collections = await collectionsByBill(billRows.map((row) => row.id));
  const billPaid = new Map<string, number>();
  const billOwed = new Map<string, number>();
  for (const bill of billRows) {
    const state = buildCollectionState(
      bill.shares.map((share) => ({ userId: share.userId, userName: share.user.name, amount: share.amount })),
      collections.get(bill.id) ?? []
    );
    for (const share of state.shares) {
      billPaid.set(share.userId, round2((billPaid.get(share.userId) ?? 0) + share.paid));
      billOwed.set(share.userId, round2((billOwed.get(share.userId) ?? 0) + share.outstanding));
    }
  }

  const entriesByPayer = new Map<string, { id: string; date: string; amount: number }[]>();
  for (const row of bazarRows) {
    const list = entriesByPayer.get(row.payerId!) ?? [];
    list.push({ id: row.id, date: utcDateToDay(row.date), amount: row.amount });
    entriesByPayer.set(row.payerId!, list);
  }

  return ok(res, {
    through: report.through,
    currentUserId: sessionUser.id,
    canManage,
    categoryLabels: labels,
    group: {
      bazar: report.totals.bazar,
      bazarOutstanding: round2(report.totals.bazar - report.totals.bazarPaid),
      bills: report.totals.bills,
      rent: round2(report.byType.RENT ?? 0),
      additional: round2(report.totals.bills - (report.byType.RENT ?? 0))
    },
    members: report.members.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      isActive: member.isActive,
      meals: member.meals,
      bazarPaid: member.bazarPaid,
      billShare: member.billShare,
      billShareByType: member.billShareByType,
      totalCost: member.totalCost,
      collected: member.collected,
      billPaid: billPaid.get(member.id) ?? 0,
      billOutstanding: billOwed.get(member.id) ?? 0,
      due: member.due,
      status: member.status,
      bazarEntries: entriesByPayer.get(member.id) ?? []
    }))
  });
}

export default withAudit(handler);
