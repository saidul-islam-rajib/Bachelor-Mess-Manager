import { buildSettlement, type SettlementGroup } from '@/lib/settlement';
import { round2 } from '@/lib/month';

export type SummaryMember = {
  id: string;
  name: string;
  email: string;
  meals: number;
  breakfasts: number;
  lunches: number;
  dinners: number;
  cost: number;
  paid: number;
  balance: number;
  isActive: boolean;
};

export type SummaryDay = { date: string; meals: number; expense: number; perMealPrice: number };

export type MealSummary = {
  rateMode: string;
  through: string;
  weights: { breakfast: number; lunch: number; dinner: number };
  days: SummaryDay[];
  members: SummaryMember[];
  totals: { expense: number; meals: number; cost: number; mealRate: number; memberCount: number };
};

export async function buildMealSummary(group: SettlementGroup, monthKey?: string): Promise<MealSummary> {
  const settlement = await buildSettlement(group, monthKey);

  return {
    rateMode: settlement.rateMode,
    through: settlement.through,
    weights: settlement.weights,
    days: settlement.days.map((day) => ({
      date: day.date,
      meals: day.meals,
      expense: day.bazar,
      perMealPrice: day.rate
    })),
    members: settlement.members.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      meals: member.meals,
      breakfasts: member.breakfasts,
      lunches: member.lunches,
      dinners: member.dinners,
      cost: member.mealCost,
      paid: member.bazarPaid,
      balance: round2(member.bazarPaid - member.mealCost),
      isActive: member.isActive
    })),
    totals: {
      expense: settlement.totals.bazar,
      meals: settlement.totals.meals,
      cost: settlement.totals.mealCost,
      mealRate: settlement.totals.mealRate,
      memberCount: settlement.totals.memberCount
    }
  };
}
