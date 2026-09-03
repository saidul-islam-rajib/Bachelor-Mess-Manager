import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, Modal, useConfirm } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';
import { api, errorMessage } from '@/lib/api-client';
import { computeEqualSplitDays, groupConsecutiveDays } from '@/lib/bazar-schedule';
import { formatDayKey, initialsOf } from '@/lib/format';
import { strings } from '@/lib/i18n';

const scheduleStrings = strings.bazarSchedule;

const MEMBER_TONES = [
  { dot: 'bg-sky-500', cell: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200' },
  { dot: 'bg-emerald-500', cell: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200' },
  { dot: 'bg-violet-500', cell: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-200' },
  { dot: 'bg-amber-500', cell: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200' },
  { dot: 'bg-rose-500', cell: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200' },
  { dot: 'bg-teal-500', cell: 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-500/30 dark:bg-teal-500/15 dark:text-teal-200' },
  { dot: 'bg-indigo-500', cell: 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200' },
  { dot: 'bg-orange-500', cell: 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-200' },
  { dot: 'bg-cyan-500', cell: 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/15 dark:text-cyan-200' },
  { dot: 'bg-fuchsia-500', cell: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/15 dark:text-fuchsia-200' },
  { dot: 'bg-lime-500', cell: 'border-lime-200 bg-lime-50 text-lime-900 dark:border-lime-500/30 dark:bg-lime-500/15 dark:text-lime-200' },
  { dot: 'bg-blue-500', cell: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200' }
] as const;

type LockedReason = 'GROUP_CLOSED' | 'MONTH_CLOSED' | 'NO_MEMBERS' | null;

type BazarDay = {
  day: number;
  date: string;
  userId: string | null;
  userName: string | null;
};

type BazarMember = {
  id: string;
  name: string;
  dayCount: number;
};

type BazarScheduleData = {
  monthKey: string;
  totalDays: number;
  editable: boolean;
  lockedReason: LockedReason;
  canManage: boolean;
  currentUserId: string;
  members: BazarMember[];
  days: BazarDay[];
};

type Assignment = { day: number; userId: string | null };

function lockedMessage(reason: LockedReason): string {
  if (reason === 'GROUP_CLOSED') return scheduleStrings.lockedGroupClosed;
  if (reason === 'MONTH_CLOSED') return scheduleStrings.lockedMonthClosed;
  return scheduleStrings.lockedNoMembers;
}

function applyAssignments(data: BazarScheduleData, assignments: Assignment[]): BazarScheduleData {
  const nameById = new Map(data.members.map((member) => [member.id, member.name]));
  const changeByDay = new Map(assignments.map((entry) => [entry.day, entry.userId]));

  const days = data.days.map((day) => {
    if (!changeByDay.has(day.day)) return day;
    const userId = changeByDay.get(day.day) ?? null;
    return { ...day, userId, userName: userId ? (nameById.get(userId) ?? null) : null };
  });

  const counts = new Map<string, number>();
  for (const day of days) {
    if (day.userId) counts.set(day.userId, (counts.get(day.userId) ?? 0) + 1);
  }

  return {
    ...data,
    days,
    members: data.members.map((member) => ({ ...member, dayCount: counts.get(member.id) ?? 0 }))
  };
}

function daysLabel(days: BazarDay[]): string {
  const ranges = groupConsecutiveDays(days.map((day) => day.day));
  if (ranges.length === 0) return scheduleStrings.noDays;

  const dateByDay = new Map(days.map((day) => [day.day, day.date]));
  return ranges
    .map((range) => {
      const endLabel = formatDayKey(dateByDay.get(range.end)!, 'dayMonth');
      if (range.start === range.end) return endLabel;
      return scheduleStrings.dayRange(String(range.start), endLabel);
    })
    .join(', ');
}

function MemberRow({
  member,
  tone,
  days,
  isCurrentUser,
  editable,
  onEdit
}: {
  member: BazarMember;
  tone: (typeof MEMBER_TONES)[number];
  days: BazarDay[];
  isCurrentUser: boolean;
  editable: boolean;
  onEdit: () => void;
}) {
  const content = (
    <>
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
      <Avatar name={member.name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium text-slate-900 dark:text-slate-100">
            {member.name}
            {isCurrentUser && <span className="ml-1 text-xs font-normal text-brand-700">{strings.common.you}</span>}
          </span>
          <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
            {scheduleStrings.dayCount(member.dayCount)}
          </span>
        </span>
        <span className={`mt-0.5 block text-xs ${days.length > 0 ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>
          {daysLabel(days)}
        </span>
      </span>
    </>
  );

  if (!editable) {
    return <li className="flex items-start gap-2.5 px-3.5 py-3 sm:px-4">{content}</li>;
  }

  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        aria-label={scheduleStrings.editMember(member.name)}
        className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/60 sm:px-4"
      >
        {content}
      </button>
    </li>
  );
}

function CalendarGrid({
  data,
  toneByUserId,
  onPickDay
}: {
  data: BazarScheduleData;
  toneByUserId: Map<string, (typeof MEMBER_TONES)[number]>;
  onPickDay: (day: BazarDay) => void;
}) {
  const firstWeekday = new Date(`${data.days[0].date}T00:00:00.000Z`).getUTCDay();

  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
      {[0, 1, 2, 3, 4, 5, 6].map((weekday) => (
        <div key={weekday} className="pb-1 text-center text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500">
          {strings.weekdays[weekday as keyof typeof strings.weekdays].short.charAt(0)}
        </div>
      ))}

      {Array.from({ length: firstWeekday }, (_, index) => (
        <div key={`blank-${index}`} />
      ))}

      {data.days.map((day) => {
        const tone = day.userId ? toneByUserId.get(day.userId) : undefined;
        const className = tone
          ? tone.cell
          : 'border-dashed border-slate-200 bg-slate-50/60 text-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-500';

        const inner = (
          <>
            <span className="text-[11px] font-semibold leading-none">{day.day}</span>
            <span className="mt-0.5 block truncate text-[10px] leading-tight opacity-90">
              {day.userName ? initialsOf(day.userName) : '·'}
            </span>
          </>
        );

        if (!data.editable) {
          return (
            <div key={day.day} className={`flex min-h-[3rem] flex-col items-center justify-center rounded-lg border px-0.5 ${className}`}>
              {inner}
            </div>
          );
        }

        return (
          <button
            key={day.day}
            type="button"
            onClick={() => onPickDay(day)}
            aria-label={scheduleStrings.dayLabel(formatDayKey(day.date, 'dayMonth'))}
            className={`flex min-h-[3rem] flex-col items-center justify-center rounded-lg border px-0.5 transition-transform active:scale-95 ${className}`}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}

export default function BazarSchedule({ groupId, month }: { groupId: string; month: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<BazarScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dayPicker, setDayPicker] = useState<BazarDay | null>(null);
  const [memberPicker, setMemberPicker] = useState<BazarMember | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<BazarScheduleData>(`/api/groups/${groupId}/bazar-schedule`, { query: { month } });
      setData(result);
    } catch (err) {
      setError(errorMessage(err, scheduleStrings.loadFailed));
    } finally {
      setLoading(false);
    }
  }, [groupId, month]);

  useEffect(() => {
    load();
  }, [load]);

  const toneByUserId = useMemo(() => {
    const map = new Map<string, (typeof MEMBER_TONES)[number]>();
    data?.members.forEach((member, index) => map.set(member.id, MEMBER_TONES[index % MEMBER_TONES.length]));
    return map;
  }, [data]);

  const daysByUserId = useMemo(() => {
    const map = new Map<string, BazarDay[]>();
    data?.days.forEach((day) => {
      if (!day.userId) return;
      const list = map.get(day.userId) ?? [];
      list.push(day);
      map.set(day.userId, list);
    });
    return map;
  }, [data]);

  const save = useCallback(
    async (assignments: Assignment[], previous: BazarScheduleData) => {
      setSaving(true);
      try {
        const result = await api.put<BazarScheduleData>(
          `/api/groups/${groupId}/bazar-schedule`,
          { assignments },
          { query: { month } }
        );
        setData(result);
      } catch (err) {
        setData(previous);
        toast.error(errorMessage(err, scheduleStrings.saveFailed));
      } finally {
        setSaving(false);
      }
    },
    [groupId, month, toast]
  );

  function assign(day: number, userId: string | null) {
    if (!data) return;
    const previous = data;
    setData(applyAssignments(data, [{ day, userId }]));
    void save([{ day, userId }], previous);
  }

  async function handleAutoFill() {
    if (!data) return;
    const proceed = await confirm({
      title: scheduleStrings.autoFillConfirmTitle,
      message: scheduleStrings.autoFillConfirmMessage,
      destructive: true
    });
    if (!proceed) return;

    const assignments = computeEqualSplitDays(
      data.members.map((member) => member.id),
      data.totalDays
    );
    const previous = data;
    setData(applyAssignments(data, assignments));
    void save(assignments, previous);
  }

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{strings.common.loading}</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{error || scheduleStrings.loadFailed}</p>;
  }

  if (data.members.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{scheduleStrings.lockedNoMembers}</p>;
  }

  return (
    <div className="space-y-4">
      {!data.editable && <p className="text-xs text-amber-700 dark:text-amber-400">{lockedMessage(data.lockedReason)}</p>}

      {data.editable && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={saving}
            title={scheduleStrings.autoFillHint}
            className="min-h-[2.25rem] rounded-full border border-slate-200 px-3.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            {scheduleStrings.autoFill}
          </button>
        </div>
      )}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        {data.members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            tone={toneByUserId.get(member.id)!}
            days={daysByUserId.get(member.id) ?? []}
            isCurrentUser={member.id === data.currentUserId}
            editable={data.editable}
            onEdit={() => setMemberPicker(member)}
          />
        ))}
      </ul>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {scheduleStrings.calendarTitle}
        </p>
        <CalendarGrid data={data} toneByUserId={toneByUserId} onPickDay={setDayPicker} />
      </div>

      <Modal
        open={dayPicker !== null}
        onClose={() => setDayPicker(null)}
        title={dayPicker ? scheduleStrings.assignDayTitle(formatDayKey(dayPicker.date, 'weekdayDayMonth')) : ''}
        description={scheduleStrings.assignDayHint}
        size="sm"
      >
        <ul className="space-y-1.5">
          {data.members.map((member) => {
            const selected = dayPicker?.userId === member.id;
            return (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (dayPicker) assign(dayPicker.day, member.id);
                    setDayPicker(null);
                  }}
                  className={`flex min-h-[2.75rem] w-full items-center gap-2.5 rounded-xl border px-3 text-left text-sm transition-colors ${
                    selected
                      ? 'border-brand-300 bg-brand-50 font-medium text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneByUserId.get(member.id)!.dot}`} aria-hidden />
                  <Avatar name={member.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{member.name}</span>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {scheduleStrings.dayCount(member.dayCount)}
                  </span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => {
                if (dayPicker) assign(dayPicker.day, null);
                setDayPicker(null);
              }}
              className={`min-h-[2.75rem] w-full rounded-xl border px-3 text-left text-sm transition-colors ${
                dayPicker && !dayPicker.userId
                  ? 'border-brand-300 bg-brand-50 font-medium text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/60'
              }`}
            >
              {scheduleStrings.nobody}
            </button>
          </li>
        </ul>
      </Modal>

      <Modal
        open={memberPicker !== null}
        onClose={() => setMemberPicker(null)}
        title={memberPicker ? scheduleStrings.memberDaysTitle(memberPicker.name) : ''}
        description={scheduleStrings.memberDaysHint}
        size="md"
      >
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {data.days.map((day) => {
            const mine = memberPicker !== null && day.userId === memberPicker.id;
            const takenBy = !mine && day.userId ? day.userName : null;
            return (
              <button
                key={day.day}
                type="button"
                onClick={() => {
                  if (!memberPicker) return;
                  assign(day.day, mine ? null : memberPicker.id);
                }}
                className={`flex min-h-[2.75rem] flex-col items-center justify-center rounded-lg border px-0.5 transition-transform active:scale-95 ${
                  mine
                    ? 'border-brand-400 bg-brand-500 text-white dark:border-brand-400 dark:bg-brand-500'
                    : takenBy
                      ? 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-500'
                      : 'border-dashed border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'
                }`}
              >
                <span className="text-[11px] font-semibold leading-none">{day.day}</span>
                {takenBy && <span className="mt-0.5 block truncate text-[9px] leading-tight">{initialsOf(takenBy)}</span>}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
