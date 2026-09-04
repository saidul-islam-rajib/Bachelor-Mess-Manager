import { prisma } from '@/lib/prisma';
import { currentMonthKey, dayToUtcDate, daysInMonth, parseMonth, todayKey, utcDateToDay } from '@/lib/month';
import { WEEKDAYS } from '@/lib/constants';

export type PlanDay = {
  weekday: number;
  enabled: boolean;
  breakfast: number;
  lunch: number;
  dinner: number;
};

export function weekdayOf(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00.000Z`).getUTCDay();
}

function dayRange(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (cursor.getTime() <= last.getTime()) {
    days.push(utcDateToDay(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function endOfCurrentMonth(): string {
  const days = daysInMonth(currentMonthKey());
  return days[days.length - 1];
}

export function emptyPlanDays(): PlanDay[] {
  return WEEKDAYS.map((d) => ({ weekday: d.value, enabled: false, breakfast: 0, lunch: 0, dinner: 0 }));
}

type Row = {
  userId: string;
  groupId: string;
  date: Date;
  breakfastCount: number;
  lunchCount: number;
  dinnerCount: number;
  totalMeals: number;
  fromPlan: boolean;
};

function rowFor(userId: string, groupId: string, day: string, d: PlanDay): Row | null {
  if (!d.enabled) return null;

  const breakfast = Math.max(0, Math.trunc(d.breakfast));
  const lunch = Math.max(0, Math.trunc(d.lunch));
  const dinner = Math.max(0, Math.trunc(d.dinner));
  const total = breakfast + lunch + dinner;
  if (total === 0) return null;

  return {
    userId,
    groupId,
    date: dayToUtcDate(day),
    breakfastCount: breakfast,
    lunchCount: lunch,
    dinnerCount: dinner,
    totalMeals: total,
    fromPlan: true
  };
}

async function insertIgnoringCollisions(rows: Row[]) {
  if (rows.length === 0) return 0;

  try {
    const result = await prisma.mealEntry.createMany({ data: rows });
    return result.count;
  } catch {
    let created = 0;
    for (const row of rows) {
      try {
        await prisma.mealEntry.create({ data: row });
        created += 1;
      } catch {
        continue;
      }
    }
    return created;
  }
}

const laterOf = (a: string, b: string) => (a > b ? a : b);

export async function applyPlanToUpcoming(
  userId: string,
  groupId: string,
  { overwriteEdited = false }: { overwriteEdited?: boolean } = {}
) {
  const plan = await prisma.mealPlan.findUnique({
    where: { userId_groupId: { userId, groupId } },
    include: { days: true }
  });
  if (!plan) return { filled: 0 };

  const start = laterOf(todayKey(), utcDateToDay(plan.startDate));
  const end = endOfCurrentMonth();
  if (start > end) return { filled: 0 };

  await prisma.mealEntry.deleteMany({
    where: { userId, groupId, date: { gte: dayToUtcDate(start) }, fromPlan: true }
  });

  if (overwriteEdited) {
    await prisma.mealEntry.deleteMany({
      where: { userId, groupId, date: { gte: dayToUtcDate(start), lte: dayToUtcDate(end) }, fromPlan: false }
    });
  }

  if (!plan.isActive) return { filled: 0 };

  const survivors = await prisma.mealEntry.findMany({
    where: { userId, groupId, date: { gte: dayToUtcDate(start), lte: dayToUtcDate(end) } },
    select: { date: true }
  });
  const taken = new Set(survivors.map((e) => utcDateToDay(e.date)));
  const byWeekday = new Map(plan.days.map((d) => [d.weekday, d]));

  const rows: Row[] = [];
  for (const day of dayRange(start, end)) {
    if (taken.has(day)) continue;
    const planDay = byWeekday.get(weekdayOf(day));
    if (!planDay) continue;
    const row = rowFor(userId, groupId, day, planDay);
    if (row) rows.push(row);
  }

  return { filled: await insertIgnoringCollisions(rows) };
}

export async function syncPlansForMonth(groupId: string, monthKey?: string) {
  const { key, start, nextStart } = parseMonth(monthKey);

  const plans = await prisma.mealPlan.findMany({
    where: { groupId, isActive: true },
    include: { days: true }
  });
  if (plans.length === 0) return 0;

  const existing = await prisma.mealEntry.findMany({
    where: { groupId, date: { gte: start, lt: nextStart } },
    select: { userId: true, date: true }
  });
  const taken = new Set(existing.map((e) => `${e.userId}|${utcDateToDay(e.date)}`));

  const days = daysInMonth(key);
  const rows: Row[] = [];

  for (const plan of plans) {
    const planStart = utcDateToDay(plan.startDate);
    const byWeekday = new Map(plan.days.map((d) => [d.weekday, d]));

    for (const day of days) {
      if (day < planStart) continue;
      if (taken.has(`${plan.userId}|${day}`)) continue;
      const planDay = byWeekday.get(weekdayOf(day));
      if (!planDay) continue;
      const row = rowFor(plan.userId, groupId, day, planDay);
      if (row) rows.push(row);
    }
  }

  return insertIgnoringCollisions(rows);
}
