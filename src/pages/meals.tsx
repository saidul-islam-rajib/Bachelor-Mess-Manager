import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import { GroupMonthControls, useGroupMonth } from '@/components/GroupMonthControls';
import MealPlanCard from '@/components/MealPlanCard';
import MealPromptDispatch from '@/components/MealPromptDispatch';
import { PageTitle } from '@/components/ui';
import { strings } from '@/lib/i18n';
import { daysInMonth, round2, todayKey } from '@/lib/month';

type Member = { id: string; name: string; email: string };
type Weights = { breakfast: number; lunch: number; dinner: number };
type Entry = { userId: string; date: string; breakfast: number; lunch: number; dinner: number };
type SummaryMember = { id: string; name: string; meals: number; cost: number; paid: number; balance: number };
type SummaryDay = { date: string; meals: number; expense: number; perMealPrice: number };
type Summary = {
  rateMode?: string;
  through?: string;
  members: SummaryMember[];
  days: SummaryDay[];
  totals: { expense: number; meals: number; mealRate: number; memberCount: number };
};

type EditWindow = {
  open: boolean;
  unlimited: boolean;
  expiresAt: string | null;
  secondsRemaining: number | null;
  windowMinutes: number;
  requiresApproval: boolean;
};

type MealCounts = { breakfast: number; lunch: number; dinner: number };

type PendingChange = {
  id: string;
  userId: string;
  userName: string | null;
  date: string;
  from: MealCounts;
  to: MealCounts;
  summary: string;
  reason: string | null;
  createdAt: string;
};

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
  const [canManage, setCanManage] = useState(false);
  const [editWindow, setEditWindow] = useState<EditWindow | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [windowBusy, setWindowBusy] = useState(false);
  const [openDay, setOpenDay] = useState('');

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
      setCanManage(Boolean(meals.canManage));
      setEditWindow(meals.editWindow ?? null);
      setPendingChanges(meals.pendingChanges || []);
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

  useEffect(() => {
    if (!editWindow?.open || !editWindow.expiresAt) return;

    const expiry = new Date(editWindow.expiresAt).getTime();
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
      setEditWindow((prev) => (prev ? { ...prev, secondsRemaining: remaining, open: remaining > 0 } : prev));
      if (remaining <= 0) window.clearInterval(timer);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [editWindow?.open, editWindow?.expiresAt]);

  async function toggleEditWindow(next: boolean) {
    if (!groupId) return;
    setWindowBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/meal-edit-window`, { method: next ? 'POST' : 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not change the edit window.');
      setEditWindow(data.window);
      if (next) {
        toast.success(
          data.window?.unlimited
            ? 'Past meals unlocked.'
            : `Past meals unlocked for ${data.window?.windowMinutes ?? 5} minutes.`
        );
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setWindowBusy(false);
    }
  }

  async function decideChange(id: string, status: 'APPROVED' | 'REJECTED') {
    try {
      const res = await fetch(`/api/meal-changes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not save that decision.');
      toast.success(status === 'APPROVED' ? 'Change approved and applied.' : 'Change declined.');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function withdrawChange(id: string) {
    try {
      const res = await fetch(`/api/meal-changes/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not withdraw that request.');
      toast.success('Request withdrawn.');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function cell(userId: string, date: string): Entry {
    return cells[`${userId}|${date}`] || { userId, date, breakfast: 0, lunch: 0, dinner: 0 };
  }

  function setLocal(userId: string, date: string, field: (typeof FIELDS)[number], value: number) {
    const key = `${userId}|${date}`;
    setCells((prev) => {
      const cur = prev[key] || { userId, date, breakfast: 0, lunch: 0, dinner: 0 };
      return { ...prev, [key]: { ...cur, [field]: Math.max(0, value || 0) } };
    });
  }

  async function saveDay(userId: string, date: string) {
    if (!groupId) return;
    const c = cell(userId, date);
    try {
      const res = await fetch(`/api/groups/${groupId}/meals`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, userId, breakfast: c.breakfast, lunch: c.lunch, dinner: c.dinner })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not save.');

      if (data.pending) {
        toast.success('Sent to your supervisor. The meal table updates once they approve it.');
        await load();
        return;
      }
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

  const logged = useMemo(() => {
    const w = weights ?? { breakfast: 1, lunch: 1, dinner: 1 };
    const byDay: Record<string, number> = {};
    const byMember: Record<string, number> = {};
    let total = 0;

    for (const entry of Object.values(cells)) {
      const units = entry.breakfast * w.breakfast + entry.lunch * w.lunch + entry.dinner * w.dinner;
      if (units <= 0) continue;
      byDay[entry.date] = (byDay[entry.date] ?? 0) + units;
      byMember[entry.userId] = (byMember[entry.userId] ?? 0) + units;
      total += units;
    }

    return { byDay, byMember, total: round2(total) };
  }, [cells, weights]);

  const rateNote = useMemo(() => {
    const through = summary?.through;
    if (!through || days.length === 0 || through >= days[days.length - 1]) return '';
    if (through < days[0]) return strings.meals.notStartedYet;
    return strings.meals.ratedThrough(dayLabel(through));
  }, [summary?.through, days]);

  const isMe = (id: string) => user?.id === id;
  const editable = (userId: string, date: string) => {
    if (canManage) return true;
    if (!isMe(userId)) return false;
    return date >= today || Boolean(editWindow?.open);
  };
  const needsApproval = (userId: string, date: string) =>
    !canManage && isMe(userId) && date < today && Boolean(editWindow?.open && editWindow.requiresApproval);

  const me = summary?.members.find((m) => m.id === user?.id);
  const others = members.filter((m) => !isMe(m.id));
  const belongsToGroup = members.some((m) => isMe(m.id));
  const myPending = pendingChanges.filter((c) => c.userId === user?.id);
  const pendingByCell = useMemo(() => {
    const set = new Set<string>();
    for (const change of pendingChanges) set.add(`${change.userId}|${change.date}`);
    return set;
  }, [pendingChanges]);

  return (
    <section className="mx-auto max-w-content px-4 py-8 sm:py-10">
      <PageTitle title={strings.meals.title} />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Meals</h1>
        <p className="mt-1 text-slate-600">
          {canManage
            ? 'Log meals for the mess. You can change any past day — everyone gets told when you do.'
            : 'Log your daily meals. Past days are locked until you unlock them below.'}
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
            {weights && (
              <p className="mt-3 text-xs text-slate-500">
                Weights — breakfast {weights.breakfast}, lunch {weights.lunch}, dinner {weights.dinner}
              </p>
            )}
          </Card>

          {belongsToGroup && !canManage && editWindow && (
            <EditWindowCard window={editWindow} busy={windowBusy} onToggle={toggleEditWindow} />
          )}

          {canManage && groupId && <MealPromptDispatch groupId={groupId} />}

          {canManage && pendingChanges.length > 0 && (
            <PendingApprovals changes={pendingChanges} onDecide={decideChange} />
          )}

          {!canManage && myPending.length > 0 && (
            <MyPendingChanges changes={myPending} onWithdraw={withdrawChange} />
          )}

          {groupId && belongsToGroup && <MealPlanCard groupId={groupId} onApplied={load} />}

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
              <ul className="space-y-3 lg:hidden">
                {days.map((date) => {
                  const info = dayInfo[date];
                  const canEdit = editable(user?.id ?? '', date);
                  const awaiting = pendingByCell.has(`${user?.id}|${date}`);
                  const mine = cell(user?.id ?? '', date);
                  return (
                    <li
                      key={date}
                      className={`rounded-2xl border bg-white p-4 shadow-sm ${
                        date === today ? 'border-brand-600 ring-1 ring-brand-500' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {dayLabel(date)}
                            {date === today && (
                              <span className="ml-2 text-xs font-medium text-green-600">{strings.meals.today}</span>
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {strings.meals.mealCount(round2(logged.byDay[date] ?? 0))}
                            {info && info.perMealPrice
                              ? ` · ${strings.meals.perMealShort(taka(info.perMealPrice))}`
                              : ''}
                          </p>
                        </div>
                        {awaiting ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-700">
                            {strings.meals.awaitingApproval}
                          </span>
                        ) : !canEdit ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
                            {strings.meals.locked}
                          </span>
                        ) : null}
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
                                onChange={(e) => setLocal(user?.id ?? '', date, f, parseInt(e.target.value, 10))}
                                onBlur={() => saveDay(user?.id ?? '', date)}
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

                      {canEdit && needsApproval(user?.id ?? '', date) && (
                        <p className="mt-2 text-xs text-amber-700">{strings.meals.approvalNotice}</p>
                      )}

                      {others.length > 0 && canManage && (
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <button
                            type="button"
                            onClick={() => setOpenDay((current) => (current === date ? '' : date))}
                            aria-expanded={openDay === date}
                            className="flex min-h-[2rem] w-full items-center justify-between gap-2 rounded-xl px-1 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50"
                          >
                            {openDay === date ? strings.meals.hideEveryone : strings.meals.everyoneOnDay(others.length)}
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={`transition-transform ${openDay === date ? 'rotate-180' : ''}`}
                            >
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>

                          {openDay === date && (
                            <ul className="mt-2 space-y-3">
                              {others.map((m) => {
                                const memberCell = cell(m.id, date);
                                return (
                                  <li key={m.id} className="rounded-xl bg-slate-50 p-3">
                                    <p className="text-xs font-medium text-slate-700">{m.name}</p>
                                    <div className="mt-2 grid grid-cols-3 gap-2">
                                      {FIELDS.map((f) => (
                                        <label key={f} className="block">
                                          <span className="text-[11px] text-slate-500">{FIELD_LABELS[f]}</span>
                                          <input
                                            type="number"
                                            min={0}
                                            inputMode="numeric"
                                            aria-label={`${m.name} ${FIELD_LABELS[f]}`}
                                            value={memberCell[f] || 0}
                                            onChange={(e) => setLocal(m.id, date, f, parseInt(e.target.value, 10))}
                                            onBlur={() => saveDay(m.id, date)}
                                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-sm"
                                          />
                                        </label>
                                      ))}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}

                      {others.length > 0 && !canManage && (
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
                            const canEdit = editable(m.id, date);
                            const awaiting = pendingByCell.has(`${m.id}|${date}`);
                            return FIELDS.map((f, i) => {
                              const edge = i === 2 ? 'border-r border-slate-200' : '';
                              return canEdit ? (
                                <td key={`${m.id}-${f}`} className={`px-1 py-1.5 ${edge}`}>
                                  <input
                                    type="number"
                                    min={0}
                                    value={c[f] || 0}
                                    onChange={(e) => setLocal(m.id, date, f, parseInt(e.target.value, 10))}
                                    onBlur={() => saveDay(m.id, date)}
                                    title={
                                      awaiting
                                        ? 'A change to this day is waiting for approval'
                                        : date < today
                                          ? 'Past day'
                                          : undefined
                                    }
                                    className={`w-14 rounded-lg border bg-white px-1 py-1.5 text-center focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${
                                      awaiting ? 'border-amber-400 bg-amber-50' : 'border-slate-300'
                                    }`}
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
                          <td className="px-4 py-2 font-semibold">{round2(logged.byDay[date] ?? 0)}</td>
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
                            {round2(logged.byMember[m.id] ?? 0)}
                          </td>
                        ))}
                        <td className="px-4 py-3">{logged.total}</td>
                        <td className="px-4 py-3 text-slate-600">—</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {rateNote && (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  {rateNote}
                </p>
              )}

              <MonthlySummary summary={summary} currentUserId={user?.id} />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function EditWindowCard({
  window: editWindow,
  busy,
  onToggle
}: {
  window: EditWindow;
  busy: boolean;
  onToggle: (next: boolean) => void;
}) {
  const remaining = editWindow.secondsRemaining;

  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${
        editWindow.open ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={editWindow.open}
              disabled={busy}
              onChange={(e) => onToggle(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
            />
            <span className="text-base font-semibold">Edit my past meals</span>
          </label>
          <p className="mt-2 max-w-xl text-sm text-slate-600">
            {editWindow.open
              ? editWindow.requiresApproval
                ? 'Past days are open. Anything you change there goes to your supervisor for approval before it counts.'
                : 'Past days are open. Changes apply straight away and the whole mess is notified.'
              : editWindow.unlimited
                ? 'Turn this on to correct meals on days that have already passed.'
                : `Turn this on to correct meals on days that have already passed. It stays open for ${editWindow.windowMinutes} minutes, then locks itself again.`}
          </p>
        </div>

        {editWindow.open && (
          <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm font-semibold tabular-nums text-amber-700 ring-1 ring-amber-300">
            {editWindow.unlimited || remaining === null ? 'No time limit' : `${formatRemaining(remaining)} left`}
          </span>
        )}
      </div>
    </div>
  );
}

function ChangeSummary({ change }: { change: PendingChange }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium">
        {change.userName ? `${change.userName} · ` : ''}
        {dayLabel(change.date)}
      </p>
      <p className="mt-0.5 text-sm text-slate-600">{change.summary}</p>
      {change.reason && <p className="mt-1 text-xs italic text-slate-500">“{change.reason}”</p>}
    </div>
  );
}

function PendingApprovals({
  changes,
  onDecide
}: {
  changes: PendingChange[];
  onDecide: (id: string, status: 'APPROVED' | 'REJECTED') => void;
}) {
  return (
    <div className="rounded-3xl border border-amber-300 bg-amber-50 p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">
        Meal changes waiting for you
        <span className="ml-2 rounded-full bg-white px-2.5 py-0.5 text-sm font-medium text-amber-700 ring-1 ring-amber-300">
          {changes.length}
        </span>
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Nothing below counts towards the meal rate until you approve it.
      </p>

      <ul className="mt-4 space-y-3">
        {changes.map((change) => (
          <li
            key={change.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-amber-200"
          >
            <ChangeSummary change={change} />
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => onDecide(change.id, 'APPROVED')}
                className="rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition-all active:translate-y-px"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => onDecide(change.id, 'REJECTED')}
                className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MyPendingChanges({ changes, onWithdraw }: { changes: PendingChange[]; onWithdraw: (id: string) => void }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Waiting for your supervisor</h2>
      <p className="mt-1 text-sm text-slate-500">
        These days still show their old numbers in the table until the change is approved.
      </p>
      <ul className="mt-4 space-y-3">
        {changes.map((change) => (
          <li
            key={change.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"
          >
            <ChangeSummary change={change} />
            <button
              type="button"
              onClick={() => onWithdraw(change.id)}
              className="shrink-0 rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Withdraw
            </button>
          </li>
        ))}
      </ul>
    </div>
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
