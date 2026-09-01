import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getActiveMembership, getSessionUser, requireAdmin, requireSupervisorOrAdmin } from '@/lib/auth-utils';
import { methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { buildGroupReport, type ReportMember } from '@/lib/group-report';
import { buildGroupDashboardCard } from '@/lib/dashboard-report';
import { getFinalSettlement } from '@/lib/final-settlement';
import { serializeChangeRequest } from '@/lib/meal-edits';
import { INVITATION_STATUS, REQUEST_STATUS, USER_ROLES, USER_STATUS } from '@/lib/constants';
import { currentMonthKey, dayToUtcDate, parseMonth, round2, todayKey } from '@/lib/month';
import { stayDays } from '@/lib/groups';
import { withAudit } from '@/lib/with-audit';

function previousMonthKey(key: string): string {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function mine(members: ReportMember[], userId: string) {
  return members.find((m) => m.id === userId) ?? null;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const monthKey = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
  const { key: month } = parseMonth(monthKey ?? currentMonthKey());

  if (requireAdmin(sessionUser)) {
    return ok(res, { role: USER_ROLES.ADMIN, month, admin: await adminReport() });
  }

  if (requireSupervisorOrAdmin(sessionUser)) {
    return ok(res, { role: USER_ROLES.SUPERVISOR, month, supervisor: await supervisorReport(sessionUser.id, month) });
  }

  return ok(res, { role: USER_ROLES.MEMBER, month, member: await memberReport(sessionUser.id, month) });
}

async function adminReport() {
  const [pendingUsers, users, groups, activeMemberships] = await Promise.all([
    prisma.user.count({ where: { status: USER_STATUS.PENDING } }),
    prisma.user.groupBy({ by: ['role'], where: { status: USER_STATUS.APPROVED }, _count: { _all: true } }),
    prisma.group.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.membership.count({ where: { isActive: true } })
  ]);

  const roleCount = (role: string) => users.find((u) => u.role === role)?._count._all ?? 0;
  const groupCount = (status: string) => groups.find((g) => g.status === status)?._count._all ?? 0;

  return {
    pendingApprovals: pendingUsers,
    members: roleCount(USER_ROLES.MEMBER),
    supervisors: roleCount(USER_ROLES.SUPERVISOR),
    activeGroups: groupCount('ACTIVE'),
    inactiveGroups: groupCount('INACTIVE'),
    activeMemberships
  };
}

async function supervisorReport(supervisorId: string, month: string) {
  const groups = await prisma.group.findMany({
    where: { OR: [{ supervisorId }, { coSupervisors: { some: { userId: supervisorId } } }] },
    orderBy: { createdAt: 'desc' }
  });

  const [cards, finalSettlements, pendingMealChangeRows] = await Promise.all([
    Promise.all(groups.map((group) => buildGroupDashboardCard(group, month))),
    Promise.all(groups.map((group) => getFinalSettlement(group))),
    prisma.mealChangeRequest.findMany({
      where: { groupId: { in: groups.map((group) => group.id) }, status: REQUEST_STATUS.PENDING },
      include: {
        user: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const pendingMealChanges = pendingMealChangeRows.map((row) => ({
    ...serializeChangeRequest(row),
    groupName: row.group.name
  }));

  const byType: Record<string, number> = {};
  let totalBazar = 0;
  let totalBazarPaid = 0;
  let totalBills = 0;
  let totalBillsCollected = 0;
  let totalBillsOutstanding = 0;
  let totalRent = 0;
  let totalAdditional = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let totalMeals = 0;
  let totalMembers = 0;

  const unpaid: { groupId: string; groupName: string; id: string; name: string; due: number; status: string }[] = [];
  const longestStaying: { id: string; name: string; groupName: string; days: number }[] = [];

  cards.forEach((card) => {
    totalBazar = round2(totalBazar + card.bazar);
    totalBazarPaid = round2(totalBazarPaid + card.bazarPaid);
    totalBills = round2(totalBills + card.bills);
    totalBillsCollected = round2(totalBillsCollected + card.billsCollected);
    totalBillsOutstanding = round2(totalBillsOutstanding + card.billsOutstanding);
    totalRent = round2(totalRent + card.rent);
    totalAdditional = round2(totalAdditional + card.additional);
    totalCollected = round2(totalCollected + card.collected);
    totalOutstanding = round2(totalOutstanding + card.outstanding);
    totalMeals = round2(totalMeals + card.meals);
    totalMembers += card.memberCount;

    for (const [type, amount] of Object.entries(card.byType)) {
      byType[type] = round2((byType[type] ?? 0) + amount);
    }

    for (const member of card.members) {
      if (member.due > 0.01) {
        unpaid.push({
          groupId: card.id,
          groupName: card.name,
          id: member.id,
          name: member.name,
          due: member.due,
          status: member.status
        });
      }
      longestStaying.push({ id: member.id, name: member.name, groupName: card.name, days: member.stayDays });
    }
  });

  byType.BAZAR = totalBazar;

  const rates = cards.filter((card) => card.meals > 0).map((card) => card.mealRate);

  return {
    groups: cards,
    finalSettlements: finalSettlements.filter((settlement): settlement is NonNullable<typeof settlement> => settlement !== null),
    pendingMealChanges,
    totals: {
      groups: groups.length,
      members: totalMembers,
      meals: totalMeals,
      mealRate: totalMeals > 0 ? round2(totalBazar / totalMeals) : 0,
      highestGroupRate: rates.length > 0 ? Math.max(...rates) : 0,
      lowestGroupRate: rates.length > 0 ? Math.min(...rates) : 0,
      bazar: totalBazar,
      bazarPaid: totalBazarPaid,
      bazarOutstanding: Math.max(0, round2(totalBazar - totalBazarPaid)),
      bills: totalBills,
      billsCollected: totalBillsCollected,
      billsOutstanding: totalBillsOutstanding,
      rent: totalRent,
      additional: totalAdditional,
      expense: round2(totalBazar + totalBills),
      collected: totalCollected,
      outstanding: totalOutstanding
    },
    byType,
    unpaid: unpaid.sort((a, b) => b.due - a.due).slice(0, 40),
    longestStaying: longestStaying.sort((a, b) => b.days - a.days).slice(0, 5)
  };
}

async function memberReport(userId: string, month: string) {
  const [membership, pendingInvitations] = await Promise.all([
    getActiveMembership(userId),
    prisma.invitation.count({ where: { inviteeId: userId, status: INVITATION_STATUS.PENDING } })
  ]);

  if (!membership) {
    return { group: null, pendingInvitations, finalSettlement: null, current: null, previous: null };
  }

  const group = await prisma.group.findUnique({ where: { id: membership.groupId } });
  if (!group) {
    return { group: null, pendingInvitations, finalSettlement: null, current: null, previous: null };
  }

  const previous = previousMonthKey(month);
  const day = todayKey();
  const [thisMonth, lastMonth, card, finalSettlement, todayMealRows] = await Promise.all([
    buildGroupReport(group, month),
    buildGroupReport(group, previous),
    buildGroupDashboardCard(group, month),
    getFinalSettlement(group),
    prisma.mealEntry.findMany({
      where: { groupId: group.id, date: dayToUtcDate(day) },
      select: { breakfastCount: true, lunchCount: true, dinnerCount: true }
    })
  ]);

  const me = mine(thisMonth.members, userId);
  const meLast = mine(lastMonth.members, userId);

  const todayMeals = todayMealRows.reduce(
    (acc, row) => ({
      breakfast: acc.breakfast + row.breakfastCount,
      lunch: acc.lunch + row.lunchCount,
      dinner: acc.dinner + row.dinnerCount,
      total: acc.total + row.breakfastCount + row.lunchCount + row.dinnerCount
    }),
    { breakfast: 0, lunch: 0, dinner: 0, total: 0 }
  );

  const pricedDays = thisMonth.days.filter((row) => row.runningRate > 0);
  const latestPriced = pricedDays.find((row) => row.date === day) ?? pricedDays[pricedDays.length - 1] ?? null;

  return {
    group: {
      id: group.id,
      name: group.name,
      supervisorId: group.supervisorId,
      memberCount: thisMonth.totals.memberCount,
      joinedAt: membership.joinedAt.toISOString(),
      stayDays: stayDays(membership.joinedAt, membership.leftAt),
      card
    },
    pendingInvitations,
    finalSettlement,
    current: {
      meals: me?.meals ?? 0,
      mealCost: me?.mealCost ?? 0,
      billShare: me?.billShare ?? 0,
      totalCost: me?.totalCost ?? 0,
      bazarPaid: me?.bazarPaid ?? 0,
      collected: me?.collected ?? 0,
      due: me?.due ?? 0,
      status: me?.status ?? 'PENDING',
      mealRate: thisMonth.totals.mealRate,
      rateMode: thisMonth.effectiveRateMode,
      dailyRate: latestPriced
        ? { date: latestPriced.date, rate: latestPriced.runningRate, isToday: latestPriced.date === day }
        : null,
      todayMeals,
      groupMeals: thisMonth.totals.meals,
      groupExpense: thisMonth.totals.expense,
      groupBazar: thisMonth.totals.bazar,
      groupBills: thisMonth.totals.bills,
      byType: thisMonth.byType,
      members: thisMonth.members.map((m) => ({
        id: m.id,
        name: m.name,
        meals: m.meals,
        mealCost: m.mealCost,
        totalCost: m.totalCost,
        due: m.due,
        status: m.status
      }))
    },
    previous: {
      month: previous,
      meals: meLast?.meals ?? 0,
      totalCost: meLast?.totalCost ?? 0,
      due: meLast?.due ?? 0,
      mealRate: lastMonth.totals.mealRate,
      groupExpense: lastMonth.totals.expense
    }
  };
}

export default withAudit(handler);
