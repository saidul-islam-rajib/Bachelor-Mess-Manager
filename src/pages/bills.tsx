import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { GroupMonthControls, useGroupMonth } from '@/components/GroupMonthControls';
import { Listbox, PageTitle } from '@/components/ui';
import { HistoryList, type HistoryEvent } from '@/components/ChangeHistory';
import { BillStats } from '@/components/bills/BillStats';
import { FinalSummary } from '@/components/bills/FinalSummary';
import { StatusPill } from '@/components/bills/StatusPill';
import { SPLIT_METHODS, SPLIT_METHOD_LABELS } from '@/lib/constants';
import {
  BILL_KIND_COPY,
  KIND_ORDER,
  billsByKind,
  billsByType,
  totalsOf,
  type Bill,
  type BillsData,
  type Category,
  type Member,
  type Share
} from '@/lib/bill-view';
import { round2, todayKey } from '@/lib/month';
import { formatCurrency, formatDayKey, formatInstant } from '@/lib/format';
import { strings } from '@/lib/i18n';

const taka = formatCurrency;

function longDate(day: string) {
  return formatDayKey(day, 'full');
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function BillsPage() {
  const toast = useToast();
  const { groups, groupId, setGroupId, month, setMonth, loadingGroups } = useGroupMonth();

  const [data, setData] = useState<BillsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [advanceVersion, setAdvanceVersion] = useState(0);
  const bumpAdvances = useCallback(() => setAdvanceVersion((v) => v + 1), []);

  const toggleExpanded = useCallback((billId: string) => {
    setExpanded((current) =>
      current.includes(billId) ? current.filter((id) => id !== billId) : [...current, billId]
    );
  }, []);

  const collapse = useCallback((billId: string) => {
    setExpanded((current) => current.filter((id) => id !== billId));
  }, []);

  const revealBill = useCallback((billId: string) => {
    setExpanded((current) => (current.includes(billId) ? current : [...current, billId]));
    window.requestAnimationFrame(() => {
      document.getElementById(`bill-${billId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  const load = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!groupId) return;
      if (!quiet) setLoading(true);
      try {
        const res = await fetch(`/api/groups/${groupId}/bills?month=${month}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? strings.bills.loadFailed);
        setData(body);
      } catch (err) {
        toast.error((err as Error).message);
        if (!quiet) setData(null);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [groupId, month, toast]
  );

  const refresh = useCallback(() => load({ quiet: true }), [load]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleSettled(bill: Bill) {
    try {
      const res = await fetch(`/api/bills/${bill.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isReceived: !bill.isReceived })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? strings.bills.updateFailed);
      toast.success(bill.isReceived ? strings.bills.markedUnpaid : strings.bills.markedPaid);
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function recordCollection(bill: Bill, body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/bills/${bill.id}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? strings.bills.collectFailed);
      toast.success(strings.bills.collectionRecorded);
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function reverseCollection(bill: Bill, collectionId: string) {
    if (!window.confirm(strings.bills.reverseEntryConfirm)) {
      return;
    }
    try {
      const res = await fetch(`/api/bills/${bill.id}/collections?collectionId=${collectionId}`, {
        method: 'DELETE'
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? strings.bills.reverseEntryFailed);
      toast.success(strings.bills.entryReversed);
      await refresh();
      bumpAdvances();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(bill: Bill) {
    const label = data?.categoryLabels[bill.type] ?? bill.type;
    if (!window.confirm(strings.bills.deleteConfirm(label, taka(bill.amount)))) {
      return;
    }
    try {
      const res = await fetch(`/api/bills/${bill.id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? strings.bills.deleteFailed);
      toast.success(strings.bills.deleted);
      collapse(bill.id);
      await refresh();
      bumpAdvances();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const canManage = data?.canManage ?? false;
  const canRecordOwn = data?.canRecordOwn ?? false;
  const hasBreakdown = Object.values(data?.totals.byType ?? {}).some((amount) => amount > 0);
  const pairBreakdownWithAdvances = hasBreakdown && !canManage;
  const bills = useMemo(() => data?.bills ?? [], [data?.bills]);
  const grouped = useMemo(() => billsByKind(bills), [bills]);
  const openCount = bills.filter((bill) => expanded.includes(bill.id)).length;

  return (
    <section className="mx-auto max-w-content px-4 py-8 sm:py-10">
      <PageTitle title={strings.bills.title} />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">{strings.bills.title}</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">{strings.bills.subtitle}</p>
      </div>

      {loadingGroups ? (
        <Card>{strings.common.loading}</Card>
      ) : groups.length === 0 ? (
        <Card>{strings.emptyState.noGroups}</Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <GroupMonthControls groups={groups} groupId={groupId} setGroupId={setGroupId} month={month} setMonth={setMonth} />
          </Card>

          {loading || !data ? (
            <Card>{strings.bills.loadingBills}</Card>
          ) : (
            <>
              <BillStats
                bills={bills}
                totals={data.totals}
                labels={data.categoryLabels}
                currentUserId={data.currentUserId}
                onOpenBill={revealBill}
              />

              <div
                className={`grid gap-4 ${
                  hasBreakdown && canManage ? 'lg:grid-cols-5' : pairBreakdownWithAdvances ? 'lg:grid-cols-2' : ''
                }`}
              >
                {hasBreakdown && (
                  <div className={canManage ? 'lg:col-span-3' : ''}>
                    <Breakdown
                      byType={data.totals.byType}
                      labels={data.categoryLabels}
                      total={data.totals.total}
                    />
                  </div>
                )}
                {canManage && (
                  <div className={hasBreakdown ? 'lg:col-span-2' : ''}>
                    <CategoryManager groupId={groupId} categories={data.categories} onChanged={refresh} />
                  </div>
                )}
                {pairBreakdownWithAdvances && (
                  <AdvancesSection groupId={groupId} canManage={canManage} refreshToken={advanceVersion} />
                )}
              </div>

              {canManage && (
                <AddBillForm
                  groupId={groupId}
                  members={data.members}
                  categories={data.categories}
                  month={month}
                  onSaved={async () => {
                    await refresh();
                    bumpAdvances();
                  }}
                />
              )}

              <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold">{strings.bills.thisMonth}</h2>
                  <div className="flex items-center gap-3">
                    {bills.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setExpanded(openCount === bills.length ? [] : bills.map((bill) => bill.id))}
                        className="inline-flex min-h-[2rem] items-center rounded-full border border-slate-200 dark:border-slate-700 px-3 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        {openCount === bills.length ? strings.bills.collapseAll : strings.bills.expandAll}
                      </button>
                    )}
                    <p className="text-sm text-slate-500 dark:text-slate-400">{strings.bills.recorded(bills.length)}</p>
                  </div>
                </div>

                {bills.length === 0 ? (
                  <p className="mt-4 text-slate-500 dark:text-slate-400">
                    {canManage ? strings.bills.noneSupervisor : strings.bills.none}
                  </p>
                ) : (
                  <div className="mt-5 space-y-6">
                    {KIND_ORDER.filter((kind) => grouped[kind].length > 0).map((kind) => (
                      <section key={kind}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                            {BILL_KIND_COPY[kind].title}{' '}
                            <span className="font-normal text-slate-400 dark:text-slate-500">({grouped[kind].length})</span>
                          </h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {taka(totalsOf(grouped[kind]).total)} ·{' '}
                            {strings.bills.stillOwed(taka(totalsOf(grouped[kind]).outstanding))}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{BILL_KIND_COPY[kind].hint}</p>

                        <div className="mt-3 space-y-4">
                          {billsByType(grouped[kind]).map((group) => (
                            <div
                              key={group.type}
                              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 p-2.5 sm:p-4"
                            >
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                                  {data.categoryLabels[group.type] ?? group.type}
                                  <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                                    {strings.bills.billCount(group.bills.length)}
                                  </span>
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                                    {taka(group.totals.total)}
                                  </span>{' '}
                                  · {strings.bills.collectedAmount(taka(group.totals.collected))}
                                  {group.totals.outstanding > 0 && (
                                    <span className="font-semibold text-rose-600">
                                      {' '}
                                      · {strings.bills.stillOwed(taka(group.totals.outstanding))}
                                    </span>
                                  )}
                                </p>
                              </div>

                              <ul className="mt-3 space-y-3">
                                {group.bills.map((bill) =>
                                  editing === bill.id ? (
                                    <EditBill
                                      key={bill.id}
                                      bill={bill}
                                      groupId={groupId}
                                      members={data.members}
                                      categories={data.categories}
                                      onCancel={() => setEditing(null)}
                                      onSaved={async () => {
                                        setEditing(null);
                                        await refresh();
                                      }}
                                    />
                                  ) : (
                                    <BillRow
                                      key={bill.id}
                                      bill={bill}
                                      members={data.members}
                                      currentUserId={data.currentUserId}
                                      canManage={canManage}
                                      canRecordOwn={canRecordOwn}
                                      isOpen={expanded.includes(bill.id)}
                                      onToggleOpen={() => toggleExpanded(bill.id)}
                                      onEdit={() => setEditing(bill.id)}
                                      onToggle={() => toggleSettled(bill)}
                                      onDelete={() => remove(bill)}
                                      onCollect={(body) => recordCollection(bill, body)}
                                    />
                                  )
                                )}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>

              {!pairBreakdownWithAdvances && (
                <AdvancesSection groupId={groupId} canManage={canManage} refreshToken={advanceVersion} />
              )}

              {bills.length > 0 && (
                <FinalSummary
                  bills={bills}
                  labels={data.categoryLabels}
                  currentUserId={data.currentUserId}
                  onOpenBill={revealBill}
                />
              )}

              <PaymentHistorySection
                bills={bills}
                labels={data.categoryLabels}
                canManage={canManage}
                onOpenBill={revealBill}
                onReverse={(billId, collectionId) => {
                  const bill = bills.find((b) => b.id === billId);
                  if (bill) reverseCollection(bill, collectionId);
                }}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}

type PaymentHistoryEntry = {
  id: string;
  billId: string;
  billLabel: string;
  billDate: string;
  memberName: string;
  amount: number;
  isReversed: boolean;
  toUserName: string | null;
  fromAdvance: boolean;
  recordedByName: string | null;
  recordedAt: string;
};

const HISTORY_PAGE_SIZE = 8;

function PaymentHistorySection({
  bills,
  labels,
  canManage,
  onOpenBill,
  onReverse
}: {
  bills: Bill[];
  labels: Record<string, string>;
  canManage: boolean;
  onOpenBill: (billId: string) => void;
  onReverse: (billId: string, collectionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);

  // Only the payer-initiated entry is shown — the auto-generated offset on the
  // recipient's side and reversal corrections are folded into this same row
  // (via toUserName / isReversed) so each real-world action is one line, not three.
  const entries = useMemo(() => {
    const rows: PaymentHistoryEntry[] = [];
    for (const bill of bills) {
      for (const share of bill.shares) {
        for (const entry of share.collections) {
          if (entry.isReversal || entry.fromUserName) continue;
          rows.push({
            id: entry.id,
            billId: bill.id,
            billLabel: labels[bill.type] ?? bill.type,
            billDate: bill.date,
            memberName: share.userName,
            amount: entry.amount,
            isReversed: entry.isReversed,
            toUserName: entry.toUserName,
            fromAdvance: entry.fromAdvance,
            recordedByName: entry.recordedByName,
            recordedAt: entry.recordedAt
          });
        }
      }
    }
    return rows.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  }, [bills, labels]);

  if (entries.length === 0) return null;

  const pageCount = Math.max(1, Math.ceil(entries.length / HISTORY_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = entries.slice(currentPage * HISTORY_PAGE_SIZE, currentPage * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE);

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm sm:p-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h2 className="text-lg font-semibold">{strings.bills.paymentHistory.title}</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{strings.bills.paymentHistory.subtitle(entries.length)}</p>
        </div>
        <Chevron open={open} />
      </button>

      {open && (
        <>
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">
            {pageItems.map((entry) => (
              <li key={entry.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenBill(entry.billId)}
                    className="min-w-0 truncate text-left text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline"
                  >
                    {entry.memberName}
                    {entry.toUserName && <span className="font-normal text-slate-500 dark:text-slate-400"> → {entry.toUserName}</span>}
                  </button>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      entry.isReversed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {taka(entry.amount)}
                  </span>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span>{entry.billLabel}</span>
                  <span aria-hidden>·</span>
                  <span>{formatDayKey(entry.billDate, 'dayMonth')}</span>
                  {entry.recordedByName && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{strings.bills.ledger.recordedBy(entry.recordedByName)}</span>
                    </>
                  )}
                  {entry.fromAdvance && (
                    <span className="font-medium text-teal-700">{strings.bills.paymentHistory.fromAdvance}</span>
                  )}
                  {entry.isReversed && (
                    <span className="font-medium text-amber-600 dark:text-amber-400">{strings.bills.ledger.reversed}</span>
                  )}
                  {canManage && !entry.isReversed && (
                    <button
                      type="button"
                      onClick={() => onReverse(entry.billId, entry.id)}
                      className="text-rose-500 underline-offset-2 hover:underline"
                    >
                      {strings.bills.ledger.reverse}
                    </button>
                  )}
                </p>
              </li>
            ))}
          </ul>

          {pageCount > 1 && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-700 pt-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="min-h-[2.25rem] rounded-full border border-slate-200 dark:border-slate-700 px-3.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {strings.common.pager.previous}
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">{strings.common.pager.pageOf(currentPage + 1, pageCount)}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={currentPage === pageCount - 1}
                className="min-h-[2.25rem] rounded-full border border-slate-200 dark:border-slate-700 px-3.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {strings.common.pager.next}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type AdvanceMember = { id: string; name: string; balance: number };

type AdvanceHistoryEntry = {
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
  createdAt: string;
};

type AdvancesData = {
  canManage: boolean;
  currentUserId: string;
  members: AdvanceMember[];
  history: AdvanceHistoryEntry[];
};

const ADVANCE_HISTORY_PAGE_SIZE = 8;

function AdvancesSection({
  groupId,
  canManage,
  refreshToken
}: {
  groupId: string;
  canManage: boolean;
  refreshToken: number;
}) {
  const toast = useToast();
  const [data, setData] = useState<AdvancesData | null>(null);
  const [open, setOpen] = useState(true);
  const [collectFor, setCollectFor] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await fetch(`/api/groups/${groupId}/advances`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? strings.bills.advances.loadFailed);
      setData(body);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [groupId, toast]);

  useEffect(() => {
    load();
    // refreshToken bumps after actions elsewhere on the page (creating/deleting a
    // bill, reversing a payment) that can change advance balances behind the scenes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshToken]);

  async function submitCollect(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!collectFor || !Number.isFinite(value) || value <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/advances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: collectFor, amount: value, note: note.trim() || undefined })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? strings.bills.advances.recordFailed);
      toast.success(strings.bills.advances.recorded);
      setAmount('');
      setNote('');
      setCollectFor('');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function reverse(advanceId: string) {
    if (!window.confirm(strings.bills.advances.confirmReverse)) return;
    try {
      const res = await fetch(`/api/groups/${groupId}/advances?advanceId=${advanceId}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? strings.bills.advances.reverseFailed);
      toast.success(strings.bills.advances.reversedToast);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (!data) return null;

  const totalBalance = round2(data.members.reduce((sum, m) => sum + m.balance, 0));
  const pageCount = Math.max(1, Math.ceil(data.history.length / ADVANCE_HISTORY_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = data.history.slice(
    currentPage * ADVANCE_HISTORY_PAGE_SIZE,
    currentPage * ADVANCE_HISTORY_PAGE_SIZE + ADVANCE_HISTORY_PAGE_SIZE
  );

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm sm:p-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h2 className="text-lg font-semibold">{strings.bills.advances.title}</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {totalBalance > 0
              ? strings.bills.advances.balanceSummary(taka(totalBalance), data.members.length)
              : strings.bills.advances.noneYet}
          </p>
        </div>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">{strings.bills.advances.explanation}</p>

          <ul className="divide-y divide-slate-100 dark:divide-slate-700 rounded-2xl border border-slate-100 dark:border-slate-700">
            {data.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="truncate font-medium">
                  {m.name}
                  {m.id === data.currentUserId && (
                    <span className="ml-1 text-xs font-normal text-brand-700">{strings.common.you}</span>
                  )}
                </span>
                <span className={`shrink-0 font-semibold tabular-nums ${m.balance > 0 ? 'text-teal-700' : 'text-slate-300 dark:text-slate-600'}`}>
                  {taka(m.balance)}
                </span>
              </li>
            ))}
          </ul>

          {canManage && (
            <form onSubmit={submitCollect} className="flex flex-wrap items-end gap-2 rounded-2xl bg-slate-50 dark:bg-slate-900 p-3">
              <div className="min-w-[9rem] flex-1">
                <Listbox
                  label={strings.common.member}
                  value={collectFor}
                  onChange={setCollectFor}
                  placeholder={strings.bills.advances.selectMember}
                  options={data.members.map((m) => ({ value: m.id, label: m.name }))}
                />
              </div>
              <div className="w-28">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{strings.common.amount}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    required
                    className="mt-1 w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 outline-none focus:border-brand-500 focus:bg-white"
                  />
                </label>
              </div>
              <div className="min-w-[9rem] flex-1">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{strings.bills.advances.noteLabel}</span>
                  <input
                    type="text"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={strings.bills.advances.notePlaceholder}
                    className="mt-1 w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 outline-none focus:border-brand-500 focus:bg-white"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[2.75rem] rounded-2xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? strings.common.saving : strings.bills.advances.collectCta}
              </button>
            </form>
          )}

          {data.history.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {strings.bills.advances.historyTitle}
              </h3>
              <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-700">
                {pageItems.map((entry) => {
                  const isDeposit = !entry.expenseId && !entry.reversalOfId;
                  return (
                    <li key={entry.id} className="py-2.5 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate font-medium text-slate-900 dark:text-slate-100">
                          {entry.userName}
                          {entry.expenseId
                            ? ` ${strings.bills.advances.appliedToBill}`
                            : entry.reversalOfId
                              ? ` ${strings.bills.advances.reversalEntry}`
                              : ` ${strings.bills.advances.depositEntry}`}
                        </p>
                        <span
                          className={`shrink-0 text-sm font-semibold tabular-nums ${
                            entry.isReversed
                              ? 'text-slate-400 dark:text-slate-500 line-through'
                              : entry.amount < 0
                                ? 'text-slate-500 dark:text-slate-400'
                                : 'text-teal-700'
                          }`}
                        >
                          {entry.amount < 0 ? '−' : '+'}
                          {taka(Math.abs(entry.amount))}
                        </span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span>{formatInstant(entry.createdAt, 'dayMonthTime')}</span>
                        {entry.recordedByName && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{strings.bills.ledger.recordedBy(entry.recordedByName)}</span>
                          </>
                        )}
                        {entry.note && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{entry.note}</span>
                          </>
                        )}
                        {entry.isReversed && (
                          <span className="font-medium text-amber-600 dark:text-amber-400">{strings.bills.ledger.reversed}</span>
                        )}
                        {canManage && isDeposit && entry.amount > 0 && !entry.isReversed && (
                          <button
                            type="button"
                            onClick={() => reverse(entry.id)}
                            className="text-rose-500 underline-offset-2 hover:underline"
                          >
                            {strings.bills.ledger.reverse}
                          </button>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>

              {pageCount > 1 && (
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="min-h-[2.25rem] rounded-full border border-slate-200 dark:border-slate-700 px-3.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {strings.common.pager.previous}
                  </button>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {strings.common.pager.pageOf(currentPage + 1, pageCount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={currentPage === pageCount - 1}
                    className="min-h-[2.25rem] rounded-full border border-slate-200 dark:border-slate-700 px-3.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {strings.common.pager.next}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Breakdown({
  byType,
  labels,
  total
}: {
  byType: Record<string, number>;
  labels: Record<string, string>;
  total: number;
}) {
  const rows = Object.entries(byType)
    .map(([code, amount]) => ({ value: code, label: labels[code] ?? code, amount }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  if (rows.length === 0) return null;

  return (
    <div className="h-full rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">{strings.bills.costBreakdown}</h2>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          const percent = total > 0 ? Math.round((row.amount / total) * 100) : 0;
          return (
            <li key={row.value}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{row.label}</span>
                <span className="text-slate-600 dark:text-slate-400">
                  {taka(row.amount)} <span className="text-xs text-slate-400 dark:text-slate-500">({percent}%)</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
function AdvanceNote({ share }: { share: Share }) {
  if (share.advance <= 0) return null;
  return (
    <p className="mt-1 rounded-lg bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800">
      {strings.bills.advanceOverpaidNote(taka(share.advance))}
    </p>
  );
}

type RecipientOption = { id: string; name: string; advance: number };

function MemberActions({
  share,
  recipients,
  editing,
  amount,
  setAmount,
  toUserId,
  setToUserId,
  onStart,
  onCancel,
  onSubmit,
  compact
}: {
  share: Share;
  recipients: RecipientOption[];
  editing: boolean;
  amount: string;
  setAmount: (value: string) => void;
  toUserId: string;
  setToUserId: (value: string) => void;
  onStart: (prefillFull: boolean) => void;
  onCancel: () => void;
  onSubmit: () => void;
  compact?: boolean;
}) {
  const size = compact ? 'min-h-[2rem] px-3 text-xs' : 'min-h-[2.5rem] px-3.5 text-sm';

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          autoFocus
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSubmit();
            if (event.key === 'Escape') onCancel();
          }}
          placeholder={strings.common.amount}
          aria-label={strings.bills.transfer.amountFrom(share.userName)}
          className={`w-24 rounded-full border border-slate-300 dark:border-slate-600 ${size} focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100`}
        />
        <select
          value={toUserId}
          onChange={(event) => setToUserId(event.target.value)}
          aria-label={strings.bills.transfer.whoDidPay(share.userName)}
          className={`rounded-full border border-slate-300 dark:border-slate-600 ${size} focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100`}
        >
          <option value="">{strings.bills.transfer.intoCollection}</option>
          {recipients.map((recipient) => (
            <option key={recipient.id} value={recipient.id}>
              {strings.bills.transfer.paidTo(recipient.name)}
              {recipient.advance > 0 ? ` ${strings.bills.transfer.getsBack(taka(recipient.advance))}` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onSubmit}
          className={`rounded-full bg-brand-600 font-semibold text-white hover:bg-brand-700 ${size}`}
        >
          {strings.common.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`rounded-full border border-slate-200 dark:border-slate-700 font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 ${size}`}
        >
          {strings.common.cancel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {share.outstanding > 0 && (
        <button
          type="button"
          onClick={() => onStart(true)}
          className={`rounded-full bg-green-600 font-semibold text-white hover:bg-green-700 ${size}`}
        >
          {strings.bills.markPaid} · {taka(share.outstanding)}
        </button>
      )}
      <button
        type="button"
        onClick={() => onStart(false)}
        className={`rounded-full border border-slate-300 dark:border-slate-600 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 ${size}`}
      >
        {share.outstanding > 0 ? strings.bills.partPayment : strings.common.add}
      </button>
    </div>
  );
}

function SplitPanel({
  bill,
  members,
  currentUserId,
  canManage,
  canRecordOwn,
  onCollect
}: {
  bill: Bill;
  members: Member[];
  currentUserId: string;
  canManage: boolean;
  canRecordOwn: boolean;
  onCollect: (body: Record<string, unknown>) => void;
}) {
  const [editingFor, setEditingFor] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [toUserId, setToUserId] = useState('');

  const rows = useMemo(() => {
    const copy = [...bill.shares];
    copy.sort((a, b) => {
      if (a.userId === currentUserId) return -1;
      if (b.userId === currentUserId) return 1;
      if (a.outstanding !== b.outstanding) return b.outstanding - a.outstanding;
      return a.userName.localeCompare(b.userName);
    });
    return copy;
  }, [bill.shares, currentUserId]);

  const advanceByUser = useMemo(() => new Map(bill.shares.map((s) => [s.userId, s.advance])), [bill.shares]);

  const recipientsFor = useCallback(
    (userId: string): RecipientOption[] =>
      members
        .filter((m) => m.id !== userId)
        .map((m) => ({ id: m.id, name: m.name, advance: advanceByUser.get(m.id) ?? 0 }))
        .sort((a, b) => (a.advance !== b.advance ? b.advance - a.advance : a.name.localeCompare(b.name))),
    [members, advanceByUser]
  );

  const showActionsColumn = canManage || canRecordOwn;

  function canActFor(userId: string) {
    return canManage || (canRecordOwn && userId === currentUserId);
  }

  function start(userId: string, prefillFull: boolean) {
    setEditingFor(userId);
    const share = bill.shares.find((s) => s.userId === userId);
    setAmount(prefillFull && share ? String(share.outstanding) : '');
    setToUserId('');
  }

  function cancel() {
    setEditingFor(null);
    setAmount('');
    setToUserId('');
  }

  function submit(userId: string) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    onCollect({ userId, amount: value, ...(toUserId ? { toUserId } : {}) });
    cancel();
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">
                {strings.common.member}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                {strings.bills.colShare}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                {strings.bills.colPaid}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                {strings.bills.colDue}
              </th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                {strings.common.status}
              </th>
              {showActionsColumn && (
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  {strings.bills.colRecordPayment}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.map((share) => {
              const isMe = share.userId === currentUserId;
              return (
                <tr
                  key={share.userId}
                  className={
                    share.advance > 0
                      ? 'bg-teal-50/60'
                      : isMe
                        ? 'bg-brand-50/40'
                        : 'bg-white dark:bg-slate-800'
                  }
                >
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {share.userName}
                      {isMe && <span className="ml-1.5 text-xs font-normal text-brand-700">{strings.common.you}</span>}
                    </div>
                    <AdvanceNote share={share} />
                  </td>
                  <td className="px-3 py-3 text-right align-top tabular-nums text-slate-600 dark:text-slate-400">{taka(share.amount)}</td>
                  <td className="px-3 py-3 text-right align-top tabular-nums font-medium text-slate-900 dark:text-slate-100">
                    {share.paid > 0 ? taka(share.paid) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right align-top tabular-nums">
                    {share.outstanding > 0 ? (
                      <span className="font-semibold text-rose-600">{taka(share.outstanding)}</span>
                    ) : share.advance > 0 ? (
                      <span className="font-semibold text-teal-700">
                        +{taka(share.advance)}
                        <span className="block text-[10px] font-normal text-teal-600">{strings.bills.getsBackLabel}</span>
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <StatusPill entry={share} />
                  </td>
                  {showActionsColumn && (
                    <td className="px-4 py-3 align-top">
                      {canActFor(share.userId) && (
                        <div className="flex justify-end">
                          <MemberActions
                            compact
                            share={share}
                            recipients={recipientsFor(share.userId)}
                            editing={editingFor === share.userId}
                            amount={amount}
                            setAmount={setAmount}
                            toUserId={toUserId}
                            setToUserId={setToUserId}
                            onStart={(prefillFull) => start(share.userId, prefillFull)}
                            onCancel={cancel}
                            onSubmit={() => submit(share.userId)}
                          />
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-slate-100 dark:divide-slate-700 md:hidden">
        {rows.map((share) => {
          const isMe = share.userId === currentUserId;
          const progress =
            share.amount > 0 ? Math.min(100, Math.round((share.paid / share.amount) * 100)) : 100;

          return (
            <li
              key={share.userId}
              className={`p-3.5 ${
                share.advance > 0
                  ? 'border-l-4 border-teal-400 bg-teal-50/60'
                  : isMe
                    ? 'bg-brand-50/50'
                    : 'bg-white dark:bg-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                    {share.userName}
                    {isMe && <span className="ml-1.5 text-xs font-normal text-brand-700">(you)</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {strings.bills.sharePaid(taka(share.amount), taka(share.paid))}
                  </p>
                </div>
                <StatusPill entry={share} />
              </div>

              <div className="mt-2.5 flex items-center gap-2.5">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className={`h-full rounded-full ${share.outstanding > 0 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {share.outstanding > 0 ? (
                  <span className="shrink-0 text-sm font-bold tabular-nums text-rose-600">
                    {strings.bills.dueSuffix(taka(share.outstanding))}
                  </span>
                ) : share.advance > 0 ? (
                  <span className="shrink-0 text-sm font-bold tabular-nums text-teal-700">
                    +{strings.bills.backSuffix(taka(share.advance))}
                  </span>
                ) : (
                  <span className="shrink-0 text-sm font-semibold text-green-700 dark:text-green-400">{strings.bills.settled}</span>
                )}
              </div>

              <AdvanceNote share={share} />

              {canActFor(share.userId) && (
                <div className="mt-2.5">
                  <MemberActions
                    share={share}
                    recipients={recipientsFor(share.userId)}
                    editing={editingFor === share.userId}
                    amount={amount}
                    setAmount={setAmount}
                    toUserId={toUserId}
                    setToUserId={setToUserId}
                    onStart={(prefillFull) => start(share.userId, prefillFull)}
                    onCancel={cancel}
                    onSubmit={() => submit(share.userId)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BillRow({
  bill,
  members,
  currentUserId,
  canManage,
  canRecordOwn,
  isOpen,
  onToggleOpen,
  onEdit,
  onToggle,
  onDelete,
  onCollect
}: {
  bill: Bill;
  members: Member[];
  currentUserId: string;
  canManage: boolean;
  canRecordOwn: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onCollect: (body: Record<string, unknown>) => void;
}) {
  const myShare = bill.shares.find((s) => s.userId === currentUserId);
  const percent = bill.amount > 0 ? Math.min(100, Math.round((bill.collected / bill.amount) * 100)) : 0;

  return (
    <li
      id={`bill-${bill.id}`}
      className={`scroll-mt-24 rounded-2xl border p-3.5 transition-colors sm:p-4 ${
        isOpen ? 'border-brand-300 bg-white dark:bg-slate-800 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="font-semibold">{longDate(bill.date)}</h5>
            <span
              title={strings.bills.vendorPaidTooltip}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                bill.isReceived ? 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
              }`}
            >
              {bill.isReceived ? strings.bills.vendorPaid : strings.bills.vendorUnpaid}
            </span>
          </div>
          {bill.payer && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{strings.bills.paidByName(bill.payer.name)}</p>}
          {bill.note && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{bill.note}</p>}
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">{taka(bill.amount)}</p>
          {myShare && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {strings.bills.yourShareOf(taka(myShare.amount))}
              {myShare.outstanding > 0 ? (
                <span className="ml-1 font-semibold text-rose-600">· {strings.bills.dueSuffix(taka(myShare.outstanding))}</span>
              ) : (
                <span className="ml-1 font-semibold text-green-600 dark:text-green-400">{strings.bills.paidDot}</span>
              )}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        className="mt-3 w-full rounded-xl bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
          <span className="text-slate-600 dark:text-slate-400">
            {strings.bills.collectedLabel} <span className="font-semibold text-slate-900 dark:text-slate-100">{taka(bill.collected)}</span> {strings.bills.ofLabel}{' '}
            {taka(bill.amount)}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {bill.unpaidMemberCount > 0 ? (
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {bill.unpaidMemberCount} {strings.bills.memberOwes(bill.unpaidMemberCount)}{' '}
                {taka(bill.uncollected)}
              </span>
            ) : (
              <span className="font-semibold text-green-600 dark:text-green-400">{strings.bills.everyonePaid}</span>
            )}
            {bill.advance > 0 && (
              <span className="rounded-full bg-teal-100 px-2 py-0.5 font-semibold text-teal-800">
                {strings.bills.advanceBack(taka(bill.advance))}
              </span>
            )}
            <span className="text-slate-500 dark:text-slate-400">
              {isOpen ? strings.bills.hideSplit(bill.shares.length) : strings.bills.showSplit(bill.shares.length)} {isOpen ? '▲' : '▼'}
            </span>
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={`h-full rounded-full transition-all ${bill.isFullyCollected ? 'bg-green-500' : 'bg-brand-600'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </button>

      {isOpen && (
        <>
          <SplitPanel
            bill={bill}
            members={members}
            currentUserId={currentUserId}
            canManage={canManage}
            canRecordOwn={canRecordOwn}
            onCollect={onCollect}
          />

          {canManage && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-700 pt-3">
              <button
                type="button"
                onClick={onToggle}
                className="rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                {strings.bills.markVendor(bill.isReceived)}
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                {strings.common.edit}
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-full border border-red-200 dark:border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50"
              >
                {strings.common.delete}
              </button>
              <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                {strings.bills.collectionsNote}
              </span>
            </div>
          )}
        </>
      )}
    </li>
  );
}

function useBillForm(initial: Bill | undefined, members: Member[], categories: Category[]) {
  const [type, setType] = useState(initial?.type ?? categories[0]?.code ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [date, setDate] = useState(initial?.date ?? todayKey());
  const [note, setNote] = useState(initial?.note ?? '');
  const [splitMethod, setSplitMethod] = useState(initial?.splitMethod ?? SPLIT_METHODS.EQUAL);
  const [isReceived, setIsReceived] = useState(initial?.isReceived ?? true);
  const [payerId, setPayerId] = useState(initial?.payer?.id ?? '');
  const [custom, setCustom] = useState<Record<string, string>>(() => {
    if (initial?.splitMethod !== SPLIT_METHODS.CUSTOM) return {};
    return Object.fromEntries(initial.shares.map((s) => [s.userId, String(s.amount)]));
  });

  const customTotal = useMemo(
    () => Object.values(custom).reduce((sum, value) => sum + (Number(value) || 0), 0),
    [custom]
  );

  function spreadEvenly() {
    const selected = Object.keys(custom);
    const total = Number(amount);
    if (selected.length === 0 || !Number.isFinite(total) || total <= 0) return;

    const paisa = Math.round(total * 100);
    const base = Math.floor(paisa / selected.length);
    let remainder = paisa - base * selected.length;

    setCustom(
      Object.fromEntries(
        selected.map((userId) => {
          const extra = remainder > 0 ? 1 : 0;
          remainder -= extra;
          return [userId, ((base + extra) / 100).toFixed(2)];
        })
      )
    );
  }

  function toggleMember(userId: string) {
    setCustom((current) => {
      const next = { ...current };
      if (userId in next) delete next[userId];
      else next[userId] = '';
      return next;
    });
  }

  const body = () => ({
    type,
    amount: Number(amount),
    date,
    note,
    splitMethod,
    isReceived,
    payerId: payerId || null,
    shares:
      splitMethod === SPLIT_METHODS.CUSTOM
        ? Object.entries(custom).map(([userId, value]) => ({ userId, amount: Number(value) || 0 }))
        : undefined
  });

  const fields = (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Listbox
          className="block"
          label={strings.bills.costTypeLabel}
          value={type}
          onChange={setType}
          options={[
            ...(initial && !categories.some((c) => c.code === initial.type)
              ? [{ value: initial.type, label: strings.bills.retiredSuffix(initial.type) }]
              : []),
            ...categories.map((category) => ({ value: category.code, label: category.label }))
          ]}
        />

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{strings.bills.amountLabel}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="mt-1 w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 outline-none focus:border-brand-500 focus:bg-white"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{strings.common.date}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 outline-none focus:border-brand-500 focus:bg-white"
          />
        </label>

        <Listbox
          className="block"
          label={strings.bills.paidBy}
          value={payerId}
          onChange={setPayerId}
          placeholder={strings.bills.notRecorded}
          options={[{ value: '', label: strings.bills.notRecorded }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
        />
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{strings.common.note}</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={strings.bills.notePlaceholder}
          className="mt-1 w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 outline-none focus:border-brand-500 focus:bg-white"
        />
      </label>

      <fieldset className="mt-4">
        <legend className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{strings.bills.howShared}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {[SPLIT_METHODS.EQUAL, SPLIT_METHODS.CUSTOM].map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setSplitMethod(method)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                splitMethod === method
                  ? 'bg-brand-600 font-medium text-white'
                  : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {SPLIT_METHOD_LABELS[method]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {splitMethod === SPLIT_METHODS.EQUAL ? strings.bills.equalHint : strings.bills.customHint}
        </p>
      </fieldset>

      {splitMethod === SPLIT_METHODS.CUSTOM && (
        <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{strings.bills.assignToMembers}</span>
            <button
              type="button"
              onClick={spreadEvenly}
              className="inline-flex min-h-[2rem] items-center rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              {strings.bills.splitEvenlySelected}
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {members.map((m) => {
              const selected = m.id in custom;
              return (
                <li key={m.id} className="flex items-center gap-3">
                  <input
                    id={`share-${m.id}`}
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleMember(m.id)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                  />
                  <label htmlFor={`share-${m.id}`} className="flex-1 text-sm">
                    {m.name}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={custom[m.id] ?? ''}
                    disabled={!selected}
                    onChange={(e) => setCustom((c) => ({ ...c, [m.id]: e.target.value }))}
                    className="w-28 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-right text-sm disabled:opacity-40"
                  />
                </li>
              );
            })}
          </ul>
          <p
            className={`mt-3 border-t border-slate-100 dark:border-slate-700 pt-2 text-sm ${
              Math.abs(customTotal - (Number(amount) || 0)) > 0.01 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'
            }`}
          >
            {strings.bills.assignedOf(taka(customTotal), taka(Number(amount) || 0))}
          </p>
        </div>
      )}

      <label className="mt-4 flex items-center gap-3">
        <input
          type="checkbox"
          checked={isReceived}
          onChange={(e) => setIsReceived(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
        />
        <span className="text-sm">{strings.bills.alreadyPaid}</span>
      </label>
    </>
  );

  return { fields, body };
}

function CategoryManager({
  groupId,
  categories,
  onChanged
}: {
  groupId: string;
  categories: Category[];
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(true);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!label.trim()) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? strings.bills.addCostTypeFailed);
      toast.success(strings.bills.costTypeAdded(data.category.label));
      setLabel('');
      await onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(category: Category) {
    const message =
      category.inUse > 0
        ? strings.bills.removeCostTypeConfirmInUse(category.label, category.inUse)
        : strings.bills.removeCostTypeConfirm(category.label);
    if (!window.confirm(message)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/expense-categories/${category.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? strings.bills.removeCostTypeFailed);
      toast.success(data.archived ? strings.bills.costTypeHidden(category.label) : strings.bills.costTypeRemoved(category.label));
      await onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rename(category: Category) {
    const next = window.prompt(strings.bills.renamePrompt, category.label);
    if (next === null || next.trim() === category.label) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/expense-categories/${category.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: next })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? strings.bills.renameCostTypeFailed);
      toast.success(strings.bills.renamed);
      await onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="flex h-full w-full items-center justify-between gap-3 rounded-3xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-5 py-3 text-left text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        {strings.bills.manageCostTypes(categories.length)}
        <Chevron open={false} />
      </button>
    );
  }

  return (
    <div className="h-full rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{strings.bills.costTypesTitle}</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          {strings.bills.done}
        </button>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 py-1 pl-3 pr-1.5 text-sm"
          >
            <span className="font-medium">{category.label}</span>
            {category.inUse > 0 && <span className="text-xs text-slate-400 dark:text-slate-500">{category.inUse}</span>}
            <button
              type="button"
              onClick={() => rename(category)}
              disabled={busy}
              aria-label={strings.bills.renameAria(category.label)}
              className="rounded-full px-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-50"
            >
              {strings.bills.costTypeEdit}
            </button>
            <button
              type="button"
              onClick={() => remove(category)}
              disabled={busy}
              aria-label={strings.bills.removeAria(category.label)}
              className="rounded-full bg-white dark:bg-slate-800 px-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 disabled:opacity-50"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="mt-4 flex flex-wrap gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={40}
          placeholder={strings.bills.addCostTypePlaceholder}
          className="min-w-0 flex-1 rounded-full border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-4 py-2 text-sm outline-none focus:border-brand-500 focus:bg-white"
        />
        <button
          type="submit"
          disabled={busy || !label.trim()}
          className="rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-5 py-2 text-sm text-white hover:bg-brand-700 transition-all active:translate-y-px disabled:opacity-50"
        >
          {strings.common.add}
        </button>
      </form>
    </div>
  );
}

function AddBillForm({
  groupId,
  members,
  categories,
  month,
  onSaved
}: {
  groupId: string;
  members: Member[];
  categories: Category[];
  month: string;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { fields, body } = useBillForm(undefined, members, categories);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body())
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? strings.bills.recordFailed);
      toast.success(strings.bills.billRecorded);
      setOpen(false);
      await onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="flex w-full items-center justify-between gap-3 rounded-3xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-5 py-4 text-left hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        <span>
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">{strings.bills.recordCta}</span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{strings.bills.recordCollapsedHint}</span>
        </span>
        <Chevron open={false} />
      </button>
    );
  }

  return (
    <form
      key={`${groupId}-${month}`}
      onSubmit={submit}
      className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6"
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-expanded
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h2 className="text-lg font-semibold">{strings.bills.record}</h2>
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          {strings.bills.recordOpen}
          <Chevron open />
        </span>
      </button>
      {fields}
      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-5 py-2.5 text-sm text-white hover:bg-brand-700 transition-all active:translate-y-px disabled:opacity-50"
        >
          {saving ? strings.common.saving : strings.common.save}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          {strings.common.cancel}
        </button>
      </div>
    </form>
  );
}

function BillChangeHistory({ groupId, billId }: { groupId: string; billId: string }) {
  const toast = useToast();
  const [history, setHistory] = useState<HistoryEvent[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/groups/${groupId}/expense-history?expenseId=${billId}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? strings.history.failed);
        if (!cancelled) setHistory(body.history ?? []);
      } catch (err) {
        if (!cancelled) {
          toast.error((err as Error).message);
          setHistory([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, billId, toast]);

  return (
    <div className="mt-5 border-t border-slate-100 dark:border-slate-700 pt-4">
      <h4 className="text-sm font-semibold">{strings.history.title}</h4>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{strings.history.subtitleBill}</p>
      {loading ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{strings.history.loading}</p>
      ) : (
        <HistoryList history={history ?? []} fallbackLabel={strings.bills.label} />
      )}
    </div>
  );
}

function EditBill({
  bill,
  groupId,
  members,
  categories,
  onCancel,
  onSaved
}: {
  bill: Bill;
  groupId: string;
  members: Member[];
  categories: Category[];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const { fields, body } = useBillForm(bill, members, categories);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/bills/${bill.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body())
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? strings.bills.updateFailed);
      toast.success(strings.bills.billUpdated);
      await onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-2xl border border-brand-600 p-4">
      <form onSubmit={submit}>
        <h3 className="font-semibold">{strings.bills.edit}</h3>
        {fields}
        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-5 py-2.5 text-sm text-white hover:bg-brand-700 transition-all active:translate-y-px disabled:opacity-50"
          >
            {saving ? strings.common.saving : strings.common.saveChanges}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {strings.common.cancel}
          </button>
        </div>
      </form>
      <BillChangeHistory groupId={groupId} billId={bill.id} />
    </li>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">{children}</div>;
}
