import { traced } from '@/lib/log';
import { prisma } from '@/lib/prisma';
import { buildSettlement, type SettlementGroup } from '@/lib/settlement';
import { NOTIFICATION_TYPES } from '@/lib/constants';
import { notifyGroup } from '@/lib/notifications';
import { ROUTES } from '@/lib/routes';
import { dayToUtcDate, nextMonthKey, parseMonth, utcDateToDay } from '@/lib/month';

export type CloseResult =
  | { ok: true; closingId: string; lines: number; carriedForward: number }
  | { ok: false; error: string };

export type ClosingSummary = {
  id: string;
  monthKey: string;
  closedThrough: string;
  closedAt: string;
  closedBy: string | null;
  note: string | null;
  reopenedAt: string | null;
  settledAt: string | null;
  settledBy: string | null;
  scope: 'GROUP' | 'MEMBERS';
  lines: {
    userId: string;
    userName: string;
    carryIn: number;
    mealCount: number;
    mealCost: number;
    billShare: number;
    bazarPaid: number;
    cashPaid: number;
    carryOut: number;
  }[];
};

export async function listClosings(groupId: string, monthKey?: string): Promise<ClosingSummary[]> {
  const rows = await prisma.monthClosing.findMany({
    where: { groupId, ...(monthKey ? { monthKey } : {}) },
    include: {
      closedBy: { select: { name: true } },
      settledBy: { select: { name: true } },
      lines: { include: { user: { select: { id: true, name: true } } } }
    },
    orderBy: { createdAt: 'desc' },
    take: 24
  });

  return rows.map((row) => ({
    id: row.id,
    monthKey: row.monthKey,
    closedThrough: utcDateToDay(row.closedThrough),
    closedAt: row.createdAt.toISOString(),
    closedBy: row.closedBy?.name ?? null,
    note: row.note,
    reopenedAt: row.reopenedAt ? row.reopenedAt.toISOString() : null,
    settledAt: row.settledAt ? row.settledAt.toISOString() : null,
    settledBy: row.settledBy?.name ?? null,
    scope: row.lines.length > 0 && row.lines.every((line) => line.isFinal) ? 'GROUP' : 'MEMBERS',
    lines: row.lines.map((line) => ({
      userId: line.userId,
      userName: line.user.name,
      carryIn: line.carryIn,
      mealCount: line.mealCount,
      mealCost: line.mealCost,
      billShare: line.billShare,
      bazarPaid: line.bazarPaid,
      cashPaid: line.cashPaid,
      carryOut: line.carryOut
    }))
  }));
}

async function closeMonthImpl(options: {
  group: SettlementGroup & { name: string; status: string };
  monthKey: string;
  through?: string;
  userIds?: string[];
  note?: string | null;
  endMembership?: boolean;
  actorId: string | null;
  actorName: string;
}): Promise<CloseResult> {
  const { group, monthKey, actorId, actorName } = options;
  const { key, start, nextStart } = parseMonth(monthKey);

  const throughDay = options.through ?? utcDateToDay(new Date(nextStart.getTime() - 86_400_000));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(throughDay)) {
    return { ok: false, error: 'Give a valid closing date (YYYY-MM-DD).' };
  }

  const throughDate = dayToUtcDate(throughDay);
  if (throughDate < start || throughDate >= nextStart) {
    return { ok: false, error: `The closing date must fall inside ${key}.` };
  }

  const scopedUserIds = options.userIds?.filter(Boolean) ?? [];
  const partial = scopedUserIds.length > 0;

  const settlement = await buildSettlement(group, key, { through: throughDay });

  const candidates = partial
    ? settlement.members.filter((member) => scopedUserIds.includes(member.id))
    : settlement.members;

  if (candidates.length === 0) {
    return { ok: false, error: 'There is nobody to close for that month.' };
  }

  const now = new Date();
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Group" WHERE "id" = ${group.id} FOR UPDATE`;

    const existing = await tx.monthClosing.findMany({
      where: { groupId: group.id, monthKey: key, reopenedAt: null },
      include: { lines: { select: { userId: true } } }
    });
    const alreadyClosed = new Set<string>();
    for (const closing of existing) {
      for (const line of closing.lines) alreadyClosed.add(line.userId);
    }

    const targets = candidates.filter((member) => !alreadyClosed.has(member.id));
    if (targets.length === 0) return null;

    const row = await tx.monthClosing.create({
      data: {
        groupId: group.id,
        monthKey: key,
        closedThrough: throughDate,
        closedById: actorId,
        note: options.note ?? null,
        publishedAt: now,
        lines: {
          create: targets.map((member) => ({
            userId: member.id,
            carryIn: member.carryIn,
            mealCount: member.meals,
            mealCost: member.mealCost,
            billShare: member.billShare,
            bazarPaid: member.bazarPaid,
            cashPaid: member.cashPaid,
            carryOut: member.due,
            isFinal: !partial,
            publishedAt: now
          }))
        }
      }
    });

    if (options.endMembership && partial) {
      await tx.membership.updateMany({
        where: { groupId: group.id, userId: { in: targets.map((m) => m.id) }, isActive: true },
        data: { isActive: false, leftAt: throughDate }
      });
    }

    return { row, targets };
  });

  if (!outcome) {
    return { ok: false, error: 'Everyone selected has already been closed for this month.' };
  }
  const { row: closing, targets } = outcome;

  const carriedForward = targets.reduce((total, member) => total + member.due, 0);

  await notifyGroup(
    group.id,
    {
      type: NOTIFICATION_TYPES.MONTH_CLOSED,
      title: partial
        ? `${actorName} closed ${key} for ${targets.length} member${targets.length === 1 ? '' : 's'}`
        : `${actorName} closed ${key} for ${group.name}`,
      excerpt: `Balances are final up to ${throughDay}. Anything unpaid now shows as brought forward in ${nextMonthKey(key)}.`,
      link: ROUTES.payments,
      actorId
    },
    { excludeUserId: actorId ?? undefined }
  );

  return { ok: true, closingId: closing.id, lines: targets.length, carriedForward };
}

export const closeMonth = traced('closeMonth', closeMonthImpl);

async function reopenMonthImpl(closingId: string, actor: { id: string; name: string }): Promise<CloseResult> {
  const closing = await prisma.monthClosing.findUnique({
    where: { id: closingId },
    include: { group: { select: { id: true, name: true } } }
  });

  if (!closing) {
    return { ok: false, error: 'That closing no longer exists.' };
  }
  if (closing.reopenedAt) {
    return { ok: false, error: 'That month has already been reopened.' };
  }

  await prisma.monthClosing.update({
    where: { id: closingId },
    data: { reopenedAt: new Date(), settledAt: null, settledById: null }
  });

  await notifyGroup(
    closing.groupId,
    {
      type: NOTIFICATION_TYPES.MONTH_REOPENED,
      title: `${actor.name} reopened ${closing.monthKey} for ${closing.group.name}`,
      excerpt: 'Balances for that month can change again, and nothing carries forward until it is closed once more.',
      link: ROUTES.payments,
      actorId: actor.id
    },
    { excludeUserId: actor.id }
  );

  return { ok: true, closingId, lines: 0, carriedForward: 0 };
}

export const reopenMonth = traced('reopenMonth', reopenMonthImpl);

async function markSettledImpl(closingId: string, actor: { id: string; name: string }): Promise<CloseResult> {
  const closing = await prisma.monthClosing.findUnique({
    where: { id: closingId },
    include: { group: { select: { id: true, name: true } } }
  });

  if (!closing) {
    return { ok: false, error: 'That closing no longer exists.' };
  }
  if (closing.reopenedAt) {
    return { ok: false, error: 'That month has been reopened and is no longer final.' };
  }
  if (closing.settledAt) {
    return { ok: false, error: 'That month is already settled.' };
  }

  await prisma.monthClosing.update({
    where: { id: closingId },
    data: { settledAt: new Date(), settledById: actor.id }
  });

  await notifyGroup(
    closing.groupId,
    {
      type: NOTIFICATION_TYPES.SETTLEMENT_SETTLED,
      title: `${actor.name} marked ${closing.monthKey} fully settled for ${closing.group.name}`,
      excerpt: 'Everyone is squared up for that month. Nothing further is owed either way.',
      link: ROUTES.payments,
      actorId: actor.id
    },
    { excludeUserId: actor.id }
  );

  return { ok: true, closingId, lines: 0, carriedForward: 0 };
}

export const markSettled = traced('markSettled', markSettledImpl);
