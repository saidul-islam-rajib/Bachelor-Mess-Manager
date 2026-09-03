import { closeMonth, markSettled, listClosings, type ClosingSummary } from '@/lib/closings';
import { buildGroupReport, type GroupReport } from '@/lib/group-report';
import type { SettlementGroup } from '@/lib/settlement';
import { settleUp, type SettleUp } from '@/lib/bill-view';
import { currentMonthKey, dayToUtcDate, previousMonthKey, round2 } from '@/lib/month';
import { PAYMENT_STATUS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

export type FinalSettlementGroup = SettlementGroup & { name: string; status: string };

export type FinalSettlementMember = {
  id: string;
  name: string;
  email: string;
  meals: number;
  mealCost: number;
  billShare: number;
  billShareByType: Record<string, number>;
  bazarPaid: number;
  cashPaid: number;
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
  members: FinalSettlementMember[];
  settleUp: SettleUp;
  allClear: boolean;
};

async function findGroupFinalClosing(groupId: string, monthKey: string): Promise<ClosingSummary | null> {
  const closings = await listClosings(groupId, monthKey);
  return closings.find((closing) => closing.scope === 'GROUP' && !closing.reopenedAt) ?? null;
}

export async function ensureFinalSettlement(
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

export async function getFinalSettlement(group: FinalSettlementGroup): Promise<FinalSettlement | null> {
  const closing = await ensureFinalSettlement(group);
  if (!closing) return null;

  const [historical, live] = await Promise.all([
    buildGroupReport(group, closing.monthKey, { through: closing.closedThrough }),
    buildGroupReport(group, currentMonthKey())
  ]);

  const liveById = new Map(live.members.map((member) => [member.id, member]));

  const members: FinalSettlementMember[] = historical.members.map((member) => {
    const liveMember = liveById.get(member.id);
    return {
      id: member.id,
      name: member.name,
      email: member.email,
      meals: member.meals,
      mealCost: member.mealCost,
      billShare: member.billShare,
      billShareByType: member.billShareByType,
      bazarPaid: member.bazarPaid,
      cashPaid: member.collected,
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
    members,
    settleUp: settleUpResult,
    allClear
  };
}

export async function settleMemberBalance(
  group: FinalSettlementGroup,
  userId: string,
  actor: { id: string; name: string }
): Promise<{ ok: true; amount: number; monthKey: string } | { ok: false; error: string }> {
  const report = await getFinalSettlement(group);
  if (!report) {
    return { ok: false, error: "Last month hasn't been finalized yet." };
  }

  const member = report.members.find((row) => row.id === userId);
  if (!member) {
    return { ok: false, error: 'That member has nothing recorded for that month.' };
  }

  const amount = round2(member.dueAtClose);
  if (Math.abs(amount) < 0.01) {
    return { ok: false, error: 'That balance is already settled.' };
  }

  // Balance the ledger rather than special-casing the sums: a due is written off as
  // money in, a refund as money back out, so every total lands on zero by itself.
  await prisma.paymentStatus.create({
    data: {
      userId,
      groupId: group.id,
      amountDue: amount > 0 ? amount : 0,
      amountPaid: amount,
      status: amount > 0 ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.REFUND,
      dueDate: dayToUtcDate(report.closedThrough),
      recordedById: actor.id,
      publishedAt: new Date()
    }
  });

  return { ok: true, amount, monthKey: report.monthKey };
}

export async function markFinalSettlementSettled(
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
