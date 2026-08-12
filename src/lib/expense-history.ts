import { prisma } from '@/lib/prisma';
import { parseMonth, utcDateToDay } from '@/lib/month';
import { historyConfig } from '@/config';
import { strings } from '@/lib/i18n';

const HISTORY_PAGE_SIZE = historyConfig.pageSize;

export const EXPENSE_ACTIONS = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED'
} as const;

type Snapshot = { amount: number; date: Date; note: string | null };

export async function recordExpenseCreated(params: {
  expenseId: string;
  groupId: string;
  actorId: string;
  next: Snapshot;
}) {
  await prisma.expenseHistory.create({
    data: {
      expenseId: params.expenseId,
      groupId: params.groupId,
      actorId: params.actorId,
      action: EXPENSE_ACTIONS.CREATED,
      expenseDate: params.next.date,
      amountTo: params.next.amount,
      dateTo: params.next.date,
      noteTo: params.next.note
    }
  });
}

export async function recordExpenseUpdated(params: {
  expenseId: string;
  groupId: string;
  actorId: string;
  previous: Snapshot;
  next: Snapshot;
}) {
  const { previous, next } = params;

  const amountChanged = previous.amount !== next.amount;
  const dateChanged = previous.date.getTime() !== next.date.getTime();
  const noteChanged = (previous.note ?? '') !== (next.note ?? '');

  if (!amountChanged && !dateChanged && !noteChanged) return;

  await prisma.expenseHistory.create({
    data: {
      expenseId: params.expenseId,
      groupId: params.groupId,
      actorId: params.actorId,
      action: EXPENSE_ACTIONS.UPDATED,
      expenseDate: next.date,
      amountFrom: amountChanged ? previous.amount : null,
      amountTo: amountChanged ? next.amount : null,
      dateFrom: dateChanged ? previous.date : null,
      dateTo: dateChanged ? next.date : null,
      noteFrom: noteChanged ? previous.note : null,
      noteTo: noteChanged ? next.note : null
    }
  });
}

export async function recordExpenseDeleted(params: {
  expenseId: string;
  groupId: string;
  actorId: string;
  previous: Snapshot;
}) {
  await prisma.expenseHistory.create({
    data: {
      expenseId: params.expenseId,
      groupId: params.groupId,
      actorId: params.actorId,
      action: EXPENSE_ACTIONS.DELETED,
      expenseDate: params.previous.date,
      amountFrom: params.previous.amount,
      dateFrom: params.previous.date,
      noteFrom: params.previous.note
    }
  });
}

export async function listExpenseHistory(
  groupId: string,
  options: { monthKey?: string; expenseId?: string; limit?: number } = {}
) {
  const { monthKey, expenseId, limit = HISTORY_PAGE_SIZE } = options;

  const where = expenseId
    ? { groupId, expenseId }
    : (() => {
        const { start, nextStart } = parseMonth(monthKey);
        return { groupId, expenseDate: { gte: start, lt: nextStart } };
      })();

  const rows = await prisma.expenseHistory.findMany({
    where,
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorName: r.actor?.name ?? strings.history.unknownActor,
    amountFrom: r.amountFrom,
    amountTo: r.amountTo,
    dateFrom: r.dateFrom ? utcDateToDay(r.dateFrom) : null,
    dateTo: r.dateTo ? utcDateToDay(r.dateTo) : null,
    noteFrom: r.noteFrom,
    noteTo: r.noteTo,
    at: r.createdAt.toISOString()
  }));
}
