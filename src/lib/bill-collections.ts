import { prisma } from '@/lib/prisma';
import { PAYMENT_STATUS } from '@/lib/constants';
import { round2 } from '@/lib/month';

const TOLERANCE_PAISA = 1;

const toPaisa = (amount: number) => Math.round(amount * 100);
const fromPaisa = (paisa: number) => round2(paisa / 100);

export type CollectionRow = {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  date: Date;
  recordedAt: Date;
  recordedByName: string | null;
  reversalOfId: string | null;
  isReversed: boolean;
};

export type CollectionEntry = {
  id: string;
  amount: number;
  date: string;
  recordedAt: string;
  recordedByName: string | null;
  isReversal: boolean;
  isReversed: boolean;
};

export type ShareState = {
  userId: string;
  userName: string;
  share: number;
  paid: number;
  outstanding: number;
  advance: number;
  status: string;
  collections: CollectionRow[];
};

export type BillCollectionState = {
  shares: ShareState[];
  collected: number;
  outstanding: number;
  advance: number;
  isFullyCollected: boolean;
  unpaidMemberCount: number;
};

export function shareStatus(sharePaisa: number, paidPaisa: number): string {
  if (sharePaisa <= 0) return PAYMENT_STATUS.PAID;
  if (paidPaisa <= 0) return PAYMENT_STATUS.PENDING;
  if (paidPaisa >= sharePaisa - TOLERANCE_PAISA) return PAYMENT_STATUS.PAID;
  return PAYMENT_STATUS.PARTIAL;
}

export function buildCollectionState(
  shares: { userId: string; userName: string; amount: number }[],
  collections: CollectionRow[]
): BillCollectionState {
  const paidByUser = new Map<string, number>();
  const rowsByUser = new Map<string, CollectionRow[]>();

  for (const row of collections) {
    paidByUser.set(row.userId, (paidByUser.get(row.userId) ?? 0) + toPaisa(row.amount));
    const list = rowsByUser.get(row.userId) ?? [];
    list.push(row);
    rowsByUser.set(row.userId, list);
  }

  const seen = new Set(shares.map((s) => s.userId));
  const rows: ShareState[] = shares.map((share) => {
    const sharePaisa = toPaisa(share.amount);
    const paidPaisa = paidByUser.get(share.userId) ?? 0;
    const outstandingPaisa = Math.max(0, sharePaisa - paidPaisa);
    const advancePaisa = Math.max(0, paidPaisa - sharePaisa);

    return {
      userId: share.userId,
      userName: share.userName,
      share: round2(share.amount),
      paid: fromPaisa(paidPaisa),
      outstanding: fromPaisa(outstandingPaisa),
      advance: fromPaisa(advancePaisa),
      status: shareStatus(sharePaisa, paidPaisa),
      collections: rowsByUser.get(share.userId) ?? []
    };
  });

  for (const row of collections) {
    if (seen.has(row.userId)) continue;
    seen.add(row.userId);

    const paidPaisa = paidByUser.get(row.userId) ?? 0;
    rows.push({
      userId: row.userId,
      userName: row.userName,
      share: 0,
      paid: fromPaisa(paidPaisa),
      outstanding: 0,
      advance: fromPaisa(paidPaisa),
      status: PAYMENT_STATUS.PAID,
      collections: rowsByUser.get(row.userId) ?? []
    });
  }

  const collectedPaisa = collections.reduce((a, row) => a + toPaisa(row.amount), 0);
  const totalSharePaisa = shares.reduce((a, s) => a + toPaisa(s.amount), 0);
  const outstandingPaisa = rows.reduce((a, r) => a + toPaisa(r.outstanding), 0);

  return {
    shares: rows,
    collected: fromPaisa(collectedPaisa),
    outstanding: fromPaisa(outstandingPaisa),
    advance: fromPaisa(rows.reduce((a, r) => a + toPaisa(r.advance), 0)),
    isFullyCollected: collectedPaisa >= totalSharePaisa - TOLERANCE_PAISA && totalSharePaisa > 0,
    unpaidMemberCount: rows.filter((r) => toPaisa(r.outstanding) > TOLERANCE_PAISA).length
  };
}

export type ReversalResult =
  | { ok: true; amount: number; userId: string }
  | { ok: false; error: string };

/// The ledger is append-only. Correcting a mistake writes an opposite row rather
/// than removing the original, so both the entry and the correction stay visible.
export async function reversePayment(params: {
  paymentId: string;
  actorId: string;
  groupId?: string;
}): Promise<ReversalResult> {
  const { paymentId, actorId, groupId } = params;

  const original = await prisma.paymentStatus.findUnique({
    where: { id: paymentId },
    include: { reversedBy: { select: { id: true } } }
  });

  if (!original) return { ok: false, error: 'That entry does not exist.' };
  if (groupId && original.groupId !== groupId) {
    return { ok: false, error: 'That entry belongs to another mess.' };
  }
  if (original.reversalOfId) {
    return { ok: false, error: 'That entry is already a correction, so it cannot be reversed again.' };
  }
  if (original.reversedBy) {
    return { ok: false, error: 'That entry has already been reversed.' };
  }

  await prisma.paymentStatus.create({
    data: {
      userId: original.userId,
      groupId: original.groupId,
      expenseId: original.expenseId,
      reversalOfId: original.id,
      recordedById: actorId,
      amountDue: original.amountDue,
      amountPaid: -original.amountPaid,
      status: PAYMENT_STATUS.REFUND,
      dueDate: original.dueDate,
      publishedAt: new Date()
    }
  });

  return { ok: true, amount: round2(original.amountPaid), userId: original.userId };
}

export async function collectionsByBill(billIds: string[]): Promise<Map<string, CollectionRow[]>> {
  const byBill = new Map<string, CollectionRow[]>();
  if (billIds.length === 0) return byBill;

  const rows = await prisma.paymentStatus.findMany({
    where: { expenseId: { in: billIds } },
    include: {
      user: { select: { name: true } },
      recordedBy: { select: { name: true } },
      reversedBy: { select: { id: true } }
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
  });

  for (const row of rows) {
    if (!row.expenseId) continue;
    const list = byBill.get(row.expenseId) ?? [];
    list.push({
      id: row.id,
      userId: row.userId,
      userName: row.user.name,
      amount: row.amountPaid,
      date: row.dueDate,
      recordedAt: row.createdAt,
      recordedByName: row.recordedBy?.name ?? null,
      reversalOfId: row.reversalOfId,
      isReversed: Boolean(row.reversedBy)
    });
    byBill.set(row.expenseId, list);
  }

  return byBill;
}
