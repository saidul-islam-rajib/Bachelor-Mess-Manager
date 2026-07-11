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
  cost: number;
  bazarPaid: number;
  collected: number;
  due: number;
  status: string;
};

type Payment = { id: string; userId: string; userName: string; amount: number; date: string };

type Totals = { expense: number; cost: number; collected: number; outstanding: number; refunds: number };

type PaymentsData = { canManage: boolean; members: MemberRow[]; payments: Payment[]; totals: Totals };

const taka = (n: number) => `৳${n.toFixed(2)}`;

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
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <Stat label="Groceries spent" value={taka(data.totals.expense)} />
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
                      className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
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
                      className="rounded-full bg-slate-900 px-6 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      {saving ? '...' : 'Record'}
                    </button>
                  </form>
                </div>
              )}

              <MemberBalances members={data.members} currentUserId={user?.id} />
              <PaymentLog payments={data.payments} canManage={canManage} onRemove={remove} />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function MemberBalances({ members, currentUserId }: { members: MemberRow[]; currentUserId?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Member balances</h2>
      <p className="mt-1 text-sm text-slate-500">
        Due = meal share − groceries they bought − cash they paid. A negative due means the mess owes them.
      </p>

      {members.length === 0 ? (
        <p className="mt-4 text-slate-500">No active members.</p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Member</th>
                  <th className="px-3 py-2 text-right">Meals</th>
                  <th className="px-3 py-2 text-right">Meal share</th>
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
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600">{m.meals}</td>
                    <td className="px-3 py-3 text-right">{taka(m.cost)}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{taka(m.bazarPaid)}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{taka(m.collected)}</td>
                    <td className={`px-3 py-3 text-right font-semibold ${m.due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {taka(Math.abs(m.due))}
                      {m.due < 0 && <span className="ml-1 text-xs font-normal">refund</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <StatusBadge status={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
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
                  <Field label="Meal share" value={taka(m.cost)} />
                  <Field label="Bought groceries" value={taka(m.bazarPaid)} />
                  <Field label="Cash paid" value={taka(m.collected)} />
                </dl>
                <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3">
                  <span className="text-sm text-slate-500">{m.due < 0 ? 'Refund owed' : 'Due'}</span>
                  <span className={`text-base font-semibold ${m.due > 0 ? 'text-red-600' : 'text-green-600'}`}>
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
    [PAYMENT_STATUS.PENDING]: 'bg-red-50 text-red-700 ring-red-600/20'
  };
  const label: Record<string, string> = {
    [PAYMENT_STATUS.PAID]: 'Paid',
    [PAYMENT_STATUS.PARTIAL]: 'Partial',
    [PAYMENT_STATUS.PENDING]: 'Unpaid'
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
