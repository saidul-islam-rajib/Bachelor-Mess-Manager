import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import { GroupMonthControls, useGroupMonth } from '@/components/GroupMonthControls';
import { todayKey } from '@/lib/month';

type Expense = {
  id: string;
  date: string;
  amount: number;
  note: string;
  payer: { id: string; name: string; email: string } | null;
};

export default function ExpensesPage() {
  const { user } = useCurrentUser();
  const toast = useToast();
  const { groups, groupId, setGroupId, month, setMonth, loadingGroups } = useGroupMonth();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(todayKey());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ date: string; amount: string; note: string }>({ date: '', amount: '', note: '' });

  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const data = await fetch(`/api/groups/${groupId}/expenses?month=${month}`).then((r) => r.json());
      setExpenses(data.expenses || []);
    } finally {
      setLoading(false);
    }
  }, [groupId, month]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, amount: Number(amount), note })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not add expense.');
      toast.success('Grocery expense added.');
      setAmount('');
      setNote('');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit(id: string) {
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: editDraft.date, amount: Number(editDraft.amount), note: editDraft.note })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not update.');
      toast.success('Expense updated.');
      setEditId(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not delete.');
      toast.success('Expense deleted.');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const canEdit = (exp: Expense) => isAdmin || exp.payer?.id === user?.id;
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold sm:text-3xl">Groceries (Bazar)</h1>
          <p className="mt-1 text-slate-600">Log purchases you paid for. Everyone can see all entries; only you can edit your own.</p>
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

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold">Add a purchase</h2>
              <form className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_1fr_auto]" onSubmit={add}>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
                />
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
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
                />
                <button
                  type="submit"
                  disabled={adding}
                  className="rounded-full bg-slate-900 px-6 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {adding ? '...' : 'Add'}
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">This month</h2>
                <p className="text-sm text-slate-500">Total ৳{total.toFixed(2)}</p>
              </div>
              {loading ? (
                <p className="mt-4 text-slate-500">Loading...</p>
              ) : expenses.length === 0 ? (
                <p className="mt-4 text-slate-500">No grocery purchases logged this month.</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {expenses.map((exp) =>
                    editId === exp.id ? (
                      <li key={exp.id} className="py-3">
                        <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr_auto_auto]">
                          <input
                            type="date"
                            value={editDraft.date}
                            onChange={(e) => setEditDraft((d) => ({ ...d, date: e.target.value }))}
                            className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editDraft.amount}
                            onChange={(e) => setEditDraft((d) => ({ ...d, amount: e.target.value }))}
                            className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm"
                          />
                          <input
                            value={editDraft.note}
                            onChange={(e) => setEditDraft((d) => ({ ...d, note: e.target.value }))}
                            placeholder="Note"
                            className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm"
                          />
                          <button onClick={() => saveEdit(exp.id)} className="rounded-full bg-slate-900 px-4 py-1.5 text-sm text-white hover:bg-slate-700">
                            Save
                          </button>
                          <button onClick={() => setEditId(null)} className="rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                            Cancel
                          </button>
                        </div>
                      </li>
                    ) : (
                      <li key={exp.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <div className="min-w-0">
                          <p className="font-medium">
                            ৳{exp.amount.toFixed(2)} <span className="text-sm font-normal text-slate-500">· {exp.date}</span>
                          </p>
                          <p className="text-sm text-slate-500">
                            {exp.payer?.name ?? 'Unknown'}
                            {exp.note ? ` — ${exp.note}` : ''}
                          </p>
                        </div>
                        {canEdit(exp) && (
                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() => {
                                setEditId(exp.id);
                                setEditDraft({ date: exp.date, amount: String(exp.amount), note: exp.note });
                              }}
                              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => remove(exp.id)}
                              className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm text-slate-600 sm:p-6">{children}</div>;
}
