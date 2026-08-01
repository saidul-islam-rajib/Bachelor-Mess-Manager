import { prisma } from '@/lib/prisma';
import { getMealEditPolicy } from '@/lib/settings-service';
import { MEAL_EDIT_WINDOW_UNLIMITED, REQUEST_STATUS } from '@/lib/constants';
import { utcDateToDay } from '@/lib/month';

export type MealCounts = { breakfast: number; lunch: number; dinner: number };

export type EditWindowState = {
  open: boolean;
  unlimited: boolean;
  openedAt: string | null;
  expiresAt: string | null;
  secondsRemaining: number | null;
  windowMinutes: number;
  requiresApproval: boolean;
};

export function isWindowOpen(window: { closedAt: Date | null; expiresAt: Date | null } | null, now = new Date()) {
  if (!window) return false;
  if (window.closedAt) return false;
  if (!window.expiresAt) return true;
  return window.expiresAt.getTime() > now.getTime();
}

export async function readEditWindow(userId: string, groupId: string): Promise<EditWindowState> {
  const [policy, row] = await Promise.all([
    getMealEditPolicy(),
    prisma.mealEditWindow.findUnique({ where: { userId_groupId: { userId, groupId } } })
  ]);

  const now = new Date();
  const open = isWindowOpen(row, now);

  return {
    open,
    unlimited: policy.windowMinutes === MEAL_EDIT_WINDOW_UNLIMITED,
    openedAt: open && row ? row.openedAt.toISOString() : null,
    expiresAt: open && row?.expiresAt ? row.expiresAt.toISOString() : null,
    secondsRemaining:
      open && row?.expiresAt ? Math.max(0, Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1000)) : null,
    windowMinutes: policy.windowMinutes,
    requiresApproval: policy.requiresApproval
  };
}

export async function openEditWindow(userId: string, groupId: string): Promise<EditWindowState> {
  const policy = await getMealEditPolicy();
  const now = new Date();
  const expiresAt =
    policy.windowMinutes === MEAL_EDIT_WINDOW_UNLIMITED
      ? null
      : new Date(now.getTime() + policy.windowMinutes * 60_000);

  await prisma.mealEditWindow.upsert({
    where: { userId_groupId: { userId, groupId } },
    update: { openedAt: now, expiresAt, closedAt: null },
    create: { userId, groupId, openedAt: now, expiresAt, closedAt: null, publishedAt: now }
  });

  return readEditWindow(userId, groupId);
}

export async function closeEditWindow(userId: string, groupId: string): Promise<EditWindowState> {
  await prisma.mealEditWindow.updateMany({
    where: { userId, groupId, closedAt: null },
    data: { closedAt: new Date() }
  });

  return readEditWindow(userId, groupId);
}

export function describeChange(from: MealCounts, to: MealCounts): string {
  const parts: string[] = [];
  const labels: [keyof MealCounts, string][] = [
    ['breakfast', 'breakfast'],
    ['lunch', 'lunch'],
    ['dinner', 'dinner']
  ];

  for (const [key, label] of labels) {
    if (from[key] !== to[key]) parts.push(`${label} ${from[key]} → ${to[key]}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'no change';
}

export function countsEqual(a: MealCounts, b: MealCounts): boolean {
  return a.breakfast === b.breakfast && a.lunch === b.lunch && a.dinner === b.dinner;
}

export async function currentCounts(userId: string, groupId: string, date: Date): Promise<MealCounts> {
  const entry = await prisma.mealEntry.findUnique({
    where: { userId_groupId_date: { userId, groupId, date } }
  });

  return {
    breakfast: entry?.breakfastCount ?? 0,
    lunch: entry?.lunchCount ?? 0,
    dinner: entry?.dinnerCount ?? 0
  };
}

export async function applyMealCounts(userId: string, groupId: string, date: Date, counts: MealCounts) {
  const totalMeals = counts.breakfast + counts.lunch + counts.dinner;

  return prisma.mealEntry.upsert({
    where: { userId_groupId_date: { userId, groupId, date } },
    update: {
      breakfastCount: counts.breakfast,
      lunchCount: counts.lunch,
      dinnerCount: counts.dinner,
      totalMeals,
      fromPlan: false
    },
    create: {
      userId,
      groupId,
      date,
      breakfastCount: counts.breakfast,
      lunchCount: counts.lunch,
      dinnerCount: counts.dinner,
      totalMeals,
      fromPlan: false,
      publishedAt: new Date()
    }
  });
}

export function serializeChangeRequest(row: {
  id: string;
  userId: string;
  groupId: string;
  date: Date;
  fromBreakfast: number;
  fromLunch: number;
  fromDinner: number;
  toBreakfast: number;
  toLunch: number;
  toDinner: number;
  reason: string | null;
  status: string;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
  user?: { id: string; name: string } | null;
  decidedBy?: { id: string; name: string } | null;
}) {
  const from = { breakfast: row.fromBreakfast, lunch: row.fromLunch, dinner: row.fromDinner };
  const to = { breakfast: row.toBreakfast, lunch: row.toLunch, dinner: row.toDinner };

  return {
    id: row.id,
    userId: row.userId,
    userName: row.user?.name ?? null,
    groupId: row.groupId,
    date: utcDateToDay(row.date),
    from,
    to,
    summary: describeChange(from, to),
    reason: row.reason,
    status: row.status,
    pending: row.status === REQUEST_STATUS.PENDING,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    decidedByName: row.decidedBy?.name ?? null,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt.toISOString()
  };
}
