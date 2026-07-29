// The single source of truth for "who owes what" in a group, for one month.
//
// A member's balance has four moving parts:
//
//   meal cost    their share of the bazar, priced day by day at that day's rate
//   bill share   their slice of rent, utilities, chef, wifi, other
//   bazar paid   money they fronted by doing the shopping themselves
//   collected    money the supervisor has recorded as received from them
//
//   due = mealCost + billShare - bazarPaid - collected
//
// A negative due means the mess owes them (they shopped more than they ate).
// Every screen that shows money — payments, dashboards, the group page — reads
// this, so no two pages can disagree about a member's balance.

import { prisma } from '@/lib/prisma';
import { billSharesByUser, billTotalsByType } from '@/lib/bills';
import { buildMealSummary, type MealSummary } from '@/lib/meal-summary';
import { PAYMENT_STATUS } from '@/lib/constants';
import { parseMonth, round2 } from '@/lib/month';
import { stayDays } from '@/lib/groups';

export type ReportMember = {
  id: string;
  name: string;
  email: string;
  meals: number;
  mealCost: number;
  billShare: number;
  totalCost: number;
  bazarPaid: number;
  collected: number;
  due: number;
  status: string;
  joinedAt: string;
  stayDays: number;
};

export type GroupReport = {
  month: string;
  weights: MealSummary['weights'];
  days: MealSummary['days'];
  members: ReportMember[];
  totals: {
    bazar: number;
    bills: number;
    expense: number;
    meals: number;
    mealRate: number;
    mealCost: number;
    collected: number;
    outstanding: number;
    refunds: number;
    memberCount: number;
  };
  byType: Record<string, number>;
};

type GroupInput = {
  id: string;
  mealWeightBreakfast: number;
  mealWeightLunch: number;
  mealWeightDinner: number;
};

export function paymentState(cost: number, settled: number): string {
  if (cost <= 0) return PAYMENT_STATUS.PAID;
  if (settled <= 0) return PAYMENT_STATUS.PENDING;
  // A hair of tolerance so float noise does not report a fully paid member as partial.
  if (settled + 0.01 < cost) return PAYMENT_STATUS.PARTIAL;
  return PAYMENT_STATUS.PAID;
}

export async function buildGroupReport(group: GroupInput, monthKey?: string): Promise<GroupReport> {
  const { key, start, nextStart } = parseMonth(monthKey);
  const groupId = group.id;

  const [summary, billShares, byType, paymentRows, memberships] = await Promise.all([
    buildMealSummary(group, monthKey),
    billSharesByUser(groupId, start, nextStart),
    billTotalsByType(groupId, start, nextStart),
    prisma.paymentStatus.findMany({
      where: { groupId, dueDate: { gte: start, lt: nextStart } },
      select: { userId: true, amountPaid: true }
    }),
    prisma.membership.findMany({
      where: { groupId, isActive: true },
      select: { userId: true, joinedAt: true, leftAt: true }
    })
  ]);

  const collectedByUser = new Map<string, number>();
  for (const payment of paymentRows) {
    collectedByUser.set(payment.userId, round2((collectedByUser.get(payment.userId) ?? 0) + payment.amountPaid));
  }

  const membershipByUser = new Map(memberships.map((m) => [m.userId, m]));

  const members: ReportMember[] = summary.members.map((member) => {
    const billShare = round2(billShares.get(member.id) ?? 0);
    const totalCost = round2(member.cost + billShare);
    const collected = round2(collectedByUser.get(member.id) ?? 0);
    const settled = round2(member.paid + collected);
    const membership = membershipByUser.get(member.id);

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      meals: member.meals,
      mealCost: member.cost,
      billShare,
      totalCost,
      bazarPaid: member.paid,
      collected,
      due: round2(totalCost - settled),
      status: paymentState(totalCost, settled),
      joinedAt: membership ? membership.joinedAt.toISOString() : new Date().toISOString(),
      stayDays: membership ? stayDays(membership.joinedAt, membership.leftAt) : 0
    };
  });

  const billsTotal = round2(Object.values(byType).reduce((a, b) => a + b, 0));
  const totalMeals = summary.totals.meals;

  return {
    month: key,
    weights: summary.weights,
    days: summary.days,
    members,
    totals: {
      bazar: summary.totals.expense,
      bills: billsTotal,
      expense: round2(summary.totals.expense + billsTotal),
      meals: totalMeals,
      // Month-level average. The per-day rates in `days` are what actually price
      // each member's meals; this is the headline number people ask for.
      mealRate: totalMeals > 0 ? round2(summary.totals.expense / totalMeals) : 0,
      mealCost: summary.totals.cost,
      collected: round2(members.reduce((a, m) => a + m.collected, 0)),
      outstanding: round2(members.reduce((a, m) => a + Math.max(0, m.due), 0)),
      refunds: round2(members.reduce((a, m) => a + Math.max(0, -m.due), 0)),
      memberCount: members.length
    },
    byType
  };
}
