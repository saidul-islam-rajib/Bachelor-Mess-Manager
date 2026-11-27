import { traced } from '@/lib/log';
import { prisma } from '@/lib/prisma';
import { BILL_TYPE_FILTER, EXPENSE_TYPES, SPLIT_METHODS } from '@/lib/constants';
import { round2 } from '@/lib/month';

export type ShareInput = { userId: string; amount: number };
export type ComputedShare = { userId: string; amount: number };

export type ShareResult =
  | { ok: true; shares: ComputedShare[] }
  | { ok: false; error: string };

export function isBillType(type: unknown): type is string {
  return typeof type === 'string' && type.length > 0 && type !== EXPENSE_TYPES.BAZAR;
}

export function splitEqually(total: number, userIds: string[]): ComputedShare[] {
  if (userIds.length === 0) return [];

  const totalPaisa = Math.round(total * 100);
  const base = Math.floor(totalPaisa / userIds.length);
  let remainder = totalPaisa - base * userIds.length;

  return userIds.map((userId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { userId, amount: round2((base + extra) / 100) };
  });
}

async function computeSharesImpl(options: {
  groupId: string;
  total: number;
  splitMethod: string;
  shares?: unknown;
}): Promise<ShareResult> {
  const { groupId, total, splitMethod } = options;

  if (splitMethod === SPLIT_METHODS.EQUAL) {
    const memberships = await prisma.membership.findMany({
      where: { groupId, isActive: true },
      select: { userId: true },
      orderBy: { joinedAt: 'asc' }
    });

    if (memberships.length === 0) {
      return { ok: false, error: 'This group has no active members to split the bill across.' };
    }

    return { ok: true, shares: splitEqually(total, memberships.map((m) => m.userId)) };
  }

  if (splitMethod === SPLIT_METHODS.CUSTOM) {
    const raw = options.shares;
    if (!Array.isArray(raw) || raw.length === 0) {
      return { ok: false, error: 'Select at least one member to assign this cost to.' };
    }

    const seen = new Set<string>();
    const shares: ComputedShare[] = [];

    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') {
        return { ok: false, error: 'Each share needs a member and an amount.' };
      }
      const { userId, amount } = entry as ShareInput;

      if (typeof userId !== 'string' || !userId) {
        return { ok: false, error: 'Each share needs a member.' };
      }
      if (seen.has(userId)) {
        return { ok: false, error: 'The same member is listed twice.' };
      }
      seen.add(userId);

      const value = Number(amount);
      if (!Number.isFinite(value) || value < 0) {
        return { ok: false, error: 'Each share amount must be zero or more.' };
      }
      shares.push({ userId, amount: round2(value) });
    }

    const memberships = await prisma.membership.findMany({
      where: { groupId, userId: { in: [...seen] }, isActive: true },
      select: { userId: true }
    });
    if (memberships.length !== seen.size) {
      return { ok: false, error: 'One of the selected people is not an active member of this group.' };
    }

    const sum = round2(shares.reduce((a, s) => a + s.amount, 0));

    if (Math.abs(sum - round2(total)) > 0.01) {
      return {
        ok: false,
        error: `The shares add up to ${sum.toFixed(2)}, but the bill is ${round2(total).toFixed(2)}. They must match.`
      };
    }

    return { ok: true, shares };
  }

  return { ok: false, error: 'Split method must be EQUAL or CUSTOM.' };
}

export const computeShares = traced('computeShares', computeSharesImpl);

async function billSharesByUserImpl(groupId: string, start: Date, nextStart: Date) {
  const rows = await prisma.expenseShare.findMany({
    where: {
      expense: { groupId, type: BILL_TYPE_FILTER, date: { gte: start, lt: nextStart } }
    },
    select: { userId: true, amount: true }
  });

  const byUser = new Map<string, number>();
  for (const row of rows) {
    byUser.set(row.userId, round2((byUser.get(row.userId) ?? 0) + row.amount));
  }
  return byUser;
}

export const billSharesByUser = traced('billSharesByUser', billSharesByUserImpl);

async function billTotalsByTypeImpl(groupId: string, start: Date, nextStart: Date) {
  const rows = await prisma.expenseEntry.groupBy({
    by: ['type'],
    where: { groupId, type: BILL_TYPE_FILTER, date: { gte: start, lt: nextStart } },
    _sum: { amount: true }
  });

  const byType: Record<string, number> = {};
  for (const row of rows) {
    byType[row.type] = round2(row._sum.amount ?? 0);
  }
  return byType;
}

export const billTotalsByType = traced('billTotalsByType', billTotalsByTypeImpl);
