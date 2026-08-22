import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import { GroupMonthControls, useGroupMonth } from '@/components/GroupMonthControls';
import MealPromptDispatch from '@/components/MealPromptDispatch';
import MealRateCard, { type DailyRate } from '@/components/MealRateCard';
import MealRateTrendChart from '@/components/MealRateTrendChart';
import { PageTitle } from '@/components/ui';
import { strings } from '@/lib/i18n';
import { daysInMonth, round2, shiftDayKey, todayKey } from '@/lib/month';
import { PERMISSIONS } from '@/lib/permissions';
import { formatCurrency, formatDayKey } from '@/lib/format';
import { uiConfig } from '@/config';

const MONTH_KEY_LENGTH = 7;

type Member = { id: string; name: string; email: string };
type Weights = { breakfast: number; lunch: number; dinner: number };
type Entry = { userId: string; date: string; breakfast: number; lunch: number; dinner: number };
type SummaryMember = { id: string; name: string; meals: number; cost: number; paid: number; balance: number };
type SummaryBuyer = { id: string; name: string; amount: number };
type SummaryDay = {
  date: string;
  meals: number;
  expense: number;
  perMealPrice: number;
  runningRate: number;
  buyers: SummaryBuyer[];
};
type Summary = {
  rateMode?: string;
  through?: string;
  members: SummaryMember[];
  days: SummaryDay[];
  totals: {
    expense: number;
    meals: number;
    mealRate: number;
    averageDayRate: number;
    pricedDays: number;
    memberCount: number;
  };
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
  breakfast: strings.meals.breakfast,
  lunch: strings.meals.lunch,
  dinner: strings.meals.dinner
};
const FIELD_SHORT: Record<(typeof FIELDS)[number], string> = {
  breakfast: strings.meals.breakfastShort,
  lunch: strings.meals.lunchShort,
  dinner: strings.meals.dinnerShort
};

const taka = formatCurrency;

function dayLabel(date: string) {
  return formatDayKey(date, 'weekdayDayMonth');
}

export default function MealsPage() {
  const { user, can } = useCurrentUser();
  const canRecordOwn = can(PERMISSIONS.MEAL_RECORD_OWN);
  const canRecordAny = can(PERMISSIONS.MEAL_RECORD_ANY);
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
  const [openDay, setOpenDay] = useState('');
  const [showWholeMonth, setShowWholeMonth] = useState(false);

  const days = useMemo(() => daysInMonth(month), [month]);
  const today = todayKey();
  const todayIsInMonth = today.slice(0, MONTH_KEY_LENGTH) === month;

  useEffect(() => {
    setShowWholeMonth(false);
  }, [month]);

  const visibleDays = useMemo(() => {
    if (showWholeMonth || !todayIsInMonth) return days;

    const from = shiftDayKey(today, -uiConfig.mealDaysBefore);
    const to = shiftDayKey(today, uiConfig.mealDaysAfter);
    return days.filter((date) => date >= from && date <= to);
  }, [days, showWholeMonth, todayIsInMonth, today]);

  const hiddenDayCount = days.length - visibleDays.length;

  const loadSummary = useCallback(async () => {
    if (!groupId) return;
    const data = await fetch(`/api/groups/${groupId}/meal-summary?month=${month}`).then((r) => r.json());
    if (data.members) setSummary(data);
  }, [groupId, month]);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const [meals] = await Promise.all([
        fetch(`/api/groups/${groupId}/meals?month=${month}`).then((r) => r.json()),
        loadSummary()
      ]);
      setMembers(meals.members || []);
      setWeights(meals.weights || null);
      setCanManage(Boolean(meals.canManage));
      setEditWindow(meals.editWindow ?? null);
      setPendingChanges(meals.pendingChanges || []);
      const map: Record<string, Entry> = {};
      for (const e of meals.entries || []) map[`${e.userId}|${e.date}`] = e;
      setCells(map);
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

  async function decideChange(id: string, status: 'APPROVED' | 'REJECTED') {
    try {
      const res = await fetch(`/api/meal-changes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? strings.meals.decisionFailed);
      toast.success(status === 'APPROVED' ? strings.meals.changeApproved : strings.meals.changeDeclined);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function withdrawChange(id: string) {
    try {
      const res = await fetch(`/api/meal-changes/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? strings.meals.withdrawFailed);
      toast.success(strings.meals.withdrawn);
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
      if (!res.ok) throw new Error(data?.error ?? strings.meals.saveFailed);

      if (data.pending) {
        toast.success(strings.meals.sentToSupervisor);
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

  const myDailyRates = useMemo<DailyRate[]>(() => {
    const weight = weights ?? { breakfast: 1, lunch: 1, dinner: 1 };
    const flatRate = summary?.totals.mealRate ?? 0;

    return (summary?.days ?? []).map((day) => {
      const mine = cells[`${user?.id}|${day.date}`];
      const myMeals = mine
        ? round2(mine.breakfast * weight.breakfast + mine.lunch * weight.lunch + mine.dinner * weight.dinner)
        : 0;

      return {
        date: day.date,
        runningRate: day.runningRate,
        groupMeals: day.meals,
        myMeals,
        myCost: round2(myMeals * flatRate)
      };
    });
  }, [summary?.days, summary?.totals.mealRate, cells, weights, user?.id]);

  const finalRunningRate = summary?.totals.mealRate ?? 0;

  const rateNote = useMemo(() => {
    const through = summary?.through;
    if (!through || days.length === 0 || through >= days[days.length - 1]) return '';
    if (through < days[0]) return strings.meals.notStartedYet;
    return strings.meals.ratedThrough(dayLabel(through));
  }, [summary?.through, days]);

  const isMe = (id: string) => user?.id === id;
  const editable = (userId: string, date: string) => {
    if (!(isMe(userId) ? canRecordOwn : canRecordAny)) return false;
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
        <h1 className="text-2xl font-semibold sm:text-3xl">{strings.meals.title}</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          {canManage ? strings.meals.subtitleManage : strings.meals.subtitle}
        </p>
      </div>

      {loadingGroups ? (
        <Card>{strings.common.loading}</Card>
      ) : groups.length === 0 ? (
        <Card>{strings.emptyState.noGroups}</Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <GroupMonthControls groups={groups} groupId={groupId} setGroupId={setGroupId} month={month} setMonth={setMonth} />
            {weights && (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {strings.meals.weightsNote(weights.breakfast, weights.lunch, weights.dinner)}
              </p>
            )}
          </Card>

          {canManage && groupId && <MealPromptDispatch groupId={groupId} />}

          {canManage && pendingChanges.length > 0 && (
            <PendingApprovals changes={pendingChanges} onDecide={decideChange} />
          )}

          {!canManage && myPending.length > 0 && (
            <MyPendingChanges changes={myPending} onWithdraw={withdrawChange} />
          )}

          {loading ? (
            <Card>{strings.meals.loadingMeals}</Card>
          ) : (
            <>
              {me && (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  <Stat label={strings.meals.yourMeals} value={String(me.meals)} />
                  <Stat label={strings.meals.yourCost} value={taka(me.cost)} />
                  <Stat label={strings.meals.youPaid} value={taka(me.paid)} />
                  <Stat
                    label={me.balance >= 0 ? strings.meals.messOwesYou : strings.meals.youOwe}
                    value={taka(Math.abs(me.balance))}
                    tone={me.balance >= 0 ? 'green' : 'red'}
                  />
                </div>
              )}

              {me && summary?.rateMode === 'DAILY' && (
                <p className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                  {strings.meals.dailyCostNote}
                </p>
              )}
              <DayRangeBar
                visibleDays={visibleDays}
                totalDays={days.length}
                hiddenDayCount={hiddenDayCount}
                showWholeMonth={showWholeMonth}
                onToggle={() => setShowWholeMonth((value) => !value)}
              />

              <ul className="space-y-3 lg:hidden">
                {visibleDays.map((date) => {
                  const info = dayInfo[date];
                  const canEdit = editable(user?.id ?? '', date);
                  const awaiting = pendingByCell.has(`${user?.id}|${date}`);
                  const mine = cell(user?.id ?? '', date);
                  return (
                    <li
                      key={date}
                      className={`rounded-2xl border bg-white dark:bg-slate-800 p-4 shadow-sm ${
                        date === today ? 'border-brand-600 ring-1 ring-brand-500' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {dayLabel(date)}
                            {date === today && (
                              <span className="ml-2 text-xs font-medium text-green-600 dark:text-green-400">{strings.meals.today}</span>
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {strings.meals.mealCount(round2(logged.byDay[date] ?? 0))}
                          </p>
                          {info && info.perMealPrice > 0 && (
                            <p className="mt-1.5 inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">
                              {strings.meals.perMealShort(taka(info.perMealPrice))}
                            </p>
                          )}
                        </div>
                        {awaiting ? (
                          <span className="rounded-full bg-amber-100 dark:bg-amber-500/15 px-2.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                            {strings.meals.awaitingApproval}
                          </span>
                        ) : !canEdit ? (
                          <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {strings.meals.locked}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {FIELDS.map((f) => (
                          <label key={f} className="block">
                            <span className="text-xs text-slate-500 dark:text-slate-400">{FIELD_LABELS[f]}</span>
                            {canEdit && !awaiting ? (
                              <input
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={mine[f] || 0}
                                onChange={(e) => setLocal(user?.id ?? '', date, f, parseInt(e.target.value, 10))}
                                onBlur={() => saveDay(user?.id ?? '', date)}
                                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-2 py-2 text-center text-base"
                              />
                            ) : (
                              <span
                                title={awaiting ? strings.meals.pendingApprovalTooltip : undefined}
                                className={`mt-1 block rounded-xl px-2 py-2 text-center text-base ${
                                  awaiting ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {mine[f] || 0}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>

                      {canEdit && needsApproval(user?.id ?? '', date) && (
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{strings.meals.approvalNotice}</p>
                      )}

                      {others.length > 0 && canManage && (
                        <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-3">
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
                                  <li key={m.id} className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
                                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{m.name}</p>
                                    <div className="mt-2 grid grid-cols-3 gap-2">
                                      {FIELDS.map((f) => (
                                        <label key={f} className="block">
                                          <span className="text-[11px] text-slate-500 dark:text-slate-400">{FIELD_LABELS[f]}</span>
                                          <input
                                            type="number"
                                            min={0}
                                            inputMode="numeric"
                                            aria-label={`${m.name} ${FIELD_LABELS[f]}`}
                                            value={memberCell[f] || 0}
                                            onChange={(e) => setLocal(m.id, date, f, parseInt(e.target.value, 10))}
                                            onBlur={() => saveDay(m.id, date)}
                                            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-center text-sm"
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
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 dark:border-slate-700 pt-3 text-xs text-slate-500 dark:text-slate-400">
                          {others.map((m) => {
                            const c = cell(m.id, date);
                            return (
                              <span key={m.id}>
                                {m.name} <span className="font-medium text-slate-700 dark:text-slate-300">{c.breakfast}/{c.lunch}/{c.dinner}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="hidden overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm lg:block">
                <table className="min-w-full border-collapse text-center text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                      <th rowSpan={2} className="sticky left-0 z-10 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-left font-semibold">
                        {strings.common.date}
                      </th>
                      {members.map((m) => (
                        <th
                          key={m.id}
                          colSpan={3}
                          className={`border-r border-slate-200 dark:border-slate-700 px-3 py-3 font-semibold ${
                            isMe(m.id) ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {m.name}
                          {isMe(m.id) && <span className="ml-1 text-xs font-normal text-green-600 dark:text-green-400">{strings.common.you}</span>}
                        </th>
                      ))}
                      <th rowSpan={2} className="px-4 py-3 font-semibold">{strings.meals.colMeals}</th>
                      <th rowSpan={2} className="px-4 py-3 font-semibold" title={strings.meals.rate.runningRateHint}>
                        {strings.meals.rate.runningRateColumn}
                      </th>
                    </tr>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 dark:text-slate-400">
                      {members.flatMap((m) =>
                        FIELDS.map((f, i) => (
                          <th
                            key={`${m.id}-${f}`}
                            className={`px-2 pb-2 font-medium ${i === 2 ? 'border-r border-slate-200 dark:border-slate-700' : ''} ${
                              isMe(m.id) ? 'bg-slate-100 dark:bg-slate-700' : ''
                            }`}
                          >
                            {FIELD_SHORT[f]}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDays.map((date) => {
                      const info = dayInfo[date];
                      const isToday = date === today;
                      return (
                        <tr
                          key={date}
                          className={`border-b border-slate-100 dark:border-slate-700 last:border-0 ${isToday ? 'bg-amber-50 dark:bg-amber-500/10' : 'hover:bg-slate-50/70'}`}
                        >
                          <td
                            className={`sticky left-0 z-10 border-r border-slate-200 dark:border-slate-700 px-4 py-2 text-left font-medium ${
                              isToday ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-white dark:bg-slate-800'
                            }`}
                          >
                            {date.slice(8)}
                            <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">{dayLabel(date).slice(0, 3)}</span>
                          </td>
                          {members.flatMap((m) => {
                            const c = cell(m.id, date);
                            const mine = isMe(m.id);
                            const canEdit = editable(m.id, date);
                            const awaiting = pendingByCell.has(`${m.id}|${date}`);
                            return FIELDS.map((f, i) => {
                              const edge = i === 2 ? 'border-r border-slate-200 dark:border-slate-700' : '';
                              return canEdit && !awaiting ? (
                                <td key={`${m.id}-${f}`} className={`px-1 py-1.5 ${edge}`}>
                                  <input
                                    type="number"
                                    min={0}
                                    value={c[f] || 0}
                                    onChange={(e) => setLocal(m.id, date, f, parseInt(e.target.value, 10))}
                                    onBlur={() => saveDay(m.id, date)}
                                    title={date < today ? strings.meals.pastDayTooltip : undefined}
                                    className="w-14 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1 py-1.5 text-center focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                  />
                                </td>
                              ) : (
                                <td
                                  key={`${m.id}-${f}`}
                                  title={awaiting ? strings.meals.pendingApprovalTooltip : undefined}
                                  className={`px-2 py-2 ${edge} ${
                                    awaiting ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' : mine ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  {c[f] || 0}
                                </td>
                              );
                            });
                          })}
                          <td className="px-4 py-2 font-semibold">{round2(logged.byDay[date] ?? 0)}</td>
                          <td className="px-4 py-2 text-slate-600 dark:text-slate-400" title={strings.meals.rate.runningRateHint}>
                            {info && info.runningRate ? info.runningRate.toFixed(2) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {summary && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-semibold">
                        <td className="sticky left-0 z-10 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-left">{strings.common.total}</td>
                        {members.map((m) => (
                          <td key={m.id} colSpan={3} className="border-r border-slate-200 dark:border-slate-700 px-3 py-3">
                            {round2(logged.byMember[m.id] ?? 0)}
                          </td>
                        ))}
                        <td className="px-4 py-3">{logged.total}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400" title={strings.meals.rate.runningRateHint}>
                          {summary.days.length > 0 && summary.days[summary.days.length - 1].runningRate > 0
                            ? summary.days[summary.days.length - 1].runningRate.toFixed(2)
                            : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {rateNote && (
                <p className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                  {rateNote}
                </p>
              )}

              {summary && belongsToGroup && (
                <MealRateCard
                  days={myDailyRates}
                  today={today}
                  monthRate={finalRunningRate}
                  rateMode={summary.rateMode ?? ''}
                  myMeals={me?.meals ?? 0}
                  myCost={me?.cost ?? 0}
                />
              )}

              <MonthlySummary summary={summary} currentUserId={user?.id} />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function DayRangeBar({
  visibleDays,
  totalDays,
  hiddenDayCount,
  showWholeMonth,
  onToggle
}: {
  visibleDays: string[];
  totalDays: number;
  hiddenDayCount: number;
  showWholeMonth: boolean;
  onToggle: () => void;
}) {
  if (visibleDays.length === 0) return null;

  const copy = strings.meals.window;
  const collapsible = hiddenDayCount > 0 || showWholeMonth;
  const first = visibleDays[0];
  const last = visibleDays[visibleDays.length - 1];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {hiddenDayCount > 0 ? copy.showingRange(dayLabel(first), dayLabel(last)) : copy.showingAll(totalDays)}
        </p>
        {hiddenDayCount > 0 && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{copy.hiddenNote(hiddenDayCount)}</p>}
      </div>

      {collapsible && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={showWholeMonth}
          className="min-h-[2.25rem] shrink-0 rounded-full border border-slate-300 dark:border-slate-600 px-4 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
        >
          {showWholeMonth ? copy.showAroundToday : copy.showWholeMonth(totalDays)}
        </button>
      )}
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
      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{change.summary}</p>
      {change.reason && <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">“{change.reason}”</p>}
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
    <div className="rounded-3xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">
        {strings.meals.waitingForYouTitle}
        <span className="ml-2 rounded-full bg-white dark:bg-slate-800 px-2.5 py-0.5 text-sm font-medium text-amber-700 dark:text-amber-400 ring-1 ring-amber-300">
          {changes.length}
        </span>
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {strings.meals.waitingForYouHint}
      </p>

      <ul className="mt-4 space-y-3">
        {changes.map((change) => (
          <li
            key={change.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white dark:bg-slate-800 p-4 ring-1 ring-amber-200"
          >
            <ChangeSummary change={change} />
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => onDecide(change.id, 'APPROVED')}
                className="rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition-all active:translate-y-px"
              >
                {strings.meals.approve}
              </button>
              <button
                type="button"
                onClick={() => onDecide(change.id, 'REJECTED')}
                className="rounded-full border border-slate-300 dark:border-slate-600 px-4 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                {strings.meals.decline}
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
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">{strings.meals.waitingForSupervisorTitle}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {strings.meals.waitingForSupervisorHint}
      </p>
      <ul className="mt-4 space-y-3">
        {changes.map((change) => (
          <li
            key={change.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 p-4"
          >
            <ChangeSummary change={change} />
            <button
              type="button"
              onClick={() => onWithdraw(change.id)}
              className="shrink-0 rounded-full border border-slate-300 dark:border-slate-600 px-4 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              {strings.meals.withdraw}
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
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{strings.meals.monthlySummary}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {strings.meals.totalSpent(taka(summary.totals.expense), summary.totals.meals)}
        </p>
      </div>
      <div className="mt-4 hidden overflow-x-auto sm:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-3 py-2">{strings.common.member}</th>
              <th className="px-3 py-2 text-right">{strings.meals.colMeals}</th>
              <th className="px-3 py-2 text-right">{strings.meals.colCost}</th>
              <th className="px-3 py-2 text-right">{strings.meals.colPaid}</th>
              <th className="px-3 py-2 text-right">{strings.meals.colBalance}</th>
            </tr>
          </thead>
          <tbody>
            {summary.members.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                <td className="px-3 py-2 font-medium">
                  {m.name}
                  {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600 dark:text-green-400">{strings.common.you}</span>}
                </td>
                <td className="px-3 py-2 text-right">{m.meals}</td>
                <td className="px-3 py-2 text-right">{taka(m.cost)}</td>
                <td className="px-3 py-2 text-right">{taka(m.paid)}</td>
                <td className={`px-3 py-2 text-right font-medium ${m.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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
          <li key={m.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {m.name}
                {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600 dark:text-green-400">{strings.common.you}</span>}
              </p>
              <span className={`font-semibold ${m.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {m.balance >= 0 ? '+' : '−'}
                {Math.abs(m.balance).toFixed(2)}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {strings.meals.mobileSummaryLine(m.meals, taka(m.cost), taka(m.paid))}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">{strings.meals.balanceFootnote}</p>

      <MealRateTrendChart days={summary.days} currentUserId={currentUserId} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-green-600 dark:text-green-400' : tone === 'red' ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100';
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold sm:text-2xl ${color}`}>{value}</p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm text-slate-600 dark:text-slate-400 sm:p-6">{children}</div>;
}
