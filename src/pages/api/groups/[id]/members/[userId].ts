import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { buildGroupReport } from '@/lib/group-report';
import { categoryLabels } from '@/lib/expense-categories';
import { EXPENSE_TYPES } from '@/lib/constants';
import { daysInMonth, parseMonth, round2, utcDateToDay } from '@/lib/month';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const groupId = queryValue(req.query.id);
  const userId = queryValue(req.query.userId);
  if (!groupId || !userId) {
    return badRequest(res, 'Group ID and member ID are required.');
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

  const monthParam = queryValue(req.query.month);
  const { key: monthKey, start, nextStart } = parseMonth(monthParam);
  const canManage = await canManageGroup(groupId, sessionUser);

  const [user, report, bazarRows, mealRows, paymentRows, schedule, labels] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, profileImage: true }
    }),
    buildGroupReport(group, monthParam),
    prisma.expenseEntry.findMany({
      where: { groupId, type: EXPENSE_TYPES.BAZAR, payerId: userId, date: { gte: start, lt: nextStart } },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }]
    }),
    prisma.mealEntry.findMany({
      where: { groupId, userId, date: { gte: start, lt: nextStart } },
      orderBy: { date: 'asc' }
    }),
    prisma.paymentStatus.findMany({
      where: { groupId, userId, dueDate: { gte: start, lt: nextStart } },
      include: { expense: { select: { id: true, type: true } } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
    }),
    prisma.bazarSchedule.findUnique({
      where: { groupId_monthKey: { groupId, monthKey } },
      include: { days: { where: { userId }, orderBy: { day: 'asc' } } }
    }),
    categoryLabels(groupId)
  ]);

  if (!user) {
    return notFound(res, strings.members.userGone);
  }

  const member = report.members.find((row) => row.id === userId);
  if (!member) {
    return notFound(res, 'That member has nothing recorded in this group for this month.');
  }

  const dayKeys = daysInMonth(monthKey);

  return ok(res, {
    monthKey,
    through: report.through,
    canManage,
    isSelf: sessionUser.id === userId,
    currentUserId: sessionUser.id,
    group: { id: group.id, name: group.name },
    categoryLabels: labels,
    member: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profileImage: user.profileImage,
      isActive: member.isActive,
      joinedAt: member.joinedAt,
      leftAt: member.leftAt,
      stayDays: member.stayDays,
      status: member.status
    },
    money: {
      carryIn: member.carryIn,
      mealCost: member.mealCost,
      billShare: member.billShare,
      billShareByType: member.billShareByType,
      totalCost: member.totalCost,
      bazarPaid: member.bazarPaid,
      collected: member.collected,
      due: member.due
    },
    meals: {
      total: member.meals,
      rate: report.totals.mealRate,
      days: mealRows
        .filter((row) => row.totalMeals > 0)
        .map((row) => ({
          date: utcDateToDay(row.date),
          breakfast: row.breakfastCount,
          lunch: row.lunchCount,
          dinner: row.dinnerCount,
          total: row.totalMeals
        }))
    },
    bazarEntries: bazarRows.map((row) => ({
      id: row.id,
      date: utcDateToDay(row.date),
      amount: round2(row.amount),
      note: row.note ?? '',
      items: row.items.map((item) => ({ id: item.id, name: item.name, amount: round2(item.amount) }))
    })),
    dutyDays: (schedule?.days ?? []).map((row) => ({
      day: row.day,
      date: dayKeys[row.day - 1] ?? null
    })),
    payments: paymentRows.map((row) => ({
      id: row.id,
      date: utcDateToDay(row.dueDate),
      amount: round2(row.amountPaid),
      status: row.status,
      billType: row.expense?.type ?? null
    }))
  });
}

export default withAudit(handler);
