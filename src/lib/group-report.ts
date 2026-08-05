import { PAYMENT_STATUS } from '@/lib/constants';
import { buildSettlement, settlementStatus, type Settlement, type SettlementGroup } from '@/lib/settlement';

export type ReportMember = {
  id: string;
  name: string;
  email: string;
  meals: number;
  carryIn: number;
  mealCost: number;
  billShare: number;
  billShareByType: Record<string, number>;
  totalCost: number;
  bazarPaid: number;
  collected: number;
  due: number;
  status: string;
  isActive: boolean;
  joinedAt: string;
  leftAt: string | null;
  stayDays: number;
};

export type GroupReport = {
  month: string;
  rateMode: string;
  effectiveRateMode: string;
  rateModeFallbackReason: string | null;
  weights: Settlement['weights'];
  days: Settlement['days'];
  members: ReportMember[];
  totals: {
    bazar: number;
    bills: number;
    expense: number;
    meals: number;
    mealRate: number;
    mealCost: number;
    carryIn: number;
    collected: number;
    outstanding: number;
    refunds: number;
    unallocatedBazar: number;
    unpricedMeals: number;
    memberCount: number;
  };
  byType: Record<string, number>;
  closing: Settlement['closing'];
};

export function paymentState(cost: number, settled: number): string {
  return settlementStatus(Math.round(cost * 100), Math.round(settled * 100), Math.round((cost - settled) * 100));
}

export { PAYMENT_STATUS };

export async function buildGroupReport(
  group: SettlementGroup,
  monthKey?: string,
  options: { through?: string } = {}
): Promise<GroupReport> {
  const settlement = await buildSettlement(group, monthKey, options);

  return {
    month: settlement.month,
    rateMode: settlement.rateMode,
    effectiveRateMode: settlement.effectiveRateMode,
    rateModeFallbackReason: settlement.rateModeFallbackReason,
    weights: settlement.weights,
    days: settlement.days,
    members: settlement.members.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      meals: member.meals,
      carryIn: member.carryIn,
      mealCost: member.mealCost,
      billShare: member.billShare,
      billShareByType: member.billShareByType,
      totalCost: member.totalCost,
      bazarPaid: member.bazarPaid,
      collected: member.cashPaid,
      due: member.due,
      status: member.status,
      isActive: member.isActive,
      joinedAt: member.joinedAt,
      leftAt: member.leftAt,
      stayDays: member.activeDays
    })),
    totals: {
      bazar: settlement.totals.bazar,
      bills: settlement.totals.bills,
      expense: settlement.totals.expense,
      meals: settlement.totals.meals,
      mealRate: settlement.totals.mealRate,
      mealCost: settlement.totals.mealCost,
      carryIn: settlement.totals.carryIn,
      collected: settlement.totals.cashPaid,
      outstanding: settlement.totals.outstanding,
      refunds: settlement.totals.refunds,
      unallocatedBazar: settlement.totals.unallocatedBazar,
      unpricedMeals: settlement.totals.unpricedMeals,
      memberCount: settlement.totals.memberCount
    },
    byType: settlement.byType,
    closing: settlement.closing
  };
}
