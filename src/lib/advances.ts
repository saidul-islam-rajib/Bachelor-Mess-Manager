import { traced } from '@/lib/log';
import { prisma } from '@/lib/prisma';
import { round2 } from '@/lib/month';
import { shareStatus } from '@/lib/bill-collections';

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const toPaisa = (amount: number) => Math.round(amount * 100);
const fromPaisa = (paisa: number) => round2(paisa / 100);

export type AdvanceRow = {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  note: string | null;
  expenseId: string | null;
  expenseType: string | null;
  recordedByName: string | null;
  reversalOfId: string | null;
  isReversed: boolean;
  createdAt: Date;
};

export async function advanceBalances(groupId: string, userIds?: string[]): Promise<Map<string, number>> {
  const rows = await prisma.memberAdvance.findMany({
    where: { groupId, ...(userIds ? { userId: { in: userIds } } : {}) },
    select: { userId: true, amount: true }
  });

  const paisaByUser = new Map<string, number>();
  for (const row of rows) {
    paisaByUser.set(row.userId, (paisaByUser.get(row.userId) ?? 0) + toPaisa(row.amount));
  }

  const balances = new Map<string, number>();
  for (const [userId, paisa] of paisaByUser) balances.set(userId, fromPaisa(paisa));
  return balances;
}

export async function listAdvances(groupId: string, limit = 100): Promise<AdvanceRow[]> {
  const rows = await prisma.memberAdvance.findMany({
    where: { groupId },
    include: {
      user: { select: { name: true } },
      recordedBy: { select: { name: true } },
      reversedBy: { select: { id: true } },
      expense: { select: { type: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: row.user.name,
    amount: round2(row.amount),
    note: row.note,
    expenseId: row.expenseId,
    expenseType: row.expense?.type ?? null,
    recordedByName: row.recordedBy?.name ?? null,
    reversalOfId: row.reversalOfId,
    isReversed: Boolean(row.reversedBy),
    createdAt: row.createdAt
  }));
}

async function recordAdvanceDepositImpl(params: {
  groupId: string;
  userId: string;
  amount: number;
  note: string | null;
  recordedById: string;
}) {
  return prisma.memberAdvance.create({
    data: {
      groupId: params.groupId,
      userId: params.userId,
      amount: round2(params.amount),
      note: params.note,
      recordedById: params.recordedById,
      publishedAt: new Date()
    }
  });
}

export const recordAdvanceDeposit = traced('recordAdvanceDeposit', recordAdvanceDepositImpl);

export type AdvanceReversalResult = { ok: true; amount: number; userId: string } | { ok: false; error: string };

async function reverseAdvanceDepositImpl(params: {
  advanceId: string;
  actorId: string;
  groupId?: string;
}): Promise<AdvanceReversalResult> {
  const { advanceId, actorId, groupId } = params;

  const original = await prisma.memberAdvance.findUnique({
    where: { id: advanceId },
    include: { reversedBy: { select: { id: true } } }
  });

  if (!original) return { ok: false, error: 'That entry does not exist.' };
  if (groupId && original.groupId !== groupId) return { ok: false, error: 'That entry belongs to another mess.' };
  if (original.amount <= 0) return { ok: false, error: 'Only deposits can be reversed here.' };
  if (original.expenseId) {
    return { ok: false, error: 'This was applied to a bill automatically — reverse that bill payment instead.' };
  }
  if (original.reversalOfId) {
    return { ok: false, error: 'That entry is already a correction, so it cannot be reversed again.' };
  }
  if (original.reversedBy) {
    return { ok: false, error: 'That entry has already been reversed.' };
  }

  const balances = await advanceBalances(original.groupId, [original.userId]);
  const currentBalance = balances.get(original.userId) ?? 0;
  if (round2(currentBalance - original.amount) < -0.01) {
    return {
      ok: false,
      error: 'Some of this deposit has already been applied to bills, so it can\'t be fully reversed.'
    };
  }

  await prisma.memberAdvance.create({
    data: {
      userId: original.userId,
      groupId: original.groupId,
      reversalOfId: original.id,
      recordedById: actorId,
      amount: -original.amount,
      note: 'Reversal',
      publishedAt: new Date()
    }
  });

  return { ok: true, amount: round2(original.amount), userId: original.userId };
}

export const reverseAdvanceDeposit = traced('reverseAdvanceDeposit', reverseAdvanceDepositImpl);

/// Called from inside the same transaction that creates a bill's shares. Any member
/// with an advance balance has their share auto-paid from it (up to what's available),
/// leaving a normal bill collection row so /bills reads exactly like a manual "mark paid".
async function applyAdvanceToSharesImpl(
  tx: TransactionClient,
  params: {
    groupId: string;
    expenseId: string;
    shares: { userId: string; amount: number }[];
    dueDate: Date;
    recordedById: string;
  }
): Promise<void> {
  const { groupId, expenseId, shares, dueDate, recordedById } = params;
  if (shares.length === 0) return;

  const rows = await tx.memberAdvance.findMany({
    where: { groupId, userId: { in: shares.map((s) => s.userId) } },
    select: { userId: true, amount: true }
  });

  const paisaByUser = new Map<string, number>();
  for (const row of rows) {
    paisaByUser.set(row.userId, (paisaByUser.get(row.userId) ?? 0) + toPaisa(row.amount));
  }

  for (const share of shares) {
    const balancePaisa = paisaByUser.get(share.userId) ?? 0;
    if (balancePaisa <= 0) continue;

    const sharePaisa = toPaisa(share.amount);
    const consumedPaisa = Math.min(balancePaisa, sharePaisa);
    if (consumedPaisa <= 0) continue;
    const consumed = fromPaisa(consumedPaisa);

    await tx.memberAdvance.create({
      data: {
        userId: share.userId,
        groupId,
        expenseId,
        amount: -consumed,
        note: 'Applied to bill',
        recordedById,
        publishedAt: new Date()
      }
    });

    await tx.paymentStatus.create({
      data: {
        userId: share.userId,
        groupId,
        expenseId,
        recordedById,
        fromAdvance: true,
        amountDue: round2(share.amount),
        amountPaid: consumed,
        status: shareStatus(sharePaisa, consumedPaisa),
        dueDate,
        publishedAt: new Date()
      }
    });
  }
}

export const applyAdvanceToShares = traced('applyAdvanceToShares', applyAdvanceToSharesImpl);

/// Called before a bill is deleted. Any advance that bill auto-consumed goes back
/// into the member's balance, so deleting a mistaken bill doesn't quietly shrink
/// their wallet with no trace of why.
async function refundAdvanceForBillImpl(
  tx: TransactionClient,
  params: { expenseId: string; actorId: string }
): Promise<void> {
  const rows = await tx.memberAdvance.findMany({
    where: { expenseId: params.expenseId, amount: { lt: 0 }, reversalOfId: null },
    include: { reversedBy: { select: { id: true } } }
  });

  for (const row of rows) {
    if (row.reversedBy) continue;
    await tx.memberAdvance.create({
      data: {
        userId: row.userId,
        groupId: row.groupId,
        reversalOfId: row.id,
        recordedById: params.actorId,
        amount: -row.amount,
        note: 'Refunded — bill deleted',
        publishedAt: new Date()
      }
    });
  }
}

export const refundAdvanceForBill = traced('refundAdvanceForBill', refundAdvanceForBillImpl);
