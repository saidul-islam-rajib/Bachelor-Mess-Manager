import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import { GroupMonthControls, useGroupMonth } from '@/components/GroupMonthControls';
import { Listbox, PageTitle } from '@/components/ui';
import { SPLIT_METHODS, SPLIT_METHOD_LABELS } from '@/lib/constants';
import { todayKey } from '@/lib/month';
import { formatCurrency, formatDayKey, formatInstant } from '@/lib/format';

type Collection = {
  id: string;
  amount: number;
  date: string;
  recordedAt: string;
  recordedByName: string | null;
  isReversal: boolean;
  isReversed: boolean;
};

type Share = {
  userId: string;
  userName: string;
  amount: number;
  paid: number;
  outstanding: number;
  advance: number;
  status: string;
  collections: Collection[];
};

type Member = { id: string; name: string; email: string };

type Bill = {
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

type Category = {
  id: string;
  code: string;
  label: string;
  isSystem: boolean;
  sortOrder: number;
  archived: boolean;
  inUse: number;
};

type BillsData = {
  canManage: boolean;
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

const taka = formatCurrency;

function longDate(day: string) {
  return formatDayKey(day, 'full');
}

export default function BillsPage() {
  const { user } = useCurrentUser();
  const toast = useToast();
  const { groups, groupId, setGroupId, month, setMonth, loadingGroups } = useGroupMonth();

  const [data, setData] = useState<BillsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);

  const toggleExpanded = useCallback((billId: string) => {
    setExpanded((current) =>
      current.includes(billId) ? current.filter((id) => id !== billId) : [...current, billId]
    );
  }, []);

  const collapse = useCallback((billId: string) => {
    setExpanded((current) => current.filter((id) => id !== billId));
  }, []);

  const load = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!groupId) return;
      if (!quiet) setLoading(true);
      try {
        const res = await fetch(`/api/groups/${groupId}/bills?month=${month}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? 'Could not load bills.');
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
      if (!res.ok) throw new Error(body?.error ?? 'Could not update the bill.');
      toast.success(bill.isReceived ? 'Marked as unpaid.' : 'Marked as paid.');
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
      if (!res.ok) throw new Error(payload?.error ?? 'Could not record that payment.');
      toast.success('Payment recorded.');
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function reverseCollection(bill: Bill, collectionId: string) {
    if (
      !window.confirm(
        'Reverse this entry?\n\nThe original stays in the history and a matching correction is added beside it. Nothing is erased.'
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/bills/${bill.id}/collections?collectionId=${collectionId}`, {
        method: 'DELETE'
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? 'Could not reverse that entry.');
      toast.success('Entry reversed. The original is kept in the history.');
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(bill: Bill) {
    const label = data?.categoryLabels[bill.type] ?? bill.type;
    if (!window.confirm(`Delete this ${label} bill of ${taka(bill.amount)}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/bills/${bill.id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not delete the bill.');
      toast.success('Bill deleted.');
      collapse(bill.id);
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const canManage = data?.canManage ?? false;
  const myShare = data ? (data.totals.byMember[user?.id ?? ''] ?? 0) : 0;
  const myDue = data ? (data.totals.dueByMember[user?.id ?? ''] ?? 0) : 0;

  return (
    <section className="mx-auto max-w-content px-4 py-8 sm:py-10">
      <PageTitle title="Bills & fixed costs" />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Bills &amp; fixed costs</h1>
        <p className="mt-1 text-slate-600">
          Rent, electricity, water, waste, chef, Wi-Fi and anything else that is not day-to-day bazar.
        </p>
      </div>

      {loadingGroups ? (
        <Card>Loading...</Card>
      ) : groups.length === 0 ? (
        <Card>You&apos;re not part of any group yet.</Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <GroupMonthControls groups={groups} groupId={groupId} setGroupId={setGroupId} month={month} setMonth={setMonth} />
          </Card>

          {loading || !data ? (
            <Card>Loading bills...</Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <Stat label="Total bills" value={taka(data.totals.total)} />
                <Stat label="Collected" value={taka(data.totals.collected)} tone="green" />
                <Stat label="Still owed" value={taka(data.totals.uncollected)} tone="red" />
                <Stat
                  label={myDue > 0 ? 'Your share · due' : 'Your share'}
                  value={myDue > 0 ? `${taka(myShare)} · ${taka(myDue)}` : taka(myShare)}
                  tone={myDue > 0 ? 'red' : undefined}
                />
              </div>

              <Breakdown byType={data.totals.byType} labels={data.categoryLabels} total={data.totals.total} />

              {canManage && (
                <>
                  <CategoryManager groupId={groupId} categories={data.categories} onChanged={refresh} />
                  <AddBillForm
                    groupId={groupId}
                    members={data.members}
                    categories={data.categories}
                    month={month}
                    onSaved={refresh}
                  />
                </>
              )}

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold">Bills this month</h2>
                  <p className="text-sm text-slate-500">{data.bills.length} recorded</p>
                </div>

                {data.bills.length === 0 ? (
                  <p className="mt-4 text-slate-500">
                    No bills recorded for this month{canManage ? ' yet — add one above.' : '.'}
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {data.bills.map((bill) =>
                      editing === bill.id ? (
                        <EditBill
                          key={bill.id}
                          bill={bill}
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
                          label={data.categoryLabels[bill.type] ?? bill.type}
                          currentUserId={data.currentUserId}
                          canManage={canManage}
                          isOpen={expanded.includes(bill.id)}
                          onToggleOpen={() => toggleExpanded(bill.id)}
                          onClose={() => collapse(bill.id)}
                          onEdit={() => setEditing(bill.id)}
                          onToggle={() => toggleSettled(bill)}
                          onDelete={() => remove(bill)}
                          onCollect={(body) => recordCollection(bill, body)}
                          onReverseCollection={(collectionId) => reverseCollection(bill, collectionId)}
                        />
                      )
                    )}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Cost breakdown</h2>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          const percent = total > 0 ? Math.round((row.amount / total) * 100) : 0;
          return (
            <li key={row.value}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{row.label}</span>
                <span className="text-slate-600">
                  {taka(row.amount)} <span className="text-xs text-slate-400">({percent}%)</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
const STATUS_STYLES: Record<string, { pill: string; label: string; dot: string }> = {
  PAID: { pill: 'bg-green-100 text-green-800', label: 'Paid', dot: 'bg-green-500' },
  PARTIAL: { pill: 'bg-amber-100 text-amber-800', label: 'Part paid', dot: 'bg-amber-500' },
  PENDING: { pill: 'bg-rose-100 text-rose-800', label: 'Due', dot: 'bg-rose-500' }
};

function statusOf(share: Share) {
  return STATUS_STYLES[share.status] ?? STATUS_STYLES.PENDING;
}

function StatusPill({ share }: { share: Share }) {
  const style = statusOf(share);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}

function CollectionHistory({
  share,
  canManage,
  onReverse
}: {
  share: Share;
  canManage: boolean;
  onReverse: (collectionId: string) => void;
}) {
  if (share.collections.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1 border-l-2 border-slate-200 pl-3">
      {share.collections.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span
            className={
              entry.isReversal
                ? 'font-medium text-rose-600'
                : entry.isReversed
                  ? 'text-slate-400 line-through'
                  : 'font-medium text-slate-700'
            }
          >
            {entry.isReversal ? '−' : ''}
            {taka(Math.abs(entry.amount))}
          </span>
          <span className="text-slate-400">
            {entry.isReversal ? 'correction' : formatDayKey(entry.date, 'dayMonth')}
          </span>
          {entry.recordedByName && <span className="text-slate-400">· by {entry.recordedByName}</span>}
          <span className="text-slate-300" title={formatInstant(entry.recordedAt, 'dateTime')}>
            · {formatInstant(entry.recordedAt, 'dayMonthTime')}
          </span>
          {entry.isReversed && <span className="text-slate-400">· reversed</span>}
          {canManage && !entry.isReversal && !entry.isReversed && (
            <button
              type="button"
              onClick={() => onReverse(entry.id)}
              className="rounded px-1 text-rose-500 underline-offset-2 hover:underline"
            >
              reverse
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function MemberActions({
  share,
  editing,
  amount,
  setAmount,
  onStart,
  onCancel,
  onSubmit,
  onSettle,
  compact
}: {
  share: Share;
  editing: boolean;
  amount: string;
  setAmount: (value: string) => void;
  onStart: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  onSettle: () => void;
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
          placeholder="Amount"
          aria-label={`Amount received from ${share.userName}`}
          className={`w-28 rounded-full border border-slate-300 ${size} focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100`}
        />
        <button
          type="button"
          onClick={onSubmit}
          className={`rounded-full bg-brand-600 font-semibold text-white hover:bg-brand-700 ${size}`}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`rounded-full border border-slate-200 font-medium text-slate-600 hover:bg-slate-100 ${size}`}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {share.outstanding > 0 && (
        <button
          type="button"
          onClick={onSettle}
          className={`rounded-full bg-green-600 font-semibold text-white hover:bg-green-700 ${size}`}
        >
          Mark paid · {taka(share.outstanding)}
        </button>
      )}
      <button
        type="button"
        onClick={onStart}
        className={`rounded-full border border-slate-300 font-medium text-slate-700 hover:bg-slate-50 ${size}`}
      >
        {share.outstanding > 0 ? 'Part' : 'Add'}
      </button>
    </div>
  );
}

function SplitPanel({
  bill,
  currentUserId,
  canManage,
  onCollect,
  onReverseCollection
}: {
  bill: Bill;
  currentUserId: string;
  canManage: boolean;
  onCollect: (body: Record<string, unknown>) => void;
  onReverseCollection: (collectionId: string) => void;
}) {
  const [editingFor, setEditingFor] = useState<string | null>(null);
  const [amount, setAmount] = useState('');

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

  function start(userId: string) {
    setEditingFor(userId);
    setAmount('');
  }

  function cancel() {
    setEditingFor(null);
    setAmount('');
  }

  function submit(userId: string) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    onCollect({ userId, amount: value });
    cancel();
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">
                Member
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Share
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Paid
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Due
              </th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                Status
              </th>
              {canManage && (
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  Record payment
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((share) => {
              const isMe = share.userId === currentUserId;
              return (
                <tr key={share.userId} className={isMe ? 'bg-brand-50/40' : 'bg-white'}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-slate-900">
                      {share.userName}
                      {isMe && <span className="ml-1.5 text-xs font-normal text-brand-700">(you)</span>}
                    </div>
                    {share.advance > 0 && (
                      <p className="mt-0.5 text-xs text-blue-600">
                        Covered {taka(share.advance)} for others — refunded at settlement
                      </p>
                    )}
                    <CollectionHistory share={share} canManage={canManage} onReverse={onReverseCollection} />
                  </td>
                  <td className="px-3 py-3 text-right align-top tabular-nums text-slate-600">{taka(share.amount)}</td>
                  <td className="px-3 py-3 text-right align-top tabular-nums font-medium text-slate-900">
                    {share.paid > 0 ? taka(share.paid) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right align-top tabular-nums">
                    {share.outstanding > 0 ? (
                      <span className="font-semibold text-rose-600">{taka(share.outstanding)}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <StatusPill share={share} />
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 align-top">
                      <div className="flex justify-end">
                        <MemberActions
                          compact
                          share={share}
                          editing={editingFor === share.userId}
                          amount={amount}
                          setAmount={setAmount}
                          onStart={() => start(share.userId)}
                          onCancel={cancel}
                          onSubmit={() => submit(share.userId)}
                          onSettle={() => onCollect({ userId: share.userId, settle: true })}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((share) => {
          const isMe = share.userId === currentUserId;
          const progress =
            share.amount > 0 ? Math.min(100, Math.round((share.paid / share.amount) * 100)) : 100;

          return (
            <li key={share.userId} className={`p-3.5 ${isMe ? 'bg-brand-50/50' : 'bg-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {share.userName}
                    {isMe && <span className="ml-1.5 text-xs font-normal text-brand-700">(you)</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Share {taka(share.amount)} · paid {taka(share.paid)}
                  </p>
                </div>
                <StatusPill share={share} />
              </div>

              <div className="mt-2.5 flex items-center gap-2.5">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${share.outstanding > 0 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {share.outstanding > 0 ? (
                  <span className="shrink-0 text-sm font-bold tabular-nums text-rose-600">
                    {taka(share.outstanding)} due
                  </span>
                ) : (
                  <span className="shrink-0 text-sm font-semibold text-green-700">Settled</span>
                )}
              </div>

              {share.advance > 0 && (
                <p className="mt-1.5 text-xs text-blue-600">
                  Covered {taka(share.advance)} for others — refunded at settlement
                </p>
              )}

              <CollectionHistory share={share} canManage={canManage} onReverse={onReverseCollection} />

              {canManage && (
                <div className="mt-2.5">
                  <MemberActions
                    share={share}
                    editing={editingFor === share.userId}
                    amount={amount}
                    setAmount={setAmount}
                    onStart={() => start(share.userId)}
                    onCancel={cancel}
                    onSubmit={() => submit(share.userId)}
                    onSettle={() => onCollect({ userId: share.userId, settle: true })}
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
  label,
  currentUserId,
  canManage,
  isOpen,
  onToggleOpen,
  onClose,
  onEdit,
  onToggle,
  onDelete,
  onCollect,
  onReverseCollection
}: {
  bill: Bill;
  label: string;
  currentUserId: string;
  canManage: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onCollect: (body: Record<string, unknown>) => void;
  onReverseCollection: (collectionId: string) => void;
}) {
  const containerRef = useRef<HTMLLIElement>(null);
  const myShare = bill.shares.find((s) => s.userId === currentUserId);
  const percent = bill.amount > 0 ? Math.min(100, Math.round((bill.collected / bill.amount) * 100)) : 0;

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const node = containerRef.current;
      if (node && !node.contains(event.target as Node)) onClose();
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <li
      ref={containerRef}
      className={`rounded-2xl border p-4 transition-colors ${
        isOpen ? 'border-brand-300 bg-white shadow-sm' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{label}</h3>
            <span
              title="Whether the bill itself has been settled with the landlord, shop or utility — separate from which members have chipped in."
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                bill.isReceived ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {bill.isReceived ? 'Vendor paid' : 'Vendor unpaid'}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {SPLIT_METHOD_LABELS[bill.splitMethod] ?? bill.splitMethod}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {longDate(bill.date)}
            {bill.payer && ` · paid by ${bill.payer.name}`}
          </p>
          {bill.note && <p className="mt-1 text-sm text-slate-600">{bill.note}</p>}
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">{taka(bill.amount)}</p>
          {myShare && (
            <p className="text-xs text-slate-500">
              your share {taka(myShare.amount)}
              {myShare.outstanding > 0 ? (
                <span className="ml-1 font-semibold text-rose-600">· {taka(myShare.outstanding)} due</span>
              ) : (
                <span className="ml-1 font-semibold text-green-600">· paid</span>
              )}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        className="mt-3 w-full rounded-xl bg-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
          <span className="text-slate-600">
            Collected <span className="font-semibold text-slate-900">{taka(bill.collected)}</span> of{' '}
            {taka(bill.amount)}
          </span>
          <span className="flex items-center gap-2">
            {bill.unpaidMemberCount > 0 ? (
              <span className="font-semibold text-amber-600">
                {bill.unpaidMemberCount} {bill.unpaidMemberCount === 1 ? 'member owes' : 'members owe'}{' '}
                {taka(bill.uncollected)}
              </span>
            ) : (
              <span className="font-semibold text-green-600">Everyone has paid</span>
            )}
            <span className="text-slate-500">
              {isOpen ? 'Hide' : 'Show'} split ({bill.shares.length}) {isOpen ? '▲' : '▼'}
            </span>
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
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
            currentUserId={currentUserId}
            canManage={canManage}
            onCollect={onCollect}
            onReverseCollection={onReverseCollection}
          />

          {canManage && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={onToggle}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Mark vendor {bill.isReceived ? 'unpaid' : 'paid'}
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
              <span className="ml-auto text-xs text-slate-400">
                Payment entries cannot be edited or deleted — only reversed.
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
  const [isReceived, setIsReceived] = useState(initial?.isReceived ?? false);
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
          label="Cost type"
          value={type}
          onChange={setType}
          options={[
            ...(initial && !categories.some((c) => c.code === initial.type)
              ? [{ value: initial.type, label: `${initial.type} (retired)` }]
              : []),
            ...categories.map((category) => ({ value: category.code, label: category.label }))
          ]}
        />

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Amount (৳)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 outline-none focus:border-brand-500 focus:bg-white"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 outline-none focus:border-brand-500 focus:bg-white"
          />
        </label>

        <Listbox
          className="block"
          label="Paid by"
          value={payerId}
          onChange={setPayerId}
          placeholder="Not recorded"
          options={[{ value: '', label: 'Not recorded' }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
        />
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Note</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="July electricity, meter reading 4821"
          className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 outline-none focus:border-brand-500 focus:bg-white"
        />
      </label>

      <fieldset className="mt-4">
        <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">How is this shared?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {[SPLIT_METHODS.EQUAL, SPLIT_METHODS.CUSTOM].map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setSplitMethod(method)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                splitMethod === method
                  ? 'bg-brand-600 font-medium text-white'
                  : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {SPLIT_METHOD_LABELS[method]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {splitMethod === SPLIT_METHODS.EQUAL
            ? 'Divided evenly across every active member of the group.'
            : 'Pick the members this cost belongs to and set each amount.'}
        </p>
      </fieldset>

      {splitMethod === SPLIT_METHODS.CUSTOM && (
        <div className="mt-3 rounded-2xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Assign to members</span>
            <button
              type="button"
              onClick={spreadEvenly}
              className="inline-flex min-h-[2rem] items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Split evenly between selected
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
                    className="h-4 w-4 rounded border-slate-300"
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
                    className="w-28 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-right text-sm disabled:opacity-40"
                  />
                </li>
              );
            })}
          </ul>
          <p
            className={`mt-3 border-t border-slate-100 pt-2 text-sm ${
              Math.abs(customTotal - (Number(amount) || 0)) > 0.01 ? 'text-red-600' : 'text-green-700'
            }`}
          >
            Assigned {taka(customTotal)} of {taka(Number(amount) || 0)}
          </p>
        </div>
      )}

      <label className="mt-4 flex items-center gap-3">
        <input
          type="checkbox"
          checked={isReceived}
          onChange={(e) => setIsReceived(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        <span className="text-sm">Already paid to the landlord / provider</span>
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
  const [open, setOpen] = useState(false);
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
      if (!res.ok) throw new Error(data?.error ?? 'Could not add that cost type.');
      toast.success(`"${data.category.label}" added.`);
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
        ? `"${category.label}" is used by ${category.inUse} bill${category.inUse === 1 ? '' : 's'}. It will be hidden from the dropdown but those bills keep their label. Continue?`
        : `Remove "${category.label}" from the cost type list?`;
    if (!window.confirm(message)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/expense-categories/${category.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not remove that cost type.');
      toast.success(data.archived ? `"${category.label}" hidden from new bills.` : `"${category.label}" removed.`);
      await onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rename(category: Category) {
    const next = window.prompt('Rename this cost type', category.label);
    if (next === null || next.trim() === category.label) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/expense-categories/${category.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: next })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not rename that cost type.');
      toast.success('Renamed.');
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
        className="w-full rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50"
      >
        Manage cost types ({categories.length})
      </button>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Cost types</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          Done
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        These are the options in the &quot;Record a bill&quot; dropdown for this mess. A type already used by a bill is
        hidden rather than deleted, so past bills keep their label.
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-sm"
          >
            <span className="font-medium">{category.label}</span>
            {category.inUse > 0 && <span className="text-xs text-slate-400">{category.inUse}</span>}
            <button
              type="button"
              onClick={() => rename(category)}
              disabled={busy}
              aria-label={`Rename ${category.label}`}
              className="rounded-full px-1.5 text-xs text-slate-500 hover:text-slate-900 disabled:opacity-50"
            >
              edit
            </button>
            <button
              type="button"
              onClick={() => remove(category)}
              disabled={busy}
              aria-label={`Remove ${category.label}`}
              className="rounded-full bg-white px-1.5 text-slate-400 hover:text-red-600 disabled:opacity-50"
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
          placeholder="Add a cost type, e.g. Gas cylinder"
          className="min-w-0 flex-1 rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-brand-500 focus:bg-white"
        />
        <button
          type="submit"
          disabled={busy || !label.trim()}
          className="rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-5 py-2 text-sm text-white hover:bg-brand-700 transition-all active:translate-y-px disabled:opacity-50"
        >
          Add
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
      if (!res.ok) throw new Error(data?.error ?? 'Could not record the bill.');
      toast.success('Bill recorded.');
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
        className="w-full rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-4 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
      >
        + Record a bill
      </button>
    );
  }

  return (
    <form
      key={`${groupId}-${month}`}
      onSubmit={submit}
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h2 className="text-lg font-semibold">Record a bill</h2>
      {fields}
      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-5 py-2.5 text-sm text-white hover:bg-brand-700 transition-all active:translate-y-px disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save bill'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-slate-200 px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditBill({
  bill,
  members,
  categories,
  onCancel,
  onSaved
}: {
  bill: Bill;
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
      if (!res.ok) throw new Error(data?.error ?? 'Could not update the bill.');
      toast.success('Bill updated.');
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
        <h3 className="font-semibold">Edit bill</h3>
        {fields}
        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-5 py-2.5 text-sm text-white hover:bg-brand-700 transition-all active:translate-y-px disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-xl font-semibold sm:text-2xl ${color}`}>{value}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{children}</div>;
}
