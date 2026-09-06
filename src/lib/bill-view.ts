import { SPLIT_METHODS } from '@/lib/constants';
import { round2 } from '@/lib/month';
import { strings } from '@/lib/i18n';

export type Collection = {
  id: string;
  amount: number;
  date: string;
  recordedAt: string;
  recordedByName: string | null;
  isReversal: boolean;
  isReversed: boolean;
  isLinked: boolean;
  toUserName: string | null;
  fromUserName: string | null;
  fromAdvance: boolean;
  fromPayer: boolean;
};

export type Share = {
  userId: string;
  userName: string;
  amount: number;
  paid: number;
  outstanding: number;
  advance: number;
  status: string;
  isShare: boolean;
  collections: Collection[];
};

export type Member = { id: string; name: string; email: string };

export type Bill = {
  id: string;
  type: string;
  amount: number;
  date: string;
  note: string;
  isReceived: boolean;
  splitMethod: string;
  payer: { id: string; name: string } | null;
  shares: Share[];
  collected: number;
  uncollected: number;
  advance: number;
  isFullyCollected: boolean;
  unpaidMemberCount: number;
};

export type Category = {
  id: string;
  code: string;
  label: string;
  isSystem: boolean;
  sortOrder: number;
  archived: boolean;
  inUse: number;
};

export type BillsData = {
  canManage: boolean;
  canRecordOwn: boolean;
  currentUserId: string;
  categories: Category[];
  categoryLabels: Record<string, string>;
  bills: Bill[];
  members: Member[];
  totals: {
    total: number;
    settled: number;
    outstanding: number;
    collected: number;
    uncollected: number;
    byType: Record<string, number>;
    byMember: Record<string, number>;
    dueByMember: Record<string, number>;
  };
};

export const BILL_KINDS = {
  SHARED: 'SHARED',
  ASSIGNED: 'ASSIGNED'
} as const;

export type BillKind = (typeof BILL_KINDS)[keyof typeof BILL_KINDS];

export const KIND_ORDER: BillKind[] = [BILL_KINDS.SHARED, BILL_KINDS.ASSIGNED];

export const BILL_KIND_COPY: Record<BillKind, { title: string; short: string; hint: string }> = strings.bills.kinds;

const toPaisa = (amount: number) => Math.round(amount * 100);
const fromPaisa = (paisa: number) => round2(paisa / 100);
const TOLERANCE_PAISA = 1;

export function billKind(bill: Bill): BillKind {
  return bill.splitMethod === SPLIT_METHODS.CUSTOM ? BILL_KINDS.ASSIGNED : BILL_KINDS.SHARED;
}

export function billShares(bill: Bill): Share[] {
  return bill.shares.filter((share) => share.isShare);
}

export function isSingleMemberBill(bill: Bill): boolean {
  return bill.splitMethod === SPLIT_METHODS.CUSTOM && billShares(bill).length === 1;
}

export function billsByKind(bills: Bill[]): Record<BillKind, Bill[]> {
  return {
    SHARED: bills.filter((bill) => billKind(bill) === BILL_KINDS.SHARED),
    ASSIGNED: bills.filter((bill) => billKind(bill) === BILL_KINDS.ASSIGNED)
  };
}

export type BillTotals = {
  count: number;
  total: number;
  collected: number;
  outstanding: number;
  advance: number;
};

export function totalsOf(bills: Bill[]): BillTotals {
  return bills.reduce<BillTotals>(
    (acc, bill) => ({
      count: acc.count + 1,
      total: round2(acc.total + bill.amount),
      collected: round2(acc.collected + bill.collected),
      outstanding: round2(acc.outstanding + bill.uncollected),
      advance: round2(acc.advance + bill.advance)
    }),
    { count: 0, total: 0, collected: 0, outstanding: 0, advance: 0 }
  );
}

export type TypeGroup = {
  type: string;
  bills: Bill[];
  totals: BillTotals;
};

export function billsByType(bills: Bill[]): TypeGroup[] {
  const groups = new Map<string, Bill[]>();
  for (const bill of bills) {
    const list = groups.get(bill.type) ?? [];
    list.push(bill);
    groups.set(bill.type, list);
  }

  return [...groups.entries()]
    .map(([type, list]) => ({ type, bills: list, totals: totalsOf(list) }))
    .sort((a, b) => {
      if (a.totals.total !== b.totals.total) return b.totals.total - a.totals.total;
      return a.type.localeCompare(b.type);
    });
}

export type MemberBillLine = {
  billId: string;
  type: string;
  date: string;
  billAmount: number;
  splitMethod: string;
  kind: BillKind;
  payerName: string | null;
  share: number;
  paid: number;
  outstanding: number;
  advance: number;
  status: string;
};

export type MemberSummary = {
  userId: string;
  userName: string;
  isCurrentUser: boolean;
  billCount: number;
  unpaidCount: number;
  share: number;
  paid: number;
  outstanding: number;
  advance: number;
  net: number;
  status: string;
  lines: MemberBillLine[];
};

export function memberStatus(sharePaisa: number, paidPaisa: number): string {
  if (sharePaisa <= 0) return 'PAID';
  if (paidPaisa <= 0) return 'PENDING';
  if (paidPaisa >= sharePaisa - TOLERANCE_PAISA) return 'PAID';
  return 'PARTIAL';
}

export function summarizeMembers(bills: Bill[], currentUserId: string): MemberSummary[] {
  type Bucket = {
    userId: string;
    userName: string;
    sharePaisa: number;
    paidPaisa: number;
    outstandingPaisa: number;
    advancePaisa: number;
    unpaidCount: number;
    lines: MemberBillLine[];
  };

  const buckets = new Map<string, Bucket>();

  for (const bill of bills) {
    const kind = billKind(bill);
    for (const share of bill.shares) {
      const bucket = buckets.get(share.userId) ?? {
        userId: share.userId,
        userName: share.userName,
        sharePaisa: 0,
        paidPaisa: 0,
        outstandingPaisa: 0,
        advancePaisa: 0,
        unpaidCount: 0,
        lines: []
      };

      bucket.sharePaisa += toPaisa(share.amount);
      bucket.paidPaisa += toPaisa(share.paid);
      bucket.outstandingPaisa += toPaisa(share.outstanding);
      bucket.advancePaisa += toPaisa(share.advance);
      if (toPaisa(share.outstanding) > TOLERANCE_PAISA) bucket.unpaidCount += 1;
      bucket.lines.push({
        billId: bill.id,
        type: bill.type,
        date: bill.date,
        billAmount: bill.amount,
        splitMethod: bill.splitMethod,
        kind,
        payerName: bill.payer?.name ?? null,
        share: share.amount,
        paid: share.paid,
        outstanding: share.outstanding,
        advance: share.advance,
        status: share.status
      });

      buckets.set(share.userId, bucket);
    }
  }

  return [...buckets.values()]
    .map((bucket) => ({
      userId: bucket.userId,
      userName: bucket.userName,
      isCurrentUser: bucket.userId === currentUserId,
      billCount: bucket.lines.length,
      unpaidCount: bucket.unpaidCount,
      share: fromPaisa(bucket.sharePaisa),
      paid: fromPaisa(bucket.paidPaisa),
      outstanding: fromPaisa(bucket.outstandingPaisa),
      advance: fromPaisa(bucket.advancePaisa),
      net: fromPaisa(bucket.paidPaisa - bucket.sharePaisa),
      status: memberStatus(bucket.sharePaisa, bucket.paidPaisa),
      lines: bucket.lines
    }))
    .sort((a, b) => {
      if (a.isCurrentUser !== b.isCurrentUser) return a.isCurrentUser ? -1 : 1;
      if (a.outstanding !== b.outstanding) return b.outstanding - a.outstanding;
      return a.userName.localeCompare(b.userName);
    });
}

export function sortByPosition(summaries: MemberSummary[]): MemberSummary[] {
  return [...summaries].sort((a, b) => {
    if (a.isCurrentUser !== b.isCurrentUser) return a.isCurrentUser ? -1 : 1;
    if (a.net !== b.net) return a.net - b.net;
    return a.userName.localeCompare(b.userName);
  });
}

export type SummaryTotals = {
  share: number;
  paid: number;
  toPay: number;
  toRefund: number;
};

export function summaryTotals(summaries: MemberSummary[]): SummaryTotals {
  const totals = summaries.reduce(
    (acc, row) => {
      const netPaisa = toPaisa(row.net);
      return {
        sharePaisa: acc.sharePaisa + toPaisa(row.share),
        paidPaisa: acc.paidPaisa + toPaisa(row.paid),
        toPayPaisa: acc.toPayPaisa + (netPaisa < 0 ? -netPaisa : 0),
        toRefundPaisa: acc.toRefundPaisa + (netPaisa > 0 ? netPaisa : 0)
      };
    },
    { sharePaisa: 0, paidPaisa: 0, toPayPaisa: 0, toRefundPaisa: 0 }
  );

  return {
    share: fromPaisa(totals.sharePaisa),
    paid: fromPaisa(totals.paidPaisa),
    toPay: fromPaisa(totals.toPayPaisa),
    toRefund: fromPaisa(totals.toRefundPaisa)
  };
}

export type Transfer = {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
};

export type SettleUp = {
  transfers: Transfer[];
  unmatched: number;
  surplus: number;
};

export function settleUp(summaries: Pick<MemberSummary, 'userId' | 'userName' | 'net'>[]): SettleUp {
  const debtors = summaries
    .filter((row) => toPaisa(row.net) < 0)
    .map((row) => ({ row, remaining: -toPaisa(row.net) }))
    .sort((a, b) => b.remaining - a.remaining || a.row.userName.localeCompare(b.row.userName));

  const creditors = summaries
    .filter((row) => toPaisa(row.net) > 0)
    .map((row) => ({ row, remaining: toPaisa(row.net) }))
    .sort((a, b) => b.remaining - a.remaining || a.row.userName.localeCompare(b.row.userName));

  const transfers: Transfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.remaining, creditor.remaining);

    transfers.push({
      fromUserId: debtor.row.userId,
      fromName: debtor.row.userName,
      toUserId: creditor.row.userId,
      toName: creditor.row.userName,
      amount: fromPaisa(amount)
    });

    debtor.remaining -= amount;
    creditor.remaining -= amount;
    if (debtor.remaining === 0) debtorIndex += 1;
    if (creditor.remaining === 0) creditorIndex += 1;
  }

  return {
    transfers,
    unmatched: fromPaisa(debtors.reduce((sum, entry) => sum + entry.remaining, 0)),
    surplus: fromPaisa(creditors.reduce((sum, entry) => sum + entry.remaining, 0))
  };
}
