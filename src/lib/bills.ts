// Bills: every cost that is not day-to-day bazar.
//
// Bazar is bought daily and shared in proportion to meals eaten, which is what
// produces the meal rate. Rent, electricity, water, waste, chef, wifi and the
// "other" bucket behave differently — they are periodic, and the spec asks for
// them to be either shared across the mess or assigned to named members.
//
// So a bill is split once, at the moment it is recorded, into ExpenseShare rows:
//
//   EQUAL  — divided across the members active right now
//   CUSTOM — assigned to the members the supervisor picked, with explicit amounts
//
// Writing the shares down (rather than deriving them at read time) means someone
// joining or leaving next week cannot silently rewrite what this month's rent
// says each person owed.

import { prisma } from '@/lib/prisma';
import { BILL_TYPE_VALUES, SPLIT_METHODS } from '@/lib/constants';
import { round2 } from '@/lib/month';

export type ShareInput = { userId: string; amount: number };
export type ComputedShare = { userId: string; amount: number };

export type ShareResult =
  | { ok: true; shares: ComputedShare[] }
  | { ok: false; error: string };

export function isBillType(type: unknown): type is string {
  return typeof type === 'string' && BILL_TYPE_VALUES.includes(type);
}

/**
 * Split `total` evenly across `userIds`.
 *
 * Money does not divide evenly: 100 across 3 is 33.33 three times, which is 99.99.
 * We hand the leftover paisa out one at a time to the first members so the shares
 * always add back up to the total exactly.
 */
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

/**
 * Work out each member's share of a bill.
 *
 * `activeMemberIds` is the roster to divide across for an EQUAL split.
 */
export async function computeShares(options: {
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

    // Everyone assigned a share must actually be in the group.
    const memberships = await prisma.membership.findMany({
      where: { groupId, userId: { in: [...seen] }, isActive: true },
      select: { userId: true }
    });
    if (memberships.length !== seen.size) {
      return { ok: false, error: 'One of the selected people is not an active member of this group.' };
    }

    const sum = round2(shares.reduce((a, s) => a + s.amount, 0));
    // Tolerate a paisa of float drift, but not a real mismatch — a bill whose
    // shares do not add up to its total would corrupt every downstream report.
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

/** Every member's bill total for a month, keyed by user id. */
export async function billSharesByUser(groupId: string, start: Date, nextStart: Date) {
  const rows = await prisma.expenseShare.findMany({
    where: {
      expense: { groupId, type: { in: BILL_TYPE_VALUES }, date: { gte: start, lt: nextStart } }
    },
    select: { userId: true, amount: true }
  });

  const byUser = new Map<string, number>();
  for (const row of rows) {
    byUser.set(row.userId, round2((byUser.get(row.userId) ?? 0) + row.amount));
  }
  return byUser;
}

/** Month totals per bill type, for the cost-breakdown panels. */
export async function billTotalsByType(groupId: string, start: Date, nextStart: Date) {
  const rows = await prisma.expenseEntry.groupBy({
    by: ['type'],
    where: { groupId, type: { in: BILL_TYPE_VALUES }, date: { gte: start, lt: nextStart } },
    _sum: { amount: true }
  });

  const byType: Record<string, number> = {};
  for (const row of rows) {
    byType[row.type] = round2(row._sum.amount ?? 0);
  }
  return byType;
}
