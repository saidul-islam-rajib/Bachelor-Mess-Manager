import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getActiveMembership, getSessionUser, requireAdmin, requireSupervisorOrAdmin } from '@/lib/auth-utils';
import { methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { buildGroupReport, type ReportMember } from '@/lib/group-report';
import { INVITATION_STATUS, USER_ROLES, USER_STATUS } from '@/lib/constants';
import { currentMonthKey, parseMonth, round2 } from '@/lib/month';
import { stayDays } from '@/lib/groups';
import { withAudit } from '@/lib/with-audit';

/** The month before `key` ("2026-01" -> "2025-12"). */
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

  // This endpoint used to be unauthenticated and returned totals across every
  // group in the system. It is now scoped to whoever is asking.
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

// ------------------------------------------------------------------- admin
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

// -------------------------------------------------------------- supervisor
async function supervisorReport(supervisorId: string, month: string) {
  const groups = await prisma.group.findMany({
    where: { supervisorId },
    orderBy: { createdAt: 'desc' }
  });

  const reports = await Promise.all(groups.map((group) => buildGroupReport(group, month)));

  const byType: Record<string, number> = {};
  let totalBazar = 0;
  let totalBills = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let totalMeals = 0;
  let totalMembers = 0;

  const unpaid: { groupId: string; groupName: string; id: string; name: string; due: number; status: string }[] = [];
  const longestStaying: { id: string; name: string; groupName: string; days: number }[] = [];

  reports.forEach((report, index) => {
    const group = groups[index];
    totalBazar = round2(totalBazar + report.totals.bazar);
    totalBills = round2(totalBills + report.totals.bills);
    totalCollected = round2(totalCollected + report.totals.collected);
    totalOutstanding = round2(totalOutstanding + report.totals.outstanding);
    totalMeals = round2(totalMeals + report.totals.meals);
    totalMembers += report.totals.memberCount;

    for (const [type, amount] of Object.entries(report.byType)) {
      byType[type] = round2((byType[type] ?? 0) + amount);
    }

    for (const member of report.members) {
      if (member.due > 0.01) {
        unpaid.push({
          groupId: group.id,
          groupName: group.name,
          id: member.id,
          name: member.name,
          due: member.due,
          status: member.status
        });
      }
      longestStaying.push({ id: member.id, name: member.name, groupName: group.name, days: member.stayDays });
    }
  });

  byType.BAZAR = totalBazar;

  return {
    groups: reports.map((report, index) => ({
      id: groups[index].id,
      name: groups[index].name,
      status: groups[index].status,
      memberCount: report.totals.memberCount,
      meals: report.totals.meals,
      mealRate: report.totals.mealRate,
      expense: report.totals.expense,
      collected: report.totals.collected,
      outstanding: report.totals.outstanding
    })),
    totals: {
      groups: groups.length,
      members: totalMembers,
      meals: totalMeals,
      bazar: totalBazar,
      bills: totalBills,
      expense: round2(totalBazar + totalBills),
      collected: totalCollected,
      outstanding: totalOutstanding
    },
    byType,
    // Biggest debts first — that is the list a supervisor actually chases.
    unpaid: unpaid.sort((a, b) => b.due - a.due).slice(0, 10),
    longestStaying: longestStaying.sort((a, b) => b.days - a.days).slice(0, 5)
  };
}

// ------------------------------------------------------------------ member
async function memberReport(userId: string, month: string) {
  const [membership, pendingInvitations] = await Promise.all([
    getActiveMembership(userId),
    prisma.invitation.count({ where: { inviteeId: userId, status: INVITATION_STATUS.PENDING } })
  ]);

  if (!membership) {
    return { group: null, pendingInvitations, current: null, previous: null };
  }

  const group = await prisma.group.findUnique({ where: { id: membership.groupId } });
  if (!group) {
    return { group: null, pendingInvitations, current: null, previous: null };
  }

  const previous = previousMonthKey(month);
  const [thisMonth, lastMonth] = await Promise.all([
    buildGroupReport(group, month),
    buildGroupReport(group, previous)
  ]);

  const me = mine(thisMonth.members, userId);
  const meLast = mine(lastMonth.members, userId);

  return {
    group: {
      id: group.id,
      name: group.name,
      supervisorId: group.supervisorId,
      memberCount: thisMonth.totals.memberCount,
      joinedAt: membership.joinedAt.toISOString(),
      stayDays: stayDays(membership.joinedAt, membership.leftAt)
    },
    pendingInvitations,
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
      groupMeals: thisMonth.totals.meals,
      groupExpense: thisMonth.totals.expense,
      groupBazar: thisMonth.totals.bazar,
      groupBills: thisMonth.totals.bills,
      byType: thisMonth.byType,
      members: thisMonth.members.map((m) => ({
        id: m.id,
        name: m.name,
        meals: m.meals,
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
