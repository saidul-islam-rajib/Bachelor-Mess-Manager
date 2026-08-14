import { prisma } from '@/lib/prisma';
import { buildGroupReport, type GroupReport } from '@/lib/group-report';
import { buildCollectionState, collectionsByBill } from '@/lib/bill-collections';
import { BILL_TYPE_FILTER, EXPENSE_TYPES } from '@/lib/constants';
import { parseMonth, round2 } from '@/lib/month';
import type { SettlementGroup } from '@/lib/settlement';
import { cached } from '@/lib/cache';
import { dashboardGroupKey } from '@/lib/cache-keys';
import { cacheConfig } from '@/config';

export type DayRatePoint = {
  date: string;
  rate: number;
  meals: number;
};

export type GroupDashboardCard = {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  meals: number;
  mealRate: number;
  highestDayRate: number;
  lowestDayRate: number;
  rateMode: string;
  bazar: number;
  bazarPaid: number;
  bazarOutstanding: number;
  bills: number;
  billsCollected: number;
  billsOutstanding: number;
  rent: number;
  additional: number;
  expense: number;
  collected: number;
  outstanding: number;
  byType: Record<string, number>;
  days: DayRatePoint[];
  members: { id: string; name: string; due: number; status: string; stayDays: number }[];
};

type BillLedgerTotals = { amount: number; collected: number; outstanding: number };

async function billLedgerTotals(groupId: string, start: Date, nextStart: Date): Promise<BillLedgerTotals> {
  const rows = await prisma.expenseEntry.findMany({
    where: { groupId, type: BILL_TYPE_FILTER, date: { gte: start, lt: nextStart } },
    include: { shares: true }
  });
  if (rows.length === 0) return { amount: 0, collected: 0, outstanding: 0 };

  const collections = await collectionsByBill(rows.map((row) => row.id));

  let amount = 0;
  let collected = 0;
  let outstanding = 0;
  for (const row of rows) {
    const state = buildCollectionState(
      row.shares.map((s) => ({ userId: s.userId, userName: '', amount: s.amount })),
      collections.get(row.id) ?? []
    );
    amount = round2(amount + row.amount);
    collected = round2(collected + state.collected);
    outstanding = round2(outstanding + state.outstanding);
  }
  return { amount, collected, outstanding };
}

function dayPoints(report: GroupReport): DayRatePoint[] {
  return report.days
    .filter((day) => day.meals > 0)
    .map((day) => ({ date: day.date, rate: day.rate, meals: day.meals }));
}

async function buildCard(
  group: SettlementGroup & { name: string; status: string },
  month: string
): Promise<GroupDashboardCard> {
  const { start, nextStart } = parseMonth(month);

  const [report, billTotals] = await Promise.all([
    buildGroupReport(group, month),
    billLedgerTotals(group.id, start, nextStart)
  ]);

  const rates = dayPoints(report).map((day) => day.rate);
  const highestDayRate = rates.length > 0 ? Math.max(...rates) : 0;
  const lowestDayRate = rates.length > 0 ? Math.min(...rates) : 0;

  const rent = report.byType[EXPENSE_TYPES.RENT] ?? 0;
  const additional = Math.max(0, round2(report.totals.bills - rent));
  const bazarOutstanding = Math.max(0, round2(report.totals.bazar - report.totals.bazarPaid));

  return {
    id: group.id,
    name: group.name,
    status: group.status,
    memberCount: report.totals.memberCount,
    meals: report.totals.meals,
    mealRate: report.totals.mealRate,
    highestDayRate,
    lowestDayRate,
    rateMode: report.effectiveRateMode,
    bazar: report.totals.bazar,
    bazarPaid: report.totals.bazarPaid,
    bazarOutstanding,
    bills: report.totals.bills,
    billsCollected: billTotals.collected,
    billsOutstanding: billTotals.outstanding,
    rent,
    additional,
    expense: report.totals.expense,
    collected: report.totals.collected,
    outstanding: report.totals.outstanding,
    byType: report.byType,
    days: dayPoints(report),
    members: report.members.map((member) => ({
      id: member.id,
      name: member.name,
      due: member.due,
      status: member.status,
      stayDays: member.stayDays
    }))
  };
}

export async function buildGroupDashboardCard(
  group: SettlementGroup & { name: string; status: string },
  month: string
): Promise<GroupDashboardCard> {
  return cached(dashboardGroupKey(group.id, month), cacheConfig.dashboardGroupMs, () => buildCard(group, month));
}
