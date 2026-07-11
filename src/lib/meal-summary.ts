import { prisma } from '@/lib/prisma';
import { parseMonth, round2, utcDateToDay } from '@/lib/month';

// The mess costing rule: groceries are pooled per day, and each day's spend is
// divided by that day's total weighted meals to get a ৳/meal rate. A member's
// cost is the sum of (that day's rate x their weighted meals). "paid" is what a
// member fronted out of pocket for groceries, so balance = paid - cost.

export type SummaryMember = {
  id: string;
  name: string;
  email: string;
  meals: number;
  cost: number;
  paid: number;
  balance: number;
};

export type SummaryDay = { date: string; meals: number; expense: number; perMealPrice: number };

export type MealSummary = {
  weights: { breakfast: number; lunch: number; dinner: number };
  days: SummaryDay[];
  members: SummaryMember[];
  totals: { expense: number; meals: number; cost: number; memberCount: number };
};

type GroupWeights = {
  id: string;
  mealWeightBreakfast: number;
  mealWeightLunch: number;
  mealWeightDinner: number;
};

export async function buildMealSummary(group: GroupWeights, monthKey?: string): Promise<MealSummary> {
  const { start, nextStart } = parseMonth(monthKey);
  const groupId = group.id;

  const wB = group.mealWeightBreakfast;
  const wL = group.mealWeightLunch;
  const wD = group.mealWeightDinner;

  const [memberships, mealRows, expenseRows] = await Promise.all([
    prisma.membership.findMany({
      where: { groupId, isActive: true },
      include: { user: { select: { id: true, name: true, email: true } } }
    }),
    prisma.mealEntry.findMany({ where: { groupId, date: { gte: start, lt: nextStart } } }),
    prisma.expenseEntry.findMany({ where: { groupId, type: 'BAZAR', date: { gte: start, lt: nextStart } } })
  ]);

  // day -> total grocery expense
  const expenseByDay = new Map<string, number>();
  const paidByUser = new Map<string, number>();
  for (const e of expenseRows) {
    const day = utcDateToDay(e.date);
    expenseByDay.set(day, (expenseByDay.get(day) ?? 0) + e.amount);
    if (e.payerId) paidByUser.set(e.payerId, (paidByUser.get(e.payerId) ?? 0) + e.amount);
  }

  // day -> (userId -> weighted meals that day)
  const mealsByDay = new Map<string, Map<string, number>>();
  for (const m of mealRows) {
    const day = utcDateToDay(m.date);
    const weighted = m.breakfastCount * wB + m.lunchCount * wL + m.dinnerCount * wD;
    if (weighted === 0) continue;
    if (!mealsByDay.has(day)) mealsByDay.set(day, new Map());
    mealsByDay.get(day)!.set(m.userId, weighted);
  }

  const memberMeals = new Map<string, number>();
  const memberCost = new Map<string, number>();

  const allDays = new Set<string>([...mealsByDay.keys(), ...expenseByDay.keys()]);
  const days = [...allDays].sort().map((day) => {
    const perUser = mealsByDay.get(day) ?? new Map<string, number>();
    const dayMeals = [...perUser.values()].reduce((a, b) => a + b, 0);
    const dayExpense = expenseByDay.get(day) ?? 0;
    const perMealPrice = dayMeals > 0 ? round2(dayExpense / dayMeals) : 0;

    for (const [userId, weighted] of perUser) {
      memberMeals.set(userId, (memberMeals.get(userId) ?? 0) + weighted);
      memberCost.set(userId, round2((memberCost.get(userId) ?? 0) + round2(perMealPrice * weighted)));
    }

    return { date: day, meals: round2(dayMeals), expense: round2(dayExpense), perMealPrice };
  });

  const members = memberships.map((m) => {
    const meals = round2(memberMeals.get(m.userId) ?? 0);
    const cost = round2(memberCost.get(m.userId) ?? 0);
    const paid = round2(paidByUser.get(m.userId) ?? 0);
    return { id: m.userId, name: m.user.name, email: m.user.email, meals, cost, paid, balance: round2(paid - cost) };
  });

  const totalExpense = round2(expenseRows.reduce((a, e) => a + e.amount, 0));
  const totalMeals = round2([...memberMeals.values()].reduce((a, b) => a + b, 0));
  const totalCost = round2(members.reduce((a, m) => a + m.cost, 0));

  return {
    weights: { breakfast: wB, lunch: wL, dinner: wD },
    days,
    members,
    totals: { expense: totalExpense, meals: totalMeals, cost: totalCost, memberCount: memberships.length }
  };
}
