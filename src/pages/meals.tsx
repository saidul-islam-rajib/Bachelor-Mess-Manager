import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import { GroupMonthControls, useGroupMonth } from '@/components/GroupMonthControls';
import { daysInMonth, todayKey } from '@/lib/month';

type Member = { id: string; name: string; email: string };
type Weights = { breakfast: number; lunch: number; dinner: number };
type Entry = { userId: string; date: string; breakfast: number; lunch: number; dinner: number };
type SummaryMember = { id: string; name: string; meals: number; cost: number; paid: number; balance: number };
type SummaryDay = { date: string; meals: number; expense: number; perMealPrice: number };
type Summary = { members: SummaryMember[]; days: SummaryDay[]; totals: { expense: number; meals: number; memberCount: number } };

const FIELDS = ['breakfast', 'lunch', 'dinner'] as const;
const FIELD_LABELS: Record<(typeof FIELDS)[number], string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner'
};
const FIELD_SHORT: Record<(typeof FIELDS)[number], string> = { breakfast: 'B', lunch: 'L', dinner: 'D' };

const taka = (n: number) => `৳${n.toFixed(2)}`;

function dayLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  });
}

export default function MealsPage() {
  const { user } = useCurrentUser();
  const toast = useToast();
  const { groups, groupId, setGroupId, month, setMonth, loadingGroups } = useGroupMonth();

  const [members, setMembers] = useState<Member[]>([]);
  const [weights, setWeights] = useState<Weights | null>(null);
  const [cells, setCells] = useState<Record<string, Entry>>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  const days = useMemo(() => daysInMonth(month), [month]);
  const today = todayKey();

  const loadSummary = useCallback(async () => {
    if (!groupId) return;
    const data = await fetch(`/api/groups/${groupId}/meal-summary?month=${month}`).then((r) => r.json());
    if (data.members) setSummary(data);
  }, [groupId, month]);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const meals = await fetch(`/api/groups/${groupId}/meals?month=${month}`).then((r) => r.json());
      setMembers(meals.members || []);
      setWeights(meals.weights || null);
      const map: Record<string, Entry> = {};
      for (const e of meals.entries || []) map[`${e.userId}|${e.date}`] = e;
      setCells(map);
      await loadSummary();
    } finally {
      setLoading(false);
    }
  }, [groupId, month, loadSummary]);

  useEffect(() => {
    load();
  }, [load]);

  function cell(userId: string, date: string): Entry {
    return cells[`${userId}|${date}`] || { userId, date, breakfast: 0, lunch: 0, dinner: 0 };
  }

  function setLocal(date: string, field: (typeof FIELDS)[number], value: number) {
    if (!user) return;
    const key = `${user.id}|${date}`;
    setCells((prev) => {
      const cur = prev[key] || { userId: user.id, date, breakfast: 0, lunch: 0, dinner: 0 };
      return { ...prev, [key]: { ...cur, [field]: Math.max(0, value || 0) } };
    });
  }

  async function saveDay(date: string) {
    if (!user || !groupId) return;
    const c = cell(user.id, date);
    try {
      const res = await fetch(`/api/groups/${groupId}/meals`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, breakfast: c.breakfast, lunch: c.lunch, dinner: c.dinner })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not save.');
      await loadSummary();
    } catch (err) {
      toast.error((err as Error).message);
      load();
    }
  }

  const dayInfo = useMemo(() => {
    const map: Record<string, SummaryDay> = {};
    for (const d of summary?.days || []) map[d.date] = d;
    return map;
  }, [summary]);

  const editable = (date: string) => date >= today;
  const isMe = (id: string) => user?.id === id;
  const me = summary?.members.find((m) => m.id === user?.id);
  const others = members.filter((m) => !isMe(m.id));

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Meals</h1>
        <p className="mt-1 text-slate-600">Log your daily meals. Past days are locked — you can edit today and upcoming days.</p>
      </div>

      {loadingGroups ? (
        <Card>Loading...</Card>
      ) : groups.length === 0 ? (
        <Card>You&apos;re not part of any group yet.</Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <GroupMonthControls groups={groups} groupId={groupId} setGroupId={setGroupId} month={month} setMonth={setMonth} />
            {weights && (
              <p className="mt-3 text-xs text-slate-500">
                Weights — breakfast {weights.breakfast}, lunch {weights.lunch}, dinner {weights.dinner}
              </p>
            )}
          </Card>

          {loading ? (
            <Card>Loading meals...</Card>
          ) : (
            <>
              {me && (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  <Stat label="Your meals" value={String(me.meals)} />
                  <Stat label="Your cost" value={taka(me.cost)} />
                  <Stat label="You paid" value={taka(me.paid)} />
                  <Stat
                    label={me.balance >= 0 ? 'Mess owes you' : 'You owe'}
                    value={taka(Math.abs(me.balance))}
                    tone={me.balance >= 0 ? 'green' : 'red'}
                  />
                </div>
              )}

              {/* Phone: one card per day. The member x meal matrix below only works on a wide screen. */}
              <ul className="space-y-3 lg:hidden">
                {days.map((date) => {
                  const info = dayInfo[date];
                  const canEdit = editable(date);
                  const mine = cell(user?.id ?? '', date);
                  return (
                    <li
                      key={date}
                      className={`rounded-2xl border bg-white p-4 shadow-sm ${
                        date === today ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {dayLabel(date)}
                            {date === today && <span className="ml-2 text-xs font-medium text-green-600">Today</span>}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {info ? `${info.meals} meals` : '0 meals'}
                            {info && info.perMealPrice ? ` · ${taka(info.perMealPrice)}/meal` : ''}
                          </p>
                        </div>
                        {!canEdit && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">Locked</span>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {FIELDS.map((f) => (
                          <label key={f} className="block">
                            <span className="text-xs text-slate-500">{FIELD_LABELS[f]}</span>
                            {canEdit ? (
                              <input
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={mine[f] || 0}
                                onChange={(e) => setLocal(date, f, parseInt(e.target.value, 10))}
                                onBlur={() => saveDay(date)}
                                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-2 py-2 text-center text-base"
                              />
                            ) : (
                              <span className="mt-1 block rounded-xl bg-slate-100 px-2 py-2 text-center text-base text-slate-500">
                                {mine[f] || 0}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>

                      {others.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                          {others.map((m) => {
                            const c = cell(m.id, date);
                            return (
                              <span key={m.id}>
                                {m.name} <span className="font-medium text-slate-700">{c.breakfast}/{c.lunch}/{c.dinner}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* Desktop: the full member x day matrix. */}
              <div className="hidden overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm lg:block">
                <table className="min-w-full border-collapse text-center text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th rowSpan={2} className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold">
                        Date
                      </th>
                      {members.map((m) => (
                        <th
                          key={m.id}
                          colSpan={3}
                          className={`border-r border-slate-200 px-3 py-3 font-semibold ${
                            isMe(m.id) ? 'bg-slate-100 text-slate-900' : 'text-slate-600'
                          }`}
                        >
                          {m.name}
                          {isMe(m.id) && <span className="ml-1 text-xs font-normal text-green-600">(you)</span>}
                        </th>
                      ))}
                      <th rowSpan={2} className="px-4 py-3 font-semibold">Meals</th>
                      <th rowSpan={2} className="px-4 py-3 font-semibold">৳/meal</th>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                      {members.flatMap((m) =>
                        FIELDS.map((f, i) => (
                          <th
                            key={`${m.id}-${f}`}
                            className={`px-2 pb-2 font-medium ${i === 2 ? 'border-r border-slate-200' : ''} ${
                              isMe(m.id) ? 'bg-slate-100' : ''
                            }`}
                          >
                            {FIELD_SHORT[f]}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((date) => {
                      const info = dayInfo[date];
                      const canEdit = editable(date);
                      const isToday = date === today;
                      return (
                        <tr
                          key={date}
                          className={`border-b border-slate-100 last:border-0 ${isToday ? 'bg-amber-50' : 'hover:bg-slate-50/70'}`}
                        >
                          <td
                            className={`sticky left-0 z-10 border-r border-slate-200 px-4 py-2 text-left font-medium ${
                              isToday ? 'bg-amber-50' : 'bg-white'
                            }`}
                          >
                            {date.slice(8)}
                            <span className="ml-2 text-xs font-normal text-slate-400">{dayLabel(date).slice(0, 3)}</span>
                          </td>
                          {members.flatMap((m) => {
                            const c = cell(m.id, date);
                            const mine = isMe(m.id);
                            return FIELDS.map((f, i) => {
                              const edge = i === 2 ? 'border-r border-slate-200' : '';
                              return mine && canEdit ? (
                                <td key={`${m.id}-${f}`} className={`px-1 py-1.5 ${edge}`}>
                                  <input
                                    type="number"
                                    min={0}
                                    value={c[f] || 0}
                                    onChange={(e) => setLocal(date, f, parseInt(e.target.value, 10))}
                                    onBlur={() => saveDay(date)}
                                    className="w-14 rounded-lg border border-slate-300 bg-white px-1 py-1.5 text-center focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                                  />
                                </td>
                              ) : (
                                <td
                                  key={`${m.id}-${f}`}
                                  className={`px-2 py-2 ${edge} ${mine ? 'text-slate-400' : 'text-slate-600'}`}
                                >
                                  {c[f] || 0}
                                </td>
                              );
                            });
                          })}
                          <td className="px-4 py-2 font-semibold">{info ? info.meals : 0}</td>
                          <td className="px-4 py-2 text-slate-600">
                            {info && info.perMealPrice ? info.perMealPrice.toFixed(2) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {summary && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                        <td className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-4 py-3 text-left">Total</td>
                        {members.map((m) => (
                          <td key={m.id} colSpan={3} className="border-r border-slate-200 px-3 py-3">
                            {summary.members.find((s) => s.id === m.id)?.meals ?? 0}
                          </td>
                        ))}
                        <td className="px-4 py-3">{summary.totals.meals}</td>
                        <td className="px-4 py-3 text-slate-600">—</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <MonthlySummary summary={summary} currentUserId={user?.id} />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function MonthlySummary({ summary, currentUserId }: { summary: Summary | null; currentUserId?: string }) {
  if (!summary) return null;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Monthly summary</h2>
        <p className="text-sm text-slate-500">
          Total spent {taka(summary.totals.expense)} · {summary.totals.meals} meals
        </p>
      </div>

      {/* Desktop table. */}
      <div className="mt-4 hidden overflow-x-auto sm:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2 text-right">Meals</th>
              <th className="px-3 py-2 text-right">Cost</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {summary.members.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 font-medium">
                  {m.name}
                  {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600">(you)</span>}
                </td>
                <td className="px-3 py-2 text-right">{m.meals}</td>
                <td className="px-3 py-2 text-right">{taka(m.cost)}</td>
                <td className="px-3 py-2 text-right">{taka(m.paid)}</td>
                <td className={`px-3 py-2 text-right font-medium ${m.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {m.balance >= 0 ? '+' : '−'}
                  {Math.abs(m.balance).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone cards. */}
      <ul className="mt-4 space-y-3 sm:hidden">
        {summary.members.map((m) => (
          <li key={m.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {m.name}
                {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600">(you)</span>}
              </p>
              <span className={`font-semibold ${m.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {m.balance >= 0 ? '+' : '−'}
                {Math.abs(m.balance).toFixed(2)}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {m.meals} meals · cost {taka(m.cost)} · paid {taka(m.paid)}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-slate-400">Balance = paid − cost. Positive means the mess owes you; negative means you owe.</p>
    </div>
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

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm text-slate-600 sm:p-6">{children}</div>;
}
