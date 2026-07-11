import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import { GroupMonthControls, useGroupMonth } from '@/components/GroupMonthControls';
import { todayKey } from '@/lib/month';

type Item = { id: string; name: string; amount: number };
type ExpenseComment = { id: string; text: string; authorId: string; authorName: string; createdAt: string };

type Expense = {
  id: string;
  date: string;
  amount: number;
  note: string;
  payer: { id: string; name: string; email: string } | null;
  items: Item[];
  comments: ExpenseComment[];
};

type HistoryEvent = {
  id: string;
  action: string;
  actorName: string;
  amountFrom: number | null;
  amountTo: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  noteFrom: string | null;
  noteTo: string | null;
  at: string;
};

type Draft = { name: string; amount: string };

const taka = (n: number) => `৳${n.toFixed(2)}`;
const blankRow = (): Draft => ({ name: '', amount: '' });

function longDate(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function when(iso: string) {
  return new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function describe(event: HistoryEvent) {
  const label = event.noteTo || event.noteFrom || 'a purchase';
  if (event.action === 'CREATED') return `added ${label} for ${event.amountTo !== null ? taka(event.amountTo) : ''}`;
  if (event.action === 'DELETED')
    return `deleted ${label}${event.amountFrom !== null ? ` (${taka(event.amountFrom)})` : ''}`;

  const parts: string[] = [];
  if (event.amountFrom !== null && event.amountTo !== null) {
    parts.push(`total ${taka(event.amountFrom)} → ${taka(event.amountTo)}`);
  }
  if (event.dateFrom && event.dateTo) parts.push(`date ${event.dateFrom} → ${event.dateTo}`);
  if (event.noteFrom !== null && event.noteTo !== null) parts.push(`note "${event.noteFrom}" → "${event.noteTo}"`);
  return `changed ${parts.join(', ')}`;
}

function itemsOf(expense: Expense): Item[] {
  if (expense.items.length > 0) return expense.items;
  return [{ id: `${expense.id}-legacy`, name: expense.note || 'Groceries', amount: expense.amount }];
}

export default function ExpensesPage() {
  const { user } = useCurrentUser();
  const toast = useToast();
  const { groups, groupId, setGroupId, month, setMonth, loadingGroups } = useGroupMonth();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [loading, setLoading] = useState(false);

  const [date, setDate] = useState(todayKey());
  const [rows, setRows] = useState<Draft[]>([blankRow(), blankRow()]);
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editRows, setEditRows] = useState<Draft[]>([]);
  const [editNote, setEditNote] = useState('');

  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const [data, hist] = await Promise.all([
        fetch(`/api/groups/${groupId}/expenses?month=${month}`).then((r) => r.json()),
        fetch(`/api/groups/${groupId}/expense-history`).then((r) => r.json())
      ]);
      setExpenses(data.expenses || []);
      setIsSupervisor(Boolean(data.isSupervisor));
      setHistory(hist.history || []);
    } finally {
      setLoading(false);
    }
  }, [groupId, month]);

  useEffect(() => {
    load();
  }, [load]);

  const draftTotal = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const editTotal = editRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const byDate = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of expenses) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [expenses]);

  const monthTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  function toPayload(list: Draft[]) {
    return list
      .filter((r) => r.name.trim() || r.amount)
      .map((r) => ({ name: r.name.trim(), amount: Number(r.amount) }));
  }

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, items: toPayload(rows), note })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not add purchase.');
      toast.success('Purchase added.');
      setRows([blankRow(), blankRow()]);
      setNote('');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  function startEdit(expense: Expense) {
    setEditId(expense.id);
    setEditDate(expense.date);
    setEditNote(expense.note);
    setEditRows(itemsOf(expense).map((i) => ({ name: i.name, amount: String(i.amount) })));
  }

  async function saveEdit(id: string) {
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: editDate, items: toPayload(editRows), note: editNote })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not update.');
      toast.success('Purchase updated.');
      setEditId(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function removeExpense(id: string) {
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not delete.');
      toast.success('Purchase deleted.');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function addComment(expenseId: string, text: string) {
    const res = await fetch(`/api/expenses/${expenseId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? 'Could not post comment.');
    await load();
  }

  async function removeComment(id: string) {
    try {
      const res = await fetch(`/api/expense-comments/${id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not delete comment.');
      toast.success('Comment removed.');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const canEditExpense = (e: Expense) => isAdmin || e.payer?.id === user?.id;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Groceries (Bazar)</h1>
        <p className="mt-1 text-slate-600">
          Who shopped, on which date, what they bought, and what the group said about it.
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

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Add a purchase</h2>
            <p className="mt-1 text-sm text-slate-500">List each product with its price. The total is added up for you.</p>

            <form className="mt-4" onSubmit={add}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="sm:w-48">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
                  />
                </label>
                <label className="flex-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Note (optional)</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. weekly bazar"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
                  />
                </label>
              </div>

              <ItemRows rows={rows} setRows={setRows} total={draftTotal} />

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={adding}
                  className="rounded-full bg-slate-900 px-6 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add purchase'}
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">Shopping report</h2>
              <p className="text-sm text-slate-500">Month total {taka(monthTotal)}</p>
            </div>

            {loading ? (
              <p className="mt-4 text-slate-500">Loading...</p>
            ) : expenses.length === 0 ? (
              <p className="mt-4 text-slate-500">No purchases logged this month.</p>
            ) : (
              <>
                <div className="mt-4 hidden overflow-x-auto lg:block">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-y border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="w-40 px-3 py-2">Date</th>
                        <th className="w-44 px-3 py-2">Member</th>
                        <th className="px-3 py-2">Products</th>
                        <th className="w-28 px-3 py-2 text-right">Amount</th>
                        <th className="w-96 px-3 py-2">Comments</th>
                      </tr>
                    </thead>

                    {byDate.map(([day, list]) => {
                      const editingHere = list.some((e) => e.id === editId);
                      const dateRowCount = list.reduce((n, e) => n + itemsOf(e).length, 0);
                      const dayTotal = list.reduce((sum, e) => sum + e.amount, 0);
                      let dateCellPlaced = false;

                      return (
                        <tbody key={day} className="border-b-4 border-slate-100">
                          {editingHere ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-4">
                                <EditPanel
                                  date={editDate}
                                  setDate={setEditDate}
                                  note={editNote}
                                  setNote={setEditNote}
                                  rows={editRows}
                                  setRows={setEditRows}
                                  total={editTotal}
                                  onSave={() => saveEdit(editId as string)}
                                  onCancel={() => setEditId(null)}
                                />
                              </td>
                            </tr>
                          ) : (
                            list.flatMap((expense) => {
                              const items = itemsOf(expense);
                              return items.map((item, index) => {
                                const showDate = !dateCellPlaced;
                                if (showDate) dateCellPlaced = true;
                                return (
                                  <tr key={item.id} className="border-t border-slate-100 align-top">
                                    {showDate && (
                                      <td rowSpan={dateRowCount} className="bg-slate-50/60 px-3 py-3 font-medium">
                                        {longDate(day)}
                                        <span className="mt-1 block text-xs font-normal text-slate-500">
                                          Day total {taka(dayTotal)}
                                        </span>
                                      </td>
                                    )}

                                    {index === 0 && (
                                      <td rowSpan={items.length} className="px-3 py-3">
                                        <span className="font-medium">{expense.payer?.name ?? 'Unknown'}</span>
                                        {expense.payer?.id === user?.id && (
                                          <span className="ml-1 text-xs text-green-600">(you)</span>
                                        )}
                                        <span className="mt-1 block text-xs text-slate-500">
                                          Paid {taka(expense.amount)}
                                        </span>
                                        {expense.note && (
                                          <span className="mt-1 block text-xs italic text-slate-400">{expense.note}</span>
                                        )}
                                        {canEditExpense(expense) && (
                                          <span className="mt-2 flex gap-2">
                                            <button
                                              onClick={() => startEdit(expense)}
                                              className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              onClick={() => removeExpense(expense.id)}
                                              className="rounded-full border border-red-200 px-2.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
                                            >
                                              Delete
                                            </button>
                                          </span>
                                        )}
                                      </td>
                                    )}

                                    <td className="px-3 py-2 text-slate-700">{item.name}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                                      {taka(item.amount)}
                                    </td>

                                    {index === 0 && (
                                      <td rowSpan={items.length} className="px-3 py-3">
                                        <CommentBox
                                          comments={expense.comments}
                                          currentUserId={user?.id}
                                          canDelete={isSupervisor}
                                          onAdd={(text) => addComment(expense.id, text)}
                                          onDelete={removeComment}
                                          onError={(m) => toast.error(m)}
                                        />
                                      </td>
                                    )}
                                  </tr>
                                );
                              });
                            })
                          )}
                        </tbody>
                      );
                    })}
                  </table>
                </div>

                <div className="mt-4 space-y-6 lg:hidden">
                  {byDate.map(([day, list]) => (
                    <div key={day}>
                      <div className="flex items-baseline justify-between">
                        <h3 className="font-semibold">{longDate(day)}</h3>
                        <span className="text-xs text-slate-500">
                          {taka(list.reduce((sum, e) => sum + e.amount, 0))}
                        </span>
                      </div>

                      <ul className="mt-2 space-y-3">
                        {list.map((expense) =>
                          editId === expense.id ? (
                            <li key={expense.id} className="rounded-2xl border border-slate-300 p-4">
                              <EditPanel
                                date={editDate}
                                setDate={setEditDate}
                                note={editNote}
                                setNote={setEditNote}
                                rows={editRows}
                                setRows={setEditRows}
                                total={editTotal}
                                onSave={() => saveEdit(expense.id)}
                                onCancel={() => setEditId(null)}
                              />
                            </li>
                          ) : (
                            <li key={expense.id} className="rounded-2xl border border-slate-200 p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium">
                                    {expense.payer?.name ?? 'Unknown'}
                                    {expense.payer?.id === user?.id && (
                                      <span className="ml-1 text-xs text-green-600">(you)</span>
                                    )}
                                  </p>
                                  {expense.note && <p className="text-xs italic text-slate-400">{expense.note}</p>}
                                </div>
                                <span className="font-semibold">{taka(expense.amount)}</span>
                              </div>

                              <ul className="mt-3 divide-y divide-slate-100 border-y border-slate-100">
                                {itemsOf(expense).map((item) => (
                                  <li key={item.id} className="flex justify-between gap-3 py-1.5 text-sm">
                                    <span className="text-slate-700">{item.name}</span>
                                    <span className="tabular-nums text-slate-600">{taka(item.amount)}</span>
                                  </li>
                                ))}
                              </ul>

                              {canEditExpense(expense) && (
                                <div className="mt-3 flex gap-2">
                                  <button
                                    onClick={() => startEdit(expense)}
                                    className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => removeExpense(expense.id)}
                                    className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}

                              <div className="mt-3 border-t border-slate-100 pt-3">
                                <CommentBox
                                  comments={expense.comments}
                                  currentUserId={user?.id}
                                  canDelete={isSupervisor}
                                  onAdd={(text) => addComment(expense.id, text)}
                                  onDelete={removeComment}
                                  onError={(m) => toast.error(m)}
                                />
                              </div>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <ChangeHistory history={history} />
        </div>
      )}
    </section>
  );
}

function ItemRows({
  rows,
  setRows,
  total
}: {
  rows: Draft[];
  setRows: (fn: (prev: Draft[]) => Draft[]) => void;
  total: number;
}) {
  return (
    <div className="mt-4">
      <div className="hidden gap-3 px-1 pb-1 text-xs font-medium uppercase tracking-wide text-slate-500 sm:flex">
        <span className="flex-1">Product</span>
        <span className="w-32">Price</span>
        <span className="w-9" />
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={row.name}
              onChange={(e) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))}
              placeholder="e.g. 1 kg miniket rice"
              className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={row.amount}
              onChange={(e) =>
                setRows((prev) => prev.map((r, i) => (i === index ? { ...r, amount: e.target.value } : r)))
              }
              placeholder="৳"
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 sm:w-32"
            />
            <button
              type="button"
              onClick={() => setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))}
              aria-label="Remove product"
              className="h-9 w-9 shrink-0 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, blankRow()])}
          className="rounded-full border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
        >
          + Add product
        </button>
        <p className="text-sm">
          <span className="text-slate-500">Total </span>
          <span className="font-semibold">{taka(total)}</span>
        </p>
      </div>
    </div>
  );
}

function EditPanel({
  date,
  setDate,
  note,
  setNote,
  rows,
  setRows,
  total,
  onSave,
  onCancel
}: {
  date: string;
  setDate: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  rows: Draft[];
  setRows: (fn: (prev: Draft[]) => Draft[]) => void;
  total: number;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="sm:w-48">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
          />
        </label>
        <label className="flex-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Note</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
          />
        </label>
      </div>

      <ItemRows rows={rows} setRows={setRows} total={total} />

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onSave}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm text-white hover:bg-slate-700"
        >
          Save changes
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-300 px-5 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CommentBox({
  comments,
  currentUserId,
  canDelete,
  onAdd,
  onDelete,
  onError
}: {
  comments: ExpenseComment[];
  currentUserId?: string;
  canDelete: boolean;
  onAdd: (text: string) => Promise<void>;
  onDelete: (id: string) => void;
  onError: (message: string) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onAdd(text);
      setText('');
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {comments.length === 0 ? (
        <p className="text-xs text-slate-400">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700">
                    {c.authorName}
                    {c.authorId === currentUserId && <span className="ml-1 text-green-600">(you)</span>}
                    <span className="ml-2 font-normal text-slate-400">{when(c.createdAt)}</span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{c.text}</p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => onDelete(c.id)}
                    aria-label="Delete comment"
                    className="shrink-0 rounded-full border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                  >
                    ×
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="mt-2 flex gap-2" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Add a comment"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="shrink-0 rounded-full bg-slate-900 px-4 py-1.5 text-xs text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {busy ? '...' : 'Post'}
        </button>
      </form>
    </div>
  );
}

function ChangeHistory({ history }: { history: HistoryEvent[] }) {
  const tone: Record<string, string> = {
    CREATED: 'bg-green-50 text-green-700 ring-green-600/20',
    UPDATED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    DELETED: 'bg-red-50 text-red-700 ring-red-600/20'
  };
  const label: Record<string, string> = { CREATED: 'Added', UPDATED: 'Changed', DELETED: 'Deleted' };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Change history</h2>
      <p className="mt-1 text-sm text-slate-500">
        Every edit to a grocery price is recorded here so the whole group can see it.
      </p>

      {history.length === 0 ? (
        <p className="mt-4 text-slate-500">No changes recorded yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {history.map((event) => (
            <li key={event.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{event.actorName}</span>{' '}
                  <span className="text-slate-600">{describe(event)}</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{when(event.at)}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  tone[event.action] ?? tone.UPDATED
                }`}
              >
                {label[event.action] ?? event.action}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm text-slate-600 sm:p-6">{children}</div>;
}
