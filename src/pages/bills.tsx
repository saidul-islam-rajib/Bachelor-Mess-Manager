import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import { GroupMonthControls, useGroupMonth } from '@/components/GroupMonthControls';
import { SPLIT_METHODS, SPLIT_METHOD_LABELS } from '@/lib/constants';
import { todayKey } from '@/lib/month';

type Share = { userId: string; userName: string; amount: number };
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
    byType: Record<string, number>;
    byMember: Record<string, number>;
  };
};

const taka = (n: number) => `৳${n.toFixed(2)}`;

function longDate(day: string) {
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

export default function BillsPage() {
  const { user } = useCurrentUser();
  const toast = useToast();
  const { groups, groupId, setGroupId, month, setMonth, loadingGroups } = useGroupMonth();

  const [data, setData] = useState<BillsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/bills?month=${month}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not load bills.');
      setData(body);
    } catch (err) {
      toast.error((err as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, month, toast]);

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
      await load();
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
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const canManage = data?.canManage ?? false;
  const myShare = data ? (data.totals.byMember[user?.id ?? ''] ?? 0) : 0;

  return (
    <section className="mx-auto max-w-content px-4 py-8 sm:py-10">
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
                <Stat label="Paid" value={taka(data.totals.settled)} tone="green" />
                <Stat label="Unpaid" value={taka(data.totals.outstanding)} tone="red" />
                <Stat label="Your share" value={taka(myShare)} />
              </div>

              <Breakdown byType={data.totals.byType} labels={data.categoryLabels} total={data.totals.total} />

              {canManage && (
                <>
                  <CategoryManager groupId={groupId} categories={data.categories} onChanged={load} />
                  <AddBillForm
                    groupId={groupId}
                    members={data.members}
                    categories={data.categories}
                    month={month}
                    onSaved={load}
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
                            await load();
                          }}
                        />
                      ) : (
                        <BillRow
                          key={bill.id}
                          bill={bill}
                          label={data.categoryLabels[bill.type] ?? bill.type}
                          currentUserId={data.currentUserId}
                          canManage={canManage}
                          onEdit={() => setEditing(bill.id)}
                          onToggle={() => toggleSettled(bill)}
                          onDelete={() => remove(bill)}
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

function BillRow({
  bill,
  label,
  currentUserId,
  canManage,
  onEdit,
  onToggle,
  onDelete
}: {
  bill: Bill;
  label: string;
  currentUserId: string;
  canManage: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [showShares, setShowShares] = useState(false);
  const myShare = bill.shares.find((s) => s.userId === currentUserId);

  return (
    <li className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{label}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                bill.isReceived ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {bill.isReceived ? 'Paid' : 'Unpaid'}
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
          <p className="text-lg font-semibold">{taka(bill.amount)}</p>
          {myShare && <p className="text-xs text-slate-500">your share {taka(myShare.amount)}</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setShowShares((v) => !v)}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {showShares ? 'Hide' : 'Show'} split ({bill.shares.length})
        </button>
        {canManage && (
          <>
            <button
              type="button"
              onClick={onToggle}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Mark {bill.isReceived ? 'unpaid' : 'paid'}
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
          </>
        )}
      </div>

      {showShares && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl bg-slate-50 px-3">
          {bill.shares.map((share) => (
            <li key={share.userId} className="flex items-center justify-between py-2 text-sm">
              <span className={share.userId === currentUserId ? 'font-medium' : 'text-slate-600'}>
                {share.userName}
                {share.userId === currentUserId && <span className="ml-1 text-xs text-green-600">(you)</span>}
              </span>
              <span>{taka(share.amount)}</span>
            </li>
          ))}
        </ul>
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
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Cost type</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className="app-select mt-1">
            {initial && !categories.some((c) => c.code === initial.type) && (
              <option value={initial.type}>{initial.type} (retired)</option>
            )}
            {categories.map((category) => (
              <option key={category.code} value={category.code}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

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

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Paid by</span>
          <select value={payerId} onChange={(e) => setPayerId(e.target.value)} className="app-select mt-1">
            <option value="">Not recorded</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
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
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
