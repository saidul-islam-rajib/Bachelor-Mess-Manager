import { prisma } from '@/lib/prisma';
import { BILL_TYPE_FILTER, PAYMENT_STATUS } from '@/lib/constants';
import { dayToUtcDate, round2 } from '@/lib/month';

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
  isLinked: boolean;
  toUserId: string | null;
  toUserName: string | null;
  fromUserId: string | null;
  fromUserName: string | null;
  fromAdvance: boolean;
};

export type CollectionEntry = {
  id: string;
  amount: number;
  date: string;
  recordedAt: string;
  recordedByName: string | null;
  isReversal: boolean;
  isReversed: boolean;
  toUserName: string | null;
  fromUserName: string | null;
  fromAdvance: boolean;
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
    include: {
      reversedBy: { select: { id: true } },
      offsetBy: { include: { reversedBy: { select: { id: true } } } }
    }
  });

  if (!original) return { ok: false, error: 'That entry does not exist.' };
  if (groupId && original.groupId !== groupId) {
    return { ok: false, error: 'That entry belongs to another mess.' };
  }
  if (original.offsetOfId) {
    return { ok: false, error: 'Reverse the original payment entry instead — this one updates automatically.' };
  }
  if (original.reversalOfId) {
    return { ok: false, error: 'That entry is already a correction, so it cannot be reversed again.' };
  }
  if (original.reversedBy) {
    return { ok: false, error: 'That entry has already been reversed.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentStatus.create({
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

    const offset = original.offsetBy;
    if (offset && !offset.reversedBy) {
      await tx.paymentStatus.create({
        data: {
          userId: offset.userId,
          groupId: offset.groupId,
          expenseId: offset.expenseId,
          reversalOfId: offset.id,
          recordedById: actorId,
          amountDue: offset.amountDue,
          amountPaid: -offset.amountPaid,
          status: PAYMENT_STATUS.REFUND,
          dueDate: offset.dueDate,
          publishedAt: new Date()
        }
      });
    }

    if (original.fromAdvance && original.amountPaid > 0) {
      await tx.memberAdvance.create({
        data: {
          userId: original.userId,
          groupId: original.groupId,
          expenseId: original.expenseId,
          amount: original.amountPaid,
          note: 'Refunded — bill payment reversed',
          recordedById: actorId,
          publishedAt: new Date()
        }
      });
    }
  });

  return { ok: true, amount: round2(original.amountPaid), userId: original.userId };
}

async function paymentFamilyIds(paymentId: string): Promise<string[]> {
  const ids = new Set<string>([paymentId]);
  let frontier = [paymentId];

  while (frontier.length > 0) {
    const rows = await prisma.paymentStatus.findMany({
      where: {
        OR: [{ id: { in: frontier } }, { offsetOfId: { in: frontier } }, { reversalOfId: { in: frontier } }]
      },
      select: { id: true, offsetOfId: true, reversalOfId: true }
    });

    const next: string[] = [];
    for (const row of rows) {
      for (const id of [row.id, row.offsetOfId, row.reversalOfId]) {
        if (id && !ids.has(id)) {
          ids.add(id);
          next.push(id);
        }
      }
    }
    frontier = next;
  }

  return [...ids];
}

export type HardDeleteResult = { ok: true; count: number } | { ok: false; error: string };

export async function hardDeletePayment(params: {
  paymentId: string;
  groupId?: string;
}): Promise<HardDeleteResult> {
  const { paymentId, groupId } = params;

  const original = await prisma.paymentStatus.findUnique({ where: { id: paymentId } });
  if (!original) return { ok: false, error: 'That entry does not exist.' };
  if (groupId && original.groupId !== groupId) {
    return { ok: false, error: 'That entry belongs to another mess.' };
  }

  const familyIds = await paymentFamilyIds(paymentId);

  await prisma.$transaction(async (tx) => {
    let remaining = await tx.paymentStatus.findMany({
      where: { id: { in: familyIds } },
      select: { id: true, offsetOfId: true, reversalOfId: true }
    });

    while (remaining.length > 0) {
      const referencedAsParent = new Set(
        remaining.flatMap((row) => [row.offsetOfId, row.reversalOfId]).filter((id): id is string => Boolean(id))
      );
      const deletable = remaining.filter((row) => !referencedAsParent.has(row.id));
      if (deletable.length === 0) break;

      await tx.paymentStatus.deleteMany({ where: { id: { in: deletable.map((row) => row.id) } } });
      const deletedIds = new Set(deletable.map((row) => row.id));
      remaining = remaining.filter((row) => !deletedIds.has(row.id));
    }
  });

  return { ok: true, count: familyIds.length };
}

export type UpdatePaymentResult = { ok: true } | { ok: false; error: string };

export async function updatePaymentDetails(params: {
  paymentId: string;
  groupId?: string;
  amount?: number;
  date?: string;
}): Promise<UpdatePaymentResult> {
  const { paymentId, groupId, amount, date } = params;

  const original = await prisma.paymentStatus.findUnique({
    where: { id: paymentId },
    include: { offsetBy: { select: { id: true } }, reversedBy: { select: { id: true } } }
  });
  if (!original) return { ok: false, error: 'That entry does not exist.' };
  if (groupId && original.groupId !== groupId) {
    return { ok: false, error: 'That entry belongs to another mess.' };
  }
  if (original.offsetOfId || original.offsetBy || original.reversalOfId || original.reversedBy || original.fromAdvance) {
    return {
      ok: false,
      error: 'This entry is linked to another record (a transfer, reversal, or advance) — reverse or hard-delete it instead of editing it directly.'
    };
  }

  const data: { amountPaid?: number; dueDate?: Date } = {};

  if (amount !== undefined) {
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100_000_000) {
      return { ok: false, error: 'Amount must be a non-zero number under 100,000,000.' };
    }
    data.amountPaid = round2(amount);
  }

  if (date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, error: 'A valid date (YYYY-MM-DD) is required.' };
    }
    data.dueDate = dayToUtcDate(date);
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  await prisma.paymentStatus.update({ where: { id: paymentId }, data });
  return { ok: true };
}

export function allocateToFronters(
  shares: { userId: string; advance: number }[],
  payerId: string,
  amount: number
): { userId: string; amount: number }[] {
  const owedBack = shares
    .filter((share) => share.userId !== payerId && share.advance > 0)
    .sort((a, b) => b.advance - a.advance);

  const allocations: { userId: string; amount: number }[] = [];
  let remaining = toPaisa(amount);

  for (const share of owedBack) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, toPaisa(share.advance));
    if (take <= 0) continue;
    allocations.push({ userId: share.userId, amount: fromPaisa(take) });
    remaining -= take;
  }

  return allocations;
}

export async function collectionsByBill(billIds: string[]): Promise<Map<string, CollectionRow[]>> {
  const byBill = new Map<string, CollectionRow[]>();
  if (billIds.length === 0) return byBill;

  const rows = await prisma.paymentStatus.findMany({
    where: { expenseId: { in: billIds } },
    include: {
      user: { select: { name: true } },
      recordedBy: { select: { name: true } },
      reversedBy: { select: { id: true } },
      offsetBy: { select: { id: true } },
      toUser: { select: { name: true } },
      offsetOf: { select: { userId: true, user: { select: { name: true } } } }
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
      isReversed: Boolean(row.reversedBy),
      isLinked: Boolean(
        row.offsetOfId || row.offsetBy || row.fromAdvance || row.reversalOfId || row.reversedBy
      ),
      toUserId: row.toUserId,
      toUserName: row.toUser?.name ?? null,
      fromUserId: row.offsetOf?.userId ?? null,
      fromUserName: row.offsetOf?.user.name ?? null,
      fromAdvance: row.fromAdvance
    });
    byBill.set(row.expenseId, list);
  }

  return byBill;
}

export type MemberBillCollectionTotals = { paid: number; outstanding: number };

export type GroupBillCollectionTotals = {
  perMember: Map<string, MemberBillCollectionTotals>;
  collected: number;
  outstanding: number;
};

export async function groupBillCollectionTotals(
  groupId: string,
  start: Date,
  nextStart: Date
): Promise<GroupBillCollectionTotals> {
  const perMember = new Map<string, MemberBillCollectionTotals>();
  const empty = { perMember, collected: 0, outstanding: 0 };

  const bills = await prisma.expenseEntry.findMany({
    where: { groupId, type: BILL_TYPE_FILTER, date: { gte: start, lt: nextStart } },
    select: { id: true, shares: { select: { userId: true, amount: true } } }
  });
  if (bills.length === 0) return empty;

  const collections = await collectionsByBill(bills.map((bill) => bill.id));

  let collected = 0;
  let outstanding = 0;
  for (const bill of bills) {
    const state = buildCollectionState(
      bill.shares.map((share) => ({ userId: share.userId, userName: '', amount: share.amount })),
      collections.get(bill.id) ?? []
    );
    collected = round2(collected + state.collected);
    outstanding = round2(outstanding + state.outstanding);

    for (const share of state.shares) {
      const current = perMember.get(share.userId) ?? { paid: 0, outstanding: 0 };
      perMember.set(share.userId, {
        paid: round2(current.paid + share.paid),
        outstanding: round2(current.outstanding + share.outstanding)
      });
    }
  }

  return { perMember, collected, outstanding };
}
