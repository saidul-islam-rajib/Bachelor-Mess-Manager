import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { mealPromptConfig } from '@/config';
import { GROUP_STATUS, MEAL_PROMPT_ANSWERS, MEAL_PROMPT_CHANNELS, type MealPromptAnswer } from '@/lib/constants';
import { applyMealCounts, currentCounts, type MealCounts } from '@/lib/meal-edits';
import { dayToUtcDate, todayKey, utcDateToDay } from '@/lib/month';
import { mealReplyPath } from '@/lib/routes';
import { strings } from '@/lib/i18n';

export type MealPromptView = {
  id: string;
  groupId: string;
  groupName: string;
  userId: string;
  userName: string;
  date: string;
  counts: MealCounts;
  planned: MealCounts;
  answer: string | null;
  respondedAt: string | null;
  expired: boolean;
};

export type PromptLookup =
  | { ok: true; prompt: MealPromptView }
  | { ok: false; error: string };

export type PromptDelivery = { prompt: MealPromptView; token: string; email: string };

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function newToken(): string {
  return crypto.randomBytes(mealPromptConfig.tokenBytes).toString('base64url');
}

function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + mealPromptConfig.validHours * 3600_000);
}

export function promptDateKey(offsetDays: number = mealPromptConfig.leadDays): string {
  const base = dayToUtcDate(todayKey());
  return utcDateToDay(new Date(base.getTime() + offsetDays * 86_400_000));
}

export function clampCount(value: unknown): number {
  const number = Math.trunc(Number(value ?? 0));
  if (!Number.isFinite(number)) return 0;
  return Math.min(mealPromptConfig.maxCountPerMeal, Math.max(0, number));
}

export function normalizeCounts(input: Partial<MealCounts> | undefined): MealCounts {
  return {
    breakfast: clampCount(input?.breakfast),
    lunch: clampCount(input?.lunch),
    dinner: clampCount(input?.dinner)
  };
}

export function describeCounts(counts: MealCounts): string {
  if (counts.breakfast + counts.lunch + counts.dinner === 0) return strings.mealPrompt.noneSummary;
  return strings.mealPrompt.counts(counts.breakfast, counts.lunch, counts.dinner);
}

export async function plannedCounts(userId: string, groupId: string, dateKey: string): Promise<MealCounts> {
  const weekday = dayToUtcDate(dateKey).getUTCDay();

  const plan = await prisma.mealPlan.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { isActive: true, days: { where: { weekday }, select: { enabled: true, breakfast: true, lunch: true, dinner: true } } }
  });

  const day = plan?.isActive ? plan.days[0] : undefined;
  if (!day || !day.enabled) return { ...mealPromptConfig.defaultCounts };

  return normalizeCounts({ breakfast: day.breakfast, lunch: day.lunch, dinner: day.dinner });
}

async function toView(row: {
  id: string;
  userId: string;
  groupId: string;
  date: Date;
  answer: string | null;
  respondedAt: Date | null;
  expiresAt: Date;
  user: { name: string };
  group: { name: string };
}): Promise<MealPromptView> {
  const dateKey = utcDateToDay(row.date);

  return {
    id: row.id,
    groupId: row.groupId,
    groupName: row.group.name,
    userId: row.userId,
    userName: row.user.name,
    date: dateKey,
    counts: await currentCounts(row.userId, row.groupId, row.date),
    planned: await plannedCounts(row.userId, row.groupId, dateKey),
    answer: row.answer,
    respondedAt: row.respondedAt ? row.respondedAt.toISOString() : null,
    expired: row.expiresAt.getTime() <= Date.now()
  };
}

const PROMPT_INCLUDE = {
  user: { select: { name: true } },
  group: { select: { name: true } }
} as const;

export async function issuePrompt(params: {
  userId: string;
  groupId: string;
  dateKey: string;
  channel?: string;
}): Promise<{ token: string; prompt: MealPromptView }> {
  const now = new Date();
  const token = newToken();
  const date = dayToUtcDate(params.dateKey);

  const row = await prisma.mealPrompt.upsert({
    where: { userId_groupId_date: { userId: params.userId, groupId: params.groupId, date } },
    update: {
      tokenHash: hashToken(token),
      expiresAt: expiryFrom(now),
      channel: params.channel ?? MEAL_PROMPT_CHANNELS.EMAIL,
      sentAt: now
    },
    create: {
      userId: params.userId,
      groupId: params.groupId,
      date,
      tokenHash: hashToken(token),
      expiresAt: expiryFrom(now),
      channel: params.channel ?? MEAL_PROMPT_CHANNELS.EMAIL,
      sentAt: now,
      publishedAt: now
    },
    include: PROMPT_INCLUDE
  });

  return { token, prompt: await toView(row) };
}

export async function findPromptByToken(token: unknown): Promise<PromptLookup> {
  if (typeof token !== 'string' || token.length < 16) {
    return { ok: false, error: strings.mealPrompt.invalidLink };
  }

  const row = await prisma.mealPrompt.findUnique({
    where: { tokenHash: hashToken(token) },
    include: PROMPT_INCLUDE
  });

  if (!row) return { ok: false, error: strings.mealPrompt.invalidLink };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, error: strings.mealPrompt.expiredLink };

  return { ok: true, prompt: await toView(row) };
}

export async function readPrompt(userId: string, groupId: string, dateKey: string): Promise<MealPromptView | null> {
  const row = await prisma.mealPrompt.findUnique({
    where: { userId_groupId_date: { userId, groupId, date: dayToUtcDate(dateKey) } },
    include: PROMPT_INCLUDE
  });

  return row ? toView(row) : null;
}

export type RespondResult = { ok: true; counts: MealCounts } | { ok: false; error: string };

export async function respond(params: {
  userId: string;
  groupId: string;
  dateKey: string;
  answer: MealPromptAnswer;
  counts?: Partial<MealCounts>;
}): Promise<RespondResult> {
  if (params.dateKey < todayKey()) {
    return { ok: false, error: strings.mealPrompt.dateLocked };
  }

  const group = await prisma.group.findUnique({ where: { id: params.groupId }, select: { status: true } });
  if (!group) return { ok: false, error: strings.groups.notFound };
  if (group.status !== GROUP_STATUS.ACTIVE) return { ok: false, error: strings.mealPrompt.inactiveGroup };

  const membership = await prisma.membership.findFirst({
    where: { groupId: params.groupId, userId: params.userId, isActive: true },
    select: { id: true }
  });
  if (!membership) return { ok: false, error: strings.mealPrompt.notAMember };

  let counts: MealCounts;
  if (params.answer === MEAL_PROMPT_ANSWERS.YES) {
    counts = await plannedCounts(params.userId, params.groupId, params.dateKey);
  } else if (params.answer === MEAL_PROMPT_ANSWERS.NO) {
    counts = { breakfast: 0, lunch: 0, dinner: 0 };
  } else {
    counts = normalizeCounts(params.counts);
  }

  const date = dayToUtcDate(params.dateKey);
  await applyMealCounts(params.userId, params.groupId, date, counts);

  const now = new Date();
  await prisma.mealPrompt.updateMany({
    where: { userId: params.userId, groupId: params.groupId, date },
    data: {
      answer: params.answer,
      answeredBreakfast: counts.breakfast,
      answeredLunch: counts.lunch,
      answeredDinner: counts.dinner,
      respondedAt: now
    }
  });

  return { ok: true, counts };
}

export async function pendingRecipients(groupId: string, dateKey: string) {
  const date = dayToUtcDate(dateKey);

  const memberships = await prisma.membership.findMany({
    where: { groupId, isActive: true },
    select: { user: { select: { id: true, name: true, email: true } } },
    take: mealPromptConfig.batchSize
  });

  const asked = await prisma.mealPrompt.findMany({
    where: { groupId, date, sentAt: { not: null } },
    select: { userId: true }
  });
  const alreadyAsked = new Set(asked.map((row) => row.userId));

  return memberships.map((membership) => membership.user).filter((user) => !alreadyAsked.has(user.id));
}

export async function activeGroupsFor(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId, isActive: true, group: { status: GROUP_STATUS.ACTIVE } },
    select: { group: { select: { id: true, name: true } } }
  });

  return memberships.map((membership) => membership.group);
}

export function promptLink(baseUrl: string, token: string, answer?: string): string {
  return `${baseUrl}${mealReplyPath(token, answer)}`;
}

export async function pruneMealPrompts(): Promise<number> {
  const result = await prisma.mealPrompt.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}
