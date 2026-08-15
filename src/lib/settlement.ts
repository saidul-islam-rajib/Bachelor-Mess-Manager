import { prisma } from '@/lib/prisma';
import { BILL_TYPE_FILTER, MEAL_RATE_MODES, PAYMENT_STATUS } from '@/lib/constants';
import { dayToUtcDate, parseMonth, previousMonthKey, round2, todayKey, utcDateToDay } from '@/lib/month';
import { syncPlansForMonth } from '@/lib/meal-plan';

const WEIGHT_SCALE = 1000;
const SETTLED_TOLERANCE_PAISA = 1;

export type SettlementMember = {
  id: string;
  name: string;
  email: string;
  meals: number;
  breakfasts: number;
  lunches: number;
  dinners: number;
  carryIn: number;
  mealCost: number;
  billShare: number;
  billShareByType: Record<string, number>;
  totalCost: number;
  bazarPaid: number;
  cashPaid: number;
  due: number;
  status: string;
  joinedAt: string;
  leftAt: string | null;
  isActive: boolean;
  activeDays: number;
};

export type SettlementDay = {
  date: string;
  meals: number;
  bazar: number;
  charged: number;
  rate: number;
  runningRate: number;
  cost: number;
};

export type Settlement = {
  month: string;
  rateMode: string;
  effectiveRateMode: string;
  rateModeFallbackReason: string | null;
  through: string;
  carryForwardEnabled: boolean;
  weights: { breakfast: number; lunch: number; dinner: number };
  days: SettlementDay[];
  members: SettlementMember[];
  totals: {
    bazar: number;
    bills: number;
    expense: number;
    meals: number;
    mealRate: number;
    averageDayRate: number;
    ratioRate: number;
    pricedDays: number;
    mealCost: number;
    billShare: number;
    carryIn: number;
    cashPaid: number;
    bazarPaid: number;
    outstanding: number;
    refunds: number;
    unallocatedBazar: number;
    unpricedMeals: number;
    memberCount: number;
  };
  byType: Record<string, number>;
  closing: { closedAt: string; closedThrough: string; closedBy: string | null } | null;
};

export type SettlementGroup = {
  id: string;
  mealWeightBreakfast: number;
  mealWeightLunch: number;
  mealWeightDinner: number;
  mealRateMode?: string;
  carryForwardEnabled?: boolean;
};

const toPaisa = (amount: number) => Math.round(amount * 100);
const fromPaisa = (paisa: number) => round2(paisa / 100);

export function allocate(totalPaisa: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0 || totalPaisa === 0) return weights.map(() => 0);

  const exact = weights.map((w) => (totalPaisa * w) / totalWeight);
  const shares = exact.map((value) => Math.floor(value));
  let remainder = totalPaisa - shares.reduce((a, b) => a + b, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let i = 0; remainder > 0 && i < order.length; i++) {
    shares[order[i].index] += 1;
    remainder -= 1;
  }
  for (let i = order.length - 1; remainder < 0 && i >= 0; i--) {
    if (shares[order[i].index] > 0) {
      shares[order[i].index] -= 1;
      remainder += 1;
    }
  }

  return shares;
}

export function settlementStatus(totalCostPaisa: number, creditPaisa: number, duePaisa: number): string {
  if (Math.abs(duePaisa) <= SETTLED_TOLERANCE_PAISA) return PAYMENT_STATUS.PAID;
  if (duePaisa < 0) return PAYMENT_STATUS.REFUND;
  if (totalCostPaisa <= 0) return PAYMENT_STATUS.PAID;
  return creditPaisa > 0 ? PAYMENT_STATUS.PARTIAL : PAYMENT_STATUS.PENDING;
}

function daySpan(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function daySpanKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += 86_400_000) {
    keys.push(utcDateToDay(new Date(t)));
  }
  return keys;
}

export function spreadBazarOverDays(
  windowDays: string[],
  bazarByDay: Map<string, number>,
  unitsByDay: Map<string, Map<number, number>>
): Map<string, number> {
  const priced = new Map<string, number>();
  const shoppingDays = [...bazarByDay.entries()]
    .filter(([, paisa]) => paisa > 0)
    .map(([day]) => day)
    .sort();

  if (shoppingDays.length === 0 || windowDays.length === 0) return priced;

  const indexOfDay = new Map(windowDays.map((day, index) => [day, index]));

  for (let i = 0; i < shoppingDays.length; i++) {
    const amount = bazarByDay.get(shoppingDays[i]) ?? 0;
    if (amount <= 0) continue;

    const from = i === 0 ? 0 : (indexOfDay.get(shoppingDays[i]) ?? 0);
    const nextIndex = i === shoppingDays.length - 1 ? windowDays.length : indexOfDay.get(shoppingDays[i + 1]);
    const to = nextIndex === undefined ? windowDays.length : nextIndex;

    const covered = windowDays.slice(from, Math.max(to, from + 1)).filter((day) => {
      const units = unitsByDay.get(day);
      return units !== undefined && [...units.values()].reduce((a, b) => a + b, 0) > 0;
    });

    if (covered.length === 0) continue;

    const shares = allocate(amount, covered.map(() => 1));
    covered.forEach((day, index) => {
      priced.set(day, (priced.get(day) ?? 0) + shares[index]);
    });
  }

  return priced;
}

async function loadCarryIn(groupId: string, monthKey: string): Promise<Map<string, number>> {
  const closings = await prisma.monthClosing.findMany({
    where: { groupId, monthKey: previousMonthKey(monthKey), reopenedAt: null },
    orderBy: { createdAt: 'asc' },
    include: { lines: { select: { userId: true, carryOut: true } } }
  });

  const carry = new Map<string, number>();
  for (const closing of closings) {
    for (const line of closing.lines) carry.set(line.userId, line.carryOut);
  }
  return carry;
}

export async function buildSettlement(
  group: SettlementGroup,
  monthKey?: string,
  options: { through?: string } = {}
): Promise<Settlement> {
  const { key, start, nextStart } = parseMonth(monthKey);
  const groupId = group.id;

  const endOfToday = dayToUtcDate(todayKey()).getTime() + 86_400_000;
  const throughDate =
    options.through && /^\d{4}-\d{2}-\d{2}$/.test(options.through)
      ? new Date(Math.min(dayToUtcDate(options.through).getTime() + 86_400_000, nextStart.getTime()))
      : new Date(Math.min(endOfToday, nextStart.getTime()));
  const windowEnd = throughDate > start ? throughDate : start;

  await syncPlansForMonth(groupId, key);

  const rateMode = group.mealRateMode === MEAL_RATE_MODES.DAILY ? MEAL_RATE_MODES.DAILY : MEAL_RATE_MODES.MONTHLY;
  const carryForwardEnabled = group.carryForwardEnabled !== false;

  const weightUnits = {
    breakfast: Math.round(group.mealWeightBreakfast * WEIGHT_SCALE),
    lunch: Math.round(group.mealWeightLunch * WEIGHT_SCALE),
    dinner: Math.round(group.mealWeightDinner * WEIGHT_SCALE)
  };

  const [memberships, mealRows, bazarRows, billShareRows, billTypeRows, cashRows, carryIn, closingRow] =
    await Promise.all([
      prisma.membership.findMany({
        where: {
          groupId,
          joinedAt: { lt: windowEnd },
          OR: [{ isActive: true }, { leftAt: null }, { leftAt: { gte: start } }]
        },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: 'asc' }
      }),
      prisma.mealEntry.findMany({
        where: { groupId, date: { gte: start, lt: windowEnd } },
        select: { userId: true, date: true, breakfastCount: true, lunchCount: true, dinnerCount: true }
      }),
      prisma.expenseEntry.findMany({
        where: { groupId, type: 'BAZAR', date: { gte: start, lt: windowEnd } },
        select: { date: true, amount: true, payerId: true }
      }),
      prisma.expenseShare.findMany({
        where: {
          expense: { groupId, type: BILL_TYPE_FILTER, date: { gte: start, lt: windowEnd } }
        },
        select: { userId: true, amount: true, expense: { select: { type: true } } }
      }),
      prisma.expenseEntry.groupBy({
        by: ['type'],
        where: { groupId, type: BILL_TYPE_FILTER, date: { gte: start, lt: windowEnd } },
        _sum: { amount: true }
      }),
      prisma.paymentStatus.findMany({
        where: { groupId, dueDate: { gte: start, lt: windowEnd } },
        select: { userId: true, amountPaid: true }
      }),
      carryForwardEnabled ? loadCarryIn(groupId, key) : Promise.resolve(new Map<string, number>()),
      prisma.monthClosing.findFirst({
        where: { groupId, monthKey: key, reopenedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { closedBy: { select: { name: true } } }
      })
    ]);

  const roster = new Map<string, { id: string; name: string; email: string; joinedAt: Date; leftAt: Date | null; isActive: boolean }>();
  for (const m of memberships) {
    const existing = roster.get(m.userId);
    if (existing) {
      if (m.joinedAt < existing.joinedAt) existing.joinedAt = m.joinedAt;
      if (m.isActive) {
        existing.isActive = true;
        existing.leftAt = null;
      }
      continue;
    }
    roster.set(m.userId, {
      id: m.userId,
      name: m.user.name,
      email: m.user.email,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt,
      isActive: m.isActive
    });
  }

  const strandedIds = new Set<string>();
  for (const row of mealRows) if (!roster.has(row.userId)) strandedIds.add(row.userId);
  for (const row of billShareRows) if (!roster.has(row.userId)) strandedIds.add(row.userId);
  for (const row of cashRows) if (!roster.has(row.userId)) strandedIds.add(row.userId);
  for (const row of bazarRows) if (row.payerId && !roster.has(row.payerId)) strandedIds.add(row.payerId);
  for (const userId of carryIn.keys()) if (!roster.has(userId) && carryIn.get(userId) !== 0) strandedIds.add(userId);

  if (strandedIds.size > 0) {
    const stranded = await prisma.user.findMany({
      where: { id: { in: [...strandedIds] } },
      select: { id: true, name: true, email: true }
    });
    for (const user of stranded) {
      roster.set(user.id, { ...user, joinedAt: start, leftAt: start, isActive: false });
    }
  }

  const memberIds = [...roster.keys()];
  const indexOf = new Map(memberIds.map((id, index) => [id, index]));

  const unitsByMember = new Int32Array(memberIds.length);
  const breakfastByMember = new Int32Array(memberIds.length);
  const lunchByMember = new Int32Array(memberIds.length);
  const dinnerByMember = new Int32Array(memberIds.length);
  const unitsByDay = new Map<string, Map<number, number>>();

  for (const row of mealRows) {
    const index = indexOf.get(row.userId);
    if (index === undefined) continue;

    const units =
      row.breakfastCount * weightUnits.breakfast +
      row.lunchCount * weightUnits.lunch +
      row.dinnerCount * weightUnits.dinner;

    breakfastByMember[index] += row.breakfastCount;
    lunchByMember[index] += row.lunchCount;
    dinnerByMember[index] += row.dinnerCount;
    if (units <= 0) continue;

    unitsByMember[index] += units;
    const day = utcDateToDay(row.date);
    if (!unitsByDay.has(day)) unitsByDay.set(day, new Map());
    const dayMap = unitsByDay.get(day)!;
    dayMap.set(index, (dayMap.get(index) ?? 0) + units);
  }

  const bazarByDay = new Map<string, number>();
  const bazarPaidByMember = new Int32Array(memberIds.length);
  let totalBazarPaisa = 0;

  for (const row of bazarRows) {
    const paisa = toPaisa(row.amount);
    totalBazarPaisa += paisa;
    const day = utcDateToDay(row.date);
    bazarByDay.set(day, (bazarByDay.get(day) ?? 0) + paisa);
    const index = row.payerId ? indexOf.get(row.payerId) : undefined;
    if (index !== undefined) bazarPaidByMember[index] += paisa;
  }

  const mealCostByMember = new Int32Array(memberIds.length);
  const totalUnits = unitsByMember.reduce((a, b) => a + b, 0);
  let unallocatedPaisa = 0;

  const windowDays = daySpanKeys(start, windowEnd);
  const effectiveMode = rateMode;
  const pricedByDay =
    effectiveMode === MEAL_RATE_MODES.DAILY ? spreadBazarOverDays(windowDays, bazarByDay, unitsByDay) : new Map();

  let unpricedMealUnits = 0;
  if (effectiveMode === MEAL_RATE_MODES.DAILY) {
    for (const [day, dayUnits] of unitsByDay) {
      if ((pricedByDay.get(day) ?? 0) <= 0) {
        unpricedMealUnits += [...dayUnits.values()].reduce((a, b) => a + b, 0);
      }
    }
  }

  if (effectiveMode === MEAL_RATE_MODES.DAILY) {
    let spreadPaisa = 0;
    for (const [day, dayBazarPaisa] of pricedByDay) {
      const dayUnits = unitsByDay.get(day);
      if (!dayUnits) continue;

      spreadPaisa += dayBazarPaisa;
      const entries = [...dayUnits.entries()];
      const shares = allocate(dayBazarPaisa, entries.map(([, units]) => units));
      entries.forEach(([index], i) => {
        mealCostByMember[index] += shares[i];
      });
    }
    unallocatedPaisa = totalBazarPaisa - spreadPaisa;
  } else {
    unallocatedPaisa = totalBazarPaisa;
  }

  if (unallocatedPaisa !== 0) {
    if (totalUnits > 0) {
      const shares = allocate(unallocatedPaisa, [...unitsByMember]);
      for (let i = 0; i < shares.length; i++) mealCostByMember[i] += shares[i];
    } else if (memberIds.length > 0) {
      const shares = allocate(unallocatedPaisa, memberIds.map(() => 1));
      for (let i = 0; i < shares.length; i++) mealCostByMember[i] += shares[i];
    }
  }

  const billShareByMember = new Int32Array(memberIds.length);
  const billShareByMemberType = memberIds.map(() => new Map<string, number>());

  for (const row of billShareRows) {
    const index = indexOf.get(row.userId);
    if (index === undefined) continue;

    const paisa = toPaisa(row.amount);
    billShareByMember[index] += paisa;

    const type = row.expense?.type ?? 'OTHER';
    const bucket = billShareByMemberType[index];
    bucket.set(type, (bucket.get(type) ?? 0) + paisa);
  }

  const cashByMember = new Int32Array(memberIds.length);
  for (const row of cashRows) {
    const index = indexOf.get(row.userId);
    if (index !== undefined) cashByMember[index] += toPaisa(row.amountPaid);
  }

  const now = new Date();
  const members: SettlementMember[] = memberIds.map((id, index) => {
    const person = roster.get(id)!;
    const carryInPaisa = toPaisa(carryIn.get(id) ?? 0);
    const mealCostPaisa = mealCostByMember[index];
    const billSharePaisa = billShareByMember[index];
    const bazarPaidPaisa = bazarPaidByMember[index];
    const cashPaidPaisa = cashByMember[index];

    const totalCostPaisa = carryInPaisa + mealCostPaisa + billSharePaisa;
    const creditPaisa = bazarPaidPaisa + cashPaidPaisa;
    const duePaisa = totalCostPaisa - creditPaisa;

    const spanStart = person.joinedAt > start ? person.joinedAt : start;
    const spanEnd = person.leftAt && person.leftAt < windowEnd ? person.leftAt : windowEnd > now ? now : windowEnd;

    return {
      id,
      name: person.name,
      email: person.email,
      meals: round2(unitsByMember[index] / WEIGHT_SCALE),
      breakfasts: breakfastByMember[index],
      lunches: lunchByMember[index],
      dinners: dinnerByMember[index],
      carryIn: fromPaisa(carryInPaisa),
      mealCost: fromPaisa(mealCostPaisa),
      billShare: fromPaisa(billSharePaisa),
      billShareByType: Object.fromEntries(
        [...billShareByMemberType[index].entries()].map(([type, paisa]) => [type, fromPaisa(paisa)])
      ),
      totalCost: fromPaisa(totalCostPaisa),
      bazarPaid: fromPaisa(bazarPaidPaisa),
      cashPaid: fromPaisa(cashPaidPaisa),
      due: fromPaisa(duePaisa),
      status: settlementStatus(totalCostPaisa, creditPaisa, duePaisa),
      joinedAt: person.joinedAt.toISOString(),
      leftAt: person.leftAt ? person.leftAt.toISOString() : null,
      isActive: person.isActive,
      activeDays: daySpan(spanStart, spanEnd)
    };
  });

  members.sort((a, b) => a.name.localeCompare(b.name));

  const monthRatePaisaPerUnit = totalUnits > 0 ? totalBazarPaisa / totalUnits : 0;
  const dayRates: number[] = [];

  let cumulativeBazarPaisa = 0;
  let cumulativeUnits = 0;

  const days: SettlementDay[] = [...new Set([...unitsByDay.keys(), ...bazarByDay.keys()])].sort().map((day) => {
    const dayUnits = unitsByDay.get(day);
    const meals = dayUnits ? [...dayUnits.values()].reduce((a, b) => a + b, 0) : 0;
    const bazarPaisa = bazarByDay.get(day) ?? 0;
    const chargedPaisa = pricedByDay.get(day) ?? 0;

    const pricedOnOwnBazar = effectiveMode === MEAL_RATE_MODES.DAILY && chargedPaisa > 0 && meals > 0;
    const ratePaisaPerUnit = pricedOnOwnBazar ? chargedPaisa / meals : monthRatePaisaPerUnit;
    const rate = round2((ratePaisaPerUnit * WEIGHT_SCALE) / 100);

    if (meals > 0) dayRates.push(rate);

    cumulativeBazarPaisa += bazarPaisa;
    cumulativeUnits += meals;
    const runningRate =
      cumulativeUnits > 0 ? round2((cumulativeBazarPaisa / cumulativeUnits) * (WEIGHT_SCALE / 100)) : 0;

    return {
      date: day,
      meals: round2(meals / WEIGHT_SCALE),
      bazar: fromPaisa(bazarPaisa),
      charged: fromPaisa(chargedPaisa),
      rate,
      runningRate,
      cost: fromPaisa(Math.round(ratePaisaPerUnit * meals))
    };
  });

  const averageDayRate = dayRates.length > 0 ? round2(dayRates.reduce((a, b) => a + b, 0) / dayRates.length) : 0;
  const ratioRate = totalUnits > 0 ? round2(totalBazarPaisa / 100 / (totalUnits / WEIGHT_SCALE)) : 0;
  const headlineRate = effectiveMode === MEAL_RATE_MODES.DAILY ? averageDayRate : ratioRate;

  const byType: Record<string, number> = {};
  for (const row of billTypeRows) byType[row.type] = round2(row._sum.amount ?? 0);
  const billsTotalPaisa = billShareRows.reduce((a, r) => a + toPaisa(r.amount), 0);

  return {
    month: key,
    rateMode,
    effectiveRateMode: effectiveMode,
    rateModeFallbackReason: null,
    through: utcDateToDay(new Date(windowEnd.getTime() - 86_400_000)),
    carryForwardEnabled,
    weights: {
      breakfast: group.mealWeightBreakfast,
      lunch: group.mealWeightLunch,
      dinner: group.mealWeightDinner
    },
    days,
    members,
    totals: {
      bazar: fromPaisa(totalBazarPaisa),
      bills: round2(Object.values(byType).reduce((a, b) => a + b, 0)),
      expense: fromPaisa(totalBazarPaisa + billsTotalPaisa),
      meals: round2(totalUnits / WEIGHT_SCALE),
      mealRate: headlineRate,
      averageDayRate,
      ratioRate,
      pricedDays: dayRates.length,
      mealCost: fromPaisa(mealCostByMember.reduce((a, b) => a + b, 0)),
      billShare: fromPaisa(billsTotalPaisa),
      carryIn: round2(members.reduce((a, m) => a + m.carryIn, 0)),
      cashPaid: fromPaisa(cashByMember.reduce((a, b) => a + b, 0)),
      bazarPaid: fromPaisa(bazarPaidByMember.reduce((a, b) => a + b, 0)),
      outstanding: round2(members.reduce((a, m) => a + Math.max(0, m.due), 0)),
      refunds: round2(members.reduce((a, m) => a + Math.max(0, -m.due), 0)),
      unallocatedBazar: effectiveMode === MEAL_RATE_MODES.DAILY ? fromPaisa(unallocatedPaisa) : 0,
      unpricedMeals: round2(unpricedMealUnits / WEIGHT_SCALE),
      memberCount: members.filter((m) => m.isActive).length
    },
    byType,
    closing: closingRow
      ? {
          closedAt: closingRow.createdAt.toISOString(),
          closedThrough: utcDateToDay(closingRow.closedThrough),
          closedBy: closingRow.closedBy?.name ?? null
        }
      : null
  };
}
