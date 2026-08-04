import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import { GroupMonthControls, useGroupMonth } from '@/components/GroupMonthControls';
import { todayKey } from '@/lib/month';
import { PAYMENT_STATUS } from '@/lib/constants';

type MemberRow = {
  id: string;
  name: string;
  email: string;
  meals: number;
  carryIn: number;
  mealCost: number;
  billShare: number;
  billShareByType: Record<string, number>;
  cost: number;
  bazarPaid: number;
  collected: number;
  due: number;
  status: string;
  isActive: boolean;
};

type Payment = { id: string; userId: string; userName: string; amount: number; date: string };

type DayRate = { date: string; meals: number; bazar: number; rate: number; cost: number };

type Totals = {
  bazar: number;
  bills: number;
  expense: number;
  cost: number;
  carryIn: number;
  mealRate: number;
  meals: number;
  collected: number;
  outstanding: number;
  refunds: number;
  unallocatedBazar: number;
  unpricedMeals: number;
};

type PaymentsData = {
  canManage: boolean;
  currentUserId?: string;
  rateMode: string;
  effectiveRateMode: string;
  rateModeFallbackReason: string | null;
  categoryLabels: Record<string, string>;
  closing: { closedAt: string; closedThrough: string; closedBy: string | null } | null;
  members: MemberRow[];
  days: DayRate[];
  payments: Payment[];
  totals: Totals;
  byType: Record<string, number>;
};

const taka = (n: number) => `৳${n.toFixed(2)}`;
const sum = (rows: MemberRow[], pick: (row: MemberRow) => number) =>
  rows.reduce((total, row) => total + pick(row), 0);

export default function PaymentsPage() {
  const { user } = useCurrentUser();
  const toast = useToast();
  const { groups, groupId, setGroupId, month, setMonth, loadingGroups } = useGroupMonth();

  const [data, setData] = useState<PaymentsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [payerId, setPayerId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayKey());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/payments?month=${month}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not load payments.');
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

  async function record(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: payerId, amount: Number(amount), date })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not record payment.');
      toast.success('Payment recorded.');
      setAmount('');
      setPayerId('');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not remove payment.');
      toast.success('Payment removed.');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const canManage = data?.canManage ?? false;

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Payments</h1>
        <p className="mt-1 text-slate-600">
          {canManage
            ? 'Who has paid, how much, and what is still due for the month.'
            : 'What your meals cost this month and what you still owe.'}
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
            <Card>Loading payments...</Card>
          ) : (
            <>
              {data.closing && (
                <div className="rounded-2xl border border-slate-300 bg-slate-50 px-5 py-4 text-sm text-slate-700">
                  <span className="font-semibold">This month is closed</span> through {data.closing.closedThrough}
                  {data.closing.closedBy ? ` by ${data.closing.closedBy}` : ''}. Balances below are final and any unpaid
                  amount has been carried into the next month.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
                <Stat label="Bazar" value={taka(data.totals.bazar)} />
                <Stat label="Bills" value={taka(data.totals.bills)} />
                <Stat label="Collected" value={taka(data.totals.collected)} tone="green" />
                <Stat label="Outstanding dues" value={taka(data.totals.outstanding)} tone="red" />
                <Stat label="To refund" value={taka(data.totals.refunds)} />
              </div>

              {canManage && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-semibold">Record a payment</h2>
                  <p className="mt-1 text-sm text-slate-500">Log cash a member handed over for the mess.</p>
                  <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_auto_auto]" onSubmit={record}>
                    <select
                      value={payerId}
                      onChange={(e) => setPayerId(e.target.value)}
                      required
                      className="app-select !rounded-xl !py-2"
                    >
                      <option value="">Select member</option>
                      {data.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {m.id === user?.id ? ' (you)' : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      placeholder="Amount (৳)"
                      className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
                    />
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
                    />
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-full bg-brand-600 px-6 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {saving ? '...' : 'Record'}
                    </button>
                  </form>
                </div>
              )}

              {canManage && (
                <CloseMonth
                  groupId={groupId}
                  month={month}
                  members={data.members}
                  closing={data.closing}
                  outstanding={data.totals.outstanding}
                  onChanged={load}
                />
              )}

              <MemberBalances members={data.members} currentUserId={user?.id} totals={data.totals} />
              <MemberCostBreakdown
                members={data.members}
                labels={data.categoryLabels}
                byType={data.byType}
                totals={data.totals}
                currentUserId={user?.id}
              />
              <MealRateBreakdown
                days={data.days}
                totals={data.totals}
                rateMode={data.rateMode}
                effectiveRateMode={data.effectiveRateMode}
                fallbackReason={data.rateModeFallbackReason}
                members={data.members}
                currentUserId={user?.id}
              />
              <PaymentLog payments={data.payments} canManage={canManage} onRemove={remove} />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function lastDayOfMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, m, 0));
  return last.toISOString().slice(0, 10);
}

function CloseMonth({
  groupId,
  month,
  members,
  closing,
  outstanding,
  onChanged
}: {
  groupId: string;
  month: string;
  members: MemberRow[];
  closing: PaymentsData['closing'];
  outstanding: number;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [through, setThrough] = useState(() => lastDayOfMonth(month));
  const [scope, setScope] = useState<'GROUP' | 'MEMBERS'>('GROUP');
  const [selected, setSelected] = useState<string[]>([]);
  const [endMembership, setEndMembership] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setThrough(lastDayOfMonth(month));
    setOpen(false);
    setSelected([]);
  }, [month]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (scope === 'MEMBERS' && selected.length === 0) {
      toast.error('Pick at least one member to close for.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/closings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          through,
          note,
          userIds: scope === 'MEMBERS' ? selected : undefined,
          endMembership: scope === 'MEMBERS' && endMembership
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not close the month.');

      toast.success(
        `Closed for ${body.members} member${body.members === 1 ? '' : 's'}. ${taka(body.carriedForward)} carried forward.`
      );
      setOpen(false);
      setSelected([]);
      setNote('');
      await onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (closing) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Month closed</h2>
        <p className="mt-1 text-sm text-slate-500">
          Closed through {closing.closedThrough}
          {closing.closedBy ? ` by ${closing.closedBy}` : ''}. Unpaid balances now open the next month as
          &quot;brought forward&quot;. You can still close a member who joined or left later.
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-4 rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {open ? 'Cancel' : 'Close for more members'}
        </button>
        {open && (
          <CloseForm
            through={through}
            setThrough={setThrough}
            scope="MEMBERS"
            setScope={setScope}
            members={members}
            selected={selected}
            setSelected={setSelected}
            endMembership={endMembership}
            setEndMembership={setEndMembership}
            note={note}
            setNote={setNote}
            saving={saving}
            onSubmit={submit}
            lockScope
          />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Close this month</h2>
        <span className="text-sm text-slate-500">{taka(outstanding)} still outstanding</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Closing freezes everyone&apos;s figures and carries whatever is unpaid into the next month, so nothing is
        forgotten when the month rolls over. You can close on any date — useful when someone leaves mid-month.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Close {month}
        </button>
      ) : (
        <CloseForm
          through={through}
          setThrough={setThrough}
          scope={scope}
          setScope={setScope}
          members={members}
          selected={selected}
          setSelected={setSelected}
          endMembership={endMembership}
          setEndMembership={setEndMembership}
          note={note}
          setNote={setNote}
          saving={saving}
          onSubmit={submit}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function CloseForm({
  through,
  setThrough,
  scope,
  setScope,
  members,
  selected,
  setSelected,
  endMembership,
  setEndMembership,
  note,
  setNote,
  saving,
  onSubmit,
  onCancel,
  lockScope
}: {
  through: string;
  setThrough: (value: string) => void;
  scope: 'GROUP' | 'MEMBERS';
  setScope: (value: 'GROUP' | 'MEMBERS') => void;
  members: MemberRow[];
  selected: string[];
  setSelected: (value: string[]) => void;
  endMembership: boolean;
  setEndMembership: (value: boolean) => void;
  note: string;
  setNote: (value: string) => void;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  lockScope?: boolean;
}) {
  function toggle(id: string) {
    setSelected(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Close through</span>
          <input
            type="date"
            value={through}
            onChange={(e) => setThrough(e.target.value)}
            required
            className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5"
          />
        </label>

        {!lockScope && (
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Close for</span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'GROUP' | 'MEMBERS')}
              className="app-select mt-1"
            >
              <option value="GROUP">Everyone in the mess</option>
              <option value="MEMBERS">Selected members only</option>
            </select>
          </label>
        )}
      </div>

      {scope === 'MEMBERS' && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Members</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {members.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => toggle(member.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    selected.includes(member.id)
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {member.name}
                  <span className="ml-1.5 text-xs opacity-70">{taka(member.due)}</span>
                </button>
              </li>
            ))}
          </ul>

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={endMembership}
              onChange={(e) => setEndMembership(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            They are leaving the mess on this date
          </label>
        </div>
      )}

      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Note (optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="e.g. Settled at the monthly meeting"
          className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-brand-600 px-5 py-2.5 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'Closing...' : 'Confirm close'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function MemberBalances({
  members,
  currentUserId,
  totals
}: {
  members: MemberRow[];
  currentUserId?: string;
  totals: Totals;
}) {
  const hasOpening = members.some((m) => Math.abs(m.carryIn) > 0.005);
  const columns = hasOpening ? 10 : 9;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Member balances</h2>
      <p className="mt-1 text-sm text-slate-500">
        Due = {hasOpening ? 'brought forward + ' : ''}meal share + bills share − groceries they bought − cash they paid.
        A negative due means the mess owes them.
      </p>

      {members.length === 0 ? (
        <p className="mt-4 text-slate-500">No members in this month.</p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Member</th>
                  <th className="px-3 py-2 text-right">Meals</th>
                  {hasOpening && <th className="px-3 py-2 text-right">Brought forward</th>}
                  <th className="px-3 py-2 text-right">Meal share</th>
                  <th className="px-3 py-2 text-right">Bills share</th>
                  <th className="px-3 py-2 text-right">Total cost</th>
                  <th className="px-3 py-2 text-right">Bought groceries</th>
                  <th className="px-3 py-2 text-right">Cash paid</th>
                  <th className="px-3 py-2 text-right">Due</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-3 font-medium">
                      {m.name}
                      {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600">(you)</span>}
                      {!m.isActive && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          Left
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600">{m.meals}</td>
                    {hasOpening && <td className="px-3 py-3 text-right text-slate-600">{taka(m.carryIn)}</td>}
                    <td className="px-3 py-3 text-right text-slate-600">{taka(m.mealCost)}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{taka(m.billShare)}</td>
                    <td className="px-3 py-3 text-right font-medium">{taka(m.cost)}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{taka(m.bazarPaid)}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{taka(m.collected)}</td>
                    <td className={`px-3 py-3 text-right font-semibold ${m.due > 0.005 ? 'text-red-600' : 'text-green-600'}`}>
                      {taka(Math.abs(m.due))}
                      {m.due < -0.005 && <span className="ml-1 text-xs font-normal">refund</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <StatusBadge status={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 text-sm font-semibold">
                  <td className="px-3 py-3">Group total</td>
                  <td className="px-3 py-3 text-right">{totals.meals}</td>
                  {hasOpening && <td className="px-3 py-3 text-right">{taka(totals.carryIn)}</td>}
                  <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.mealCost))}</td>
                  <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.billShare))}</td>
                  <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.cost))}</td>
                  <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.bazarPaid))}</td>
                  <td className="px-3 py-3 text-right">{taka(totals.collected)}</td>
                  <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.due))}</td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={columns} className="px-3 pb-1 pt-2 text-xs font-normal text-slate-500">
                    Meal shares add up to the {taka(totals.bazar)} spent on bazar, and bill shares to the{' '}
                    {taka(totals.bills)} of bills — to the paisa, every month.
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <ul className="mt-4 space-y-3 md:hidden">
            {members.map((m) => (
              <li key={m.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">
                    {m.name}
                    {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600">(you)</span>}
                  </p>
                  <StatusBadge status={m.status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <Field label="Meals" value={String(m.meals)} />
                  {hasOpening && <Field label="Brought forward" value={taka(m.carryIn)} />}
                  <Field label="Meal share" value={taka(m.mealCost)} />
                  <Field label="Bills share" value={taka(m.billShare)} />
                  <Field label="Total cost" value={taka(m.cost)} />
                  <Field label="Bought groceries" value={taka(m.bazarPaid)} />
                  <Field label="Cash paid" value={taka(m.collected)} />
                </dl>
                <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3">
                  <span className="text-sm text-slate-500">{m.due < -0.005 ? 'Refund owed' : 'Due'}</span>
                  <span className={`text-base font-semibold ${m.due > 0.005 ? 'text-red-600' : 'text-green-600'}`}>
                    {taka(Math.abs(m.due))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function MemberCostBreakdown({
  members,
  labels,
  byType,
  totals,
  currentUserId
}: {
  members: MemberRow[];
  labels: Record<string, string>;
  byType: Record<string, number>;
  totals: Totals;
  currentUserId?: string;
}) {
  const types = Object.keys(byType)
    .filter((code) => Math.abs(byType[code]) > 0.005)
    .sort((a, b) => byType[b] - byType[a]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Who is charged what</h2>
      <p className="mt-1 text-sm text-slate-500">
        Every member&apos;s share of the month, split by cost type. &quot;Bazar bought&quot; is what they spent out of
        their own pocket, which is why it is credited back to them in the balances above.
      </p>

      {members.length === 0 ? (
        <p className="mt-4 text-slate-500">No members in this month.</p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto lg:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Member</th>
                  <th className="px-3 py-2 text-right">Meals</th>
                  <th className="px-3 py-2 text-right">Bazar bought</th>
                  <th className="px-3 py-2 text-right">Meal share</th>
                  {types.map((code) => (
                    <th key={code} className="px-3 py-2 text-right">
                      {labels[code] ?? code}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">Total charged</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-3 font-medium">
                      {m.name}
                      {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600">(you)</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600">{m.meals}</td>
                    <td className="px-3 py-3 text-right font-medium text-green-700">{taka(m.bazarPaid)}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{taka(m.mealCost)}</td>
                    {types.map((code) => (
                      <td key={code} className="px-3 py-3 text-right text-slate-600">
                        {taka(m.billShareByType?.[code] ?? 0)}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-semibold">{taka(m.mealCost + m.billShare)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-semibold">
                  <td className="px-3 py-3">Group total</td>
                  <td className="px-3 py-3 text-right">{totals.meals}</td>
                  <td className="px-3 py-3 text-right text-green-700">{taka(sum(members, (m) => m.bazarPaid))}</td>
                  <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.mealCost))}</td>
                  {types.map((code) => (
                    <td key={code} className="px-3 py-3 text-right">
                      {taka(byType[code])}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.mealCost + m.billShare))}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <ul className="mt-4 space-y-3 lg:hidden">
            {members.map((m) => (
              <li key={m.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {m.name}
                    {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600">(you)</span>}
                  </p>
                  <span className="text-sm font-semibold">{taka(m.mealCost + m.billShare)}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <Field label="Meals" value={String(m.meals)} />
                  <Field label="Bazar bought" value={taka(m.bazarPaid)} />
                  <Field label="Meal share" value={taka(m.mealCost)} />
                  {types.map((code) => (
                    <Field key={code} label={labels[code] ?? code} value={taka(m.billShareByType?.[code] ?? 0)} />
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function MealRateBreakdown({
  days,
  totals,
  rateMode,
  effectiveRateMode,
  fallbackReason,
  members,
  currentUserId
}: {
  days: DayRate[];
  totals: Totals;
  rateMode: string;
  effectiveRateMode: string;
  fallbackReason: string | null;
  members: MemberRow[];
  currentUserId?: string;
}) {
  const daily = effectiveRateMode === 'DAILY';
  const priced = days.filter((day) => day.meals > 0 || day.bazar > 0);
  const bazarBuyers = members.filter((m) => m.bazarPaid > 0.005);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Meal rate</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {daily ? 'Priced day by day' : 'One rate for the month'}
        </span>
      </div>

      <p className="mt-1 text-sm text-slate-500">
        Month rate = {taka(totals.bazar)} bazar ÷ {totals.meals} meals ={' '}
        <span className="font-semibold text-slate-900">{taka(totals.mealRate)}</span> per meal.
      </p>

      {fallbackReason === 'MEALS_WITHOUT_BAZAR' && rateMode === 'DAILY' && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
          <span className="font-semibold">Day-by-day pricing was not used this month.</span> {totals.unpricedMeals} meals
          fell on days with no bazar recorded. Pricing each day on its own shopping would have charged those meals
          nothing and made whoever ate on shopping days pay for everybody. The month&apos;s total bazar has been shared
          across every meal instead.
        </p>
      )}

      {totals.unallocatedBazar > 0.005 && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {taka(totals.unallocatedBazar)} of bazar fell on days with no meals. It has been shared across the
          month&apos;s meals rather than dropped.
        </p>
      )}

      {priced.length === 0 ? (
        <p className="mt-4 text-slate-500">Nothing recorded this month yet.</p>
      ) : (
        <div className="mt-4 max-h-80 overflow-auto rounded-2xl border border-slate-100">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Day</th>
                <th className="px-3 py-2 text-right">Meals</th>
                <th className="px-3 py-2 text-right">Bazar spent</th>
                <th className="px-3 py-2 text-right">Rate used</th>
                <th className="px-3 py-2 text-right">Charged that day</th>
              </tr>
            </thead>
            <tbody>
              {priced.map((day) => (
                <tr key={day.date} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{day.date}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{day.meals}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{taka(day.bazar)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{day.meals > 0 ? taka(day.rate) : '—'}</td>
                  <td className="px-3 py-2 text-right font-medium">{day.meals > 0 ? taka(day.cost) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{totals.meals}</td>
                <td className="px-3 py-2 text-right">{taka(totals.bazar)}</td>
                <td className="px-3 py-2 text-right">{taka(totals.mealRate)}</td>
                <td className="px-3 py-2 text-right">{taka(days.reduce((a, d) => a + d.cost, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold">Bazar bought by each member</h3>
      <p className="mt-1 text-sm text-slate-500">
        What each person spent on groceries this month, and what that contributes per meal the mess ate.
      </p>

      {bazarBuyers.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nobody has recorded bazar this month yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-100">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Member</th>
                <th className="px-3 py-2 text-right">Bazar bought</th>
                <th className="px-3 py-2 text-right">Share of bazar</th>
                <th className="px-3 py-2 text-right">Per meal eaten</th>
              </tr>
            </thead>
            <tbody>
              {bazarBuyers.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">
                    {m.name}
                    {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600">(you)</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-green-700">{taka(m.bazarPaid)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {totals.bazar > 0 ? `${Math.round((m.bazarPaid / totals.bazar) * 100)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {totals.meals > 0 ? taka(m.bazarPaid / totals.meals) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{taka(sum(bazarBuyers, (m) => m.bazarPaid))}</td>
                <td className="px-3 py-2 text-right">100%</td>
                <td className="px-3 py-2 text-right">{taka(totals.mealRate)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function PaymentLog({
  payments,
  canManage,
  onRemove
}: {
  payments: Payment[];
  canManage: boolean;
  onRemove: (id: string) => void;
}) {
  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Payments received</h2>
        <p className="text-sm text-slate-500">{payments.length} payments · {taka(total)}</p>
      </div>
      {payments.length === 0 ? (
        <p className="mt-4 text-slate-500">No payments recorded this month.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{p.userName}</p>
                <p className="text-sm text-slate-500">{p.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-green-600">{taka(p.amount)}</span>
                {canManage && (
                  <button
                    onClick={() => onRemove(p.id)}
                    className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    [PAYMENT_STATUS.PAID]: 'bg-green-50 text-green-700 ring-green-600/20',
    [PAYMENT_STATUS.PARTIAL]: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    [PAYMENT_STATUS.PENDING]: 'bg-red-50 text-red-700 ring-red-600/20',
    [PAYMENT_STATUS.REFUND]: 'bg-sky-50 text-sky-700 ring-sky-600/20'
  };
  const label: Record<string, string> = {
    [PAYMENT_STATUS.PAID]: 'Settled',
    [PAYMENT_STATUS.PARTIAL]: 'Partly paid',
    [PAYMENT_STATUS.PENDING]: 'Unpaid',
    [PAYMENT_STATUS.REFUND]: 'Refund due'
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status] ?? styles.PENDING}`}>
      {label[status] ?? status}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold sm:text-2xl ${color}`}>{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm text-slate-600 sm:p-6">{children}</div>;
}
