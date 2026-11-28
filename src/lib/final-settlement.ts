import { traced } from '@/lib/log';
import { closeMonth, markSettled, listClosings, type ClosingSummary } from '@/lib/closings';
import { buildGroupReport, type GroupReport } from '@/lib/group-report';
import type { SettlementGroup } from '@/lib/settlement';
import { settleUp, type SettleUp } from '@/lib/bill-view';
import { currentMonthKey, dayToUtcDate, previousMonthKey, round2 } from '@/lib/month';
import { CARRY_IN_TYPE, EXPENSE_TYPES, GENERAL_PAYMENT_TYPE, PAYMENT_STATUS } from '@/lib/constants';
import { categoryLabels } from '@/lib/expense-categories';
import { strings } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';

export type FinalSettlementGroup = SettlementGroup & { name: string; status: string };

export type FinalSettlementMember = {
  id: string;
  name: string;
  email: string;
  meals: number;
  carryIn: number;
  mealCost: number;
  billShare: number;
  billShareByType: Record<string, number>;
  totalCost: number;
  payableByType: Record<string, number>;
  bazarPaid: number;
  cashPaid: number;
  paidByType: Record<string, number>;
  dueAtClose: number;
  closeStatus: string;
  liveDue: number;
  status: string;
  isCurrentMember: boolean;
};

export type FinalSettlement = {
  groupId: string;
  groupName: string;
  closingId: string;
  monthKey: string;
  closedThrough: string;
  closedBy: string | null;
  settledAt: string | null;
  settledBy: string | null;
  mealRate: number;
  totals: GroupReport['totals'];
  categoryLabels: Record<string, string>;
  members: FinalSettlementMember[];
  settleUp: SettleUp;
  allClear: boolean;
};

async function findGroupFinalClosing(groupId: string, monthKey: string): Promise<ClosingSummary | null> {
  const closings = await listClosings(groupId, monthKey);
  return closings.find((closing) => closing.scope === 'GROUP' && !closing.reopenedAt) ?? null;
}

async function ensureFinalSettlementImpl(
  group: FinalSettlementGroup,
  actor?: { id: string; name: string }
): Promise<ClosingSummary | null> {
  const lastMonthKey = previousMonthKey(currentMonthKey());
  const existing = await findGroupFinalClosing(group.id, lastMonthKey);
  if (existing) return existing;

  const result = await closeMonth({
    group,
    monthKey: lastMonthKey,
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? 'Automatic monthly settlement'
  });
  if (!result.ok) return null;

  return findGroupFinalClosing(group.id, lastMonthKey);
}

export const ensureFinalSettlement = traced('ensureFinalSettlement', ensureFinalSettlementImpl);

async function getFinalSettlementImpl(group: FinalSettlementGroup): Promise<FinalSettlement | null> {
  const closing = await ensureFinalSettlement(group);
  if (!closing) return null;

  const [historical, live, labels] = await Promise.all([
    buildGroupReport(group, closing.monthKey, { through: closing.closedThrough }),
    buildGroupReport(group, currentMonthKey()),
    categoryLabels(group.id)
  ]);

  const liveById = new Map(live.members.map((member) => [member.id, member]));

  const members: FinalSettlementMember[] = historical.members.map((member) => {
    const liveMember = liveById.get(member.id);
    return {
      id: member.id,
      name: member.name,
      email: member.email,
      meals: member.meals,
      carryIn: member.carryIn,
      mealCost: member.mealCost,
      billShare: member.billShare,
      billShareByType: member.billShareByType,
      totalCost: member.totalCost,
      payableByType: {
        [CARRY_IN_TYPE]: member.carryIn,
        [EXPENSE_TYPES.BAZAR]: member.mealCost,
        ...member.billShareByType
      },
      bazarPaid: member.bazarPaid,
      cashPaid: member.collected,
      paidByType: { [EXPENSE_TYPES.BAZAR]: member.bazarPaid, ...member.collectedByType },
      dueAtClose: member.due,
      closeStatus: member.status,
      liveDue: liveMember?.due ?? member.due,
      status: liveMember?.status ?? member.status,
      isCurrentMember: liveMember !== undefined
    };
  });

  const settleUpResult = settleUp(members.map((member) => ({ userId: member.id, userName: member.name, net: -member.dueAtClose })));
  const allClear = members.every((member) => !member.isCurrentMember || member.closeStatus === PAYMENT_STATUS.PAID);

  return {
    groupId: group.id,
    groupName: group.name,
    closingId: closing.id,
    monthKey: closing.monthKey,
    closedThrough: closing.closedThrough,
    closedBy: closing.closedBy,
    settledAt: closing.settledAt,
    settledBy: closing.settledBy,
    mealRate: historical.totals.mealRate,
    totals: historical.totals,
    categoryLabels: {
      ...labels,
      [GENERAL_PAYMENT_TYPE]: strings.settlement.generalPaymentLabel,
      [CARRY_IN_TYPE]: strings.memberDetail.carryIn
    },
    members,
    settleUp: settleUpResult,
    allClear
  };
}

export const getFinalSettlement = traced('getFinalSettlement', getFinalSettlementImpl);

async function settleMemberBalanceImpl(
  group: FinalSettlementGroup,
  userId: string,
  actor: { id: string; name: string }
): Promise<{ ok: true; amount: number; monthKey: string } | { ok: false; error: string }> {
  const report = await getFinalSettlement(group);
  if (!report) {
    return { ok: false, error: "Last month hasn't been finalized yet." };
  }
  if (report.settledAt) {
    return { ok: false, error: 'That month is already settled.' };
  }

  const member = report.members.find((row) => row.id === userId);
  if (!member) {
    return { ok: false, error: 'That member has nothing recorded for that month.' };
  }

  const amount = round2(member.dueAtClose);
  if (Math.abs(amount) < 0.01) {
    return { ok: false, error: 'That balance is already settled.' };
  }

  const legs = report.settleUp.transfers.filter((t) => t.fromUserId === userId || t.toUserId === userId);
  const coveredPaisa = Math.round(legs.reduce((sum, t) => sum + t.amount, 0) * 100);
  if (coveredPaisa < Math.round(Math.abs(amount) * 100) - 1) {
    return {
      ok: false,
      error: 'Part of this balance has no matching member to settle with yet — see the note under "Settle up" first.'
    };
  }

  const dueDate = dayToUtcDate(report.closedThrough);

  const written = await runSettlementTransaction(async (tx) => {
    await recordSettlementSubmission(tx, { report, member, method: 'SELF', actor });

    for (const leg of legs) {
      const legAmount = round2(leg.amount);
      const payerRow = await tx.paymentStatus.create({
        data: {
          userId: leg.fromUserId,
          groupId: group.id,
          toUserId: leg.toUserId,
          amountDue: legAmount,
          amountPaid: legAmount,
          status: PAYMENT_STATUS.PAID,
          dueDate,
          recordedById: actor.id,
          publishedAt: new Date()
        }
      });

      await tx.paymentStatus.create({
        data: {
          userId: leg.toUserId,
          groupId: group.id,
          offsetOfId: payerRow.id,
          amountDue: 0,
          amountPaid: -legAmount,
          status: PAYMENT_STATUS.OFFSET,
          dueDate,
          recordedById: actor.id,
          publishedAt: new Date()
        }
      });
    }
  });
  if (!written.ok) return written;

  return { ok: true, amount, monthKey: report.monthKey };
}

export const settleMemberBalance = traced('settleMemberBalance', settleMemberBalanceImpl);

type SettlementTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type SettlementSubmissionMethod = 'SELF' | 'SUPERVISOR';

export type SettlementSubmissionTransfer = {
  direction: 'out' | 'in';
  counterpartyName: string;
  amount: number;
};

function submissionTransfers(report: FinalSettlement, userId: string): SettlementSubmissionTransfer[] {
  return report.settleUp.transfers
    .filter((transfer) => transfer.fromUserId === userId || transfer.toUserId === userId)
    .map((transfer) =>
      transfer.fromUserId === userId
        ? { direction: 'out' as const, counterpartyName: transfer.toName, amount: round2(transfer.amount) }
        : { direction: 'in' as const, counterpartyName: transfer.fromName, amount: round2(transfer.amount) }
    );
}

async function recordSettlementSubmission(
  tx: SettlementTx,
  params: {
    report: FinalSettlement;
    member: FinalSettlementMember;
    method: SettlementSubmissionMethod;
    actor: { id: string; name: string };
  }
) {
  const { report, member, method, actor } = params;

  await tx.settlementSubmission.create({
    data: {
      userId: member.id,
      groupId: report.groupId,
      closingId: report.closingId,
      monthKey: report.monthKey,
      groupName: report.groupName,
      method,
      actorId: actor.id,
      actorName: actor.name,
      mealRate: report.mealRate,
      meals: member.meals,
      carryIn: round2(member.carryIn),
      mealCost: round2(member.mealCost),
      billShare: round2(member.billShare),
      totalCost: round2(member.totalCost),
      bazarPaid: round2(member.bazarPaid),
      cashPaid: round2(member.cashPaid),
      dueAtClose: round2(member.dueAtClose),
      payableByType: member.payableByType,
      paidByType: member.paidByType,
      transfers: submissionTransfers(report, member.id),
      submittedAt: new Date(),
      publishedAt: new Date()
    }
  });
}

const UNIQUE_VIOLATION = 'P2002';
const ALREADY_SETTLED_ERROR = 'That balance was just settled by someone else.';

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === UNIQUE_VIOLATION;
}

async function runSettlementTransaction(work: (tx: SettlementTx) => Promise<void>): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await prisma.$transaction(work);
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: ALREADY_SETTLED_ERROR };
    throw error;
  }
}

function writeSettlementRow(
  tx: SettlementTx,
  params: { groupId: string; member: FinalSettlementMember; dueDate: Date; actorId: string }
) {
  const amount = round2(params.member.dueAtClose);
  return tx.paymentStatus.create({
    data: {
      userId: params.member.id,
      groupId: params.groupId,
      amountDue: amount > 0 ? amount : 0,
      amountPaid: amount,
      status: amount > 0 ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.REFUND,
      dueDate: params.dueDate,
      recordedById: params.actorId,
      publishedAt: new Date()
    }
  });
}

async function declareMemberSettledImpl(
  group: FinalSettlementGroup,
  userId: string,
  actor: { id: string; name: string }
): Promise<{ ok: true; amount: number } | { ok: false; error: string }> {
  const report = await getFinalSettlement(group);
  if (!report) {
    return { ok: false, error: "Last month hasn't been finalized yet." };
  }
  if (report.settledAt) {
    return { ok: false, error: 'That month is already settled.' };
  }

  const member = report.members.find((row) => row.id === userId);
  if (!member) {
    return { ok: false, error: 'That member has nothing recorded for that month.' };
  }
  if (Math.abs(Math.round(member.dueAtClose * 100)) < 1) {
    return { ok: false, error: 'That balance is already settled.' };
  }

  const dueDate = dayToUtcDate(report.closedThrough);
  const written = await runSettlementTransaction(async (tx) => {
    await recordSettlementSubmission(tx, { report, member, method: 'SUPERVISOR', actor });
    await writeSettlementRow(tx, { groupId: group.id, member, dueDate, actorId: actor.id });
  });
  if (!written.ok) return written;

  return { ok: true, amount: round2(member.dueAtClose) };
}

export const declareMemberSettled = traced('declareMemberSettled', declareMemberSettledImpl);

async function settleWholeMonthImpl(
  group: FinalSettlementGroup,
  actor: { id: string; name: string }
): Promise<{ ok: true; settled: number; monthKey: string } | { ok: false; error: string }> {
  const report = await getFinalSettlement(group);
  if (!report) {
    return { ok: false, error: "Last month hasn't been finalized yet." };
  }
  if (report.settledAt) {
    return { ok: false, error: 'That month is already settled.' };
  }

  const dueDate = dayToUtcDate(report.closedThrough);
  const pending = report.members.filter((member) => Math.abs(Math.round(member.dueAtClose * 100)) >= 1);

  if (pending.length > 0) {
    const written = await runSettlementTransaction(async (tx) => {
      for (const member of pending) {
        await recordSettlementSubmission(tx, { report, member, method: 'SUPERVISOR', actor });
        await writeSettlementRow(tx, { groupId: group.id, member, dueDate, actorId: actor.id });
      }
    });
    if (!written.ok) return written;
  }

  const marked = await markSettled(report.closingId, actor);
  if (!marked.ok) {
    return { ok: false, error: marked.error };
  }

  return { ok: true, settled: pending.length, monthKey: report.monthKey };
}

export const settleWholeMonth = traced('settleWholeMonth', settleWholeMonthImpl);

async function markFinalSettlementSettledImpl(
  group: FinalSettlementGroup,
  actor: { id: string; name: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const report = await getFinalSettlement(group);
  if (!report) {
    return { ok: false, error: "Last month hasn't been finalized yet." };
  }
  if (report.settledAt) {
    return { ok: false, error: 'That month is already settled.' };
  }
  if (!report.allClear) {
    return { ok: false, error: 'Not everyone is settled yet.' };
  }

  return markSettled(report.closingId, actor);
}

export const markFinalSettlementSettled = traced('markFinalSettlementSettled', markFinalSettlementSettledImpl);
