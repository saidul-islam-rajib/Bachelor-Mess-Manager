import { prisma } from '@/lib/prisma';
import { categoryLabels } from '@/lib/expense-categories';
import { CARRY_IN_TYPE, GENERAL_PAYMENT_TYPE } from '@/lib/constants';
import { strings } from '@/lib/i18n';
import type { SettlementSubmissionMethod, SettlementSubmissionTransfer } from '@/lib/final-settlement';

export type SettlementHistoryEntry = {
  id: string;
  groupId: string;
  groupName: string;
  monthKey: string;
  method: SettlementSubmissionMethod;
  actorName: string;
  submittedAt: string;
  mealRate: number;
  meals: number;
  carryIn: number;
  mealCost: number;
  billShare: number;
  totalCost: number;
  bazarPaid: number;
  cashPaid: number;
  dueAtClose: number;
  payableByType: Record<string, number>;
  paidByType: Record<string, number>;
  transfers: SettlementSubmissionTransfer[];
  categoryLabels: Record<string, string>;
};

function toRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value as Record<string, unknown>)) {
    if (typeof amount === 'number') out[key] = amount;
  }
  return out;
}

function toTransfers(value: unknown): SettlementSubmissionTransfer[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is SettlementSubmissionTransfer => {
      return (
        !!row &&
        typeof row === 'object' &&
        (row as SettlementSubmissionTransfer).direction !== undefined &&
        typeof (row as SettlementSubmissionTransfer).amount === 'number'
      );
    })
    .map((row) => ({
      direction: row.direction === 'in' ? 'in' : 'out',
      counterpartyName: String(row.counterpartyName ?? ''),
      amount: row.amount
    }));
}

export async function listSettlementHistory(filter: {
  userId: string;
  groupId?: string;
}): Promise<SettlementHistoryEntry[]> {
  const rows = await prisma.settlementSubmission.findMany({
    where: { userId: filter.userId, ...(filter.groupId ? { groupId: filter.groupId } : {}) },
    orderBy: [{ submittedAt: 'desc' }]
  });

  const labelCache = new Map<string, Record<string, string>>();
  const labelsFor = async (groupId: string): Promise<Record<string, string>> => {
    const cached = labelCache.get(groupId);
    if (cached) return cached;
    const base = await categoryLabels(groupId);
    const merged = {
      ...base,
      [GENERAL_PAYMENT_TYPE]: strings.settlement.generalPaymentLabel,
      [CARRY_IN_TYPE]: strings.memberDetail.carryIn
    };
    labelCache.set(groupId, merged);
    return merged;
  };

  const entries: SettlementHistoryEntry[] = [];
  for (const row of rows) {
    entries.push({
      id: row.id,
      groupId: row.groupId,
      groupName: row.groupName,
      monthKey: row.monthKey,
      method: row.method === 'SUPERVISOR' ? 'SUPERVISOR' : 'SELF',
      actorName: row.actorName,
      submittedAt: row.submittedAt.toISOString(),
      mealRate: row.mealRate,
      meals: row.meals,
      carryIn: row.carryIn,
      mealCost: row.mealCost,
      billShare: row.billShare,
      totalCost: row.totalCost,
      bazarPaid: row.bazarPaid,
      cashPaid: row.cashPaid,
      dueAtClose: row.dueAtClose,
      payableByType: toRecord(row.payableByType),
      paidByType: toRecord(row.paidByType),
      transfers: toTransfers(row.transfers),
      categoryLabels: await labelsFor(row.groupId)
    });
  }

  return entries;
}
