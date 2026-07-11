import { prisma } from '@/lib/prisma';
import { utcDateToDay } from '@/lib/month';

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
      amountFrom: params.previous.amount,
      dateFrom: params.previous.date,
      noteFrom: params.previous.note
    }
  });
}

export async function listExpenseHistory(groupId: string, limit = 50) {
  const rows = await prisma.expenseHistory.findMany({
    where: { groupId },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorName: r.actor?.name ?? 'Someone',
    amountFrom: r.amountFrom,
    amountTo: r.amountTo,
    dateFrom: r.dateFrom ? utcDateToDay(r.dateFrom) : null,
    dateTo: r.dateTo ? utcDateToDay(r.dateTo) : null,
    noteFrom: r.noteFrom,
    noteTo: r.noteTo,
    at: r.createdAt.toISOString()
  }));
}
