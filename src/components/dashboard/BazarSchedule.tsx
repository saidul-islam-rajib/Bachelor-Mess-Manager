import { useCallback, useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import { Avatar, useConfirm } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';
import { api, errorMessage } from '@/lib/api-client';
import { computeEqualSplitDays } from '@/lib/bazar-schedule';
import { formatDayKey } from '@/lib/format';
import { strings } from '@/lib/i18n';

const scheduleStrings = strings.bazarSchedule;

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

type DragPayload = { userId: string; name: string; fromDay?: number };

function lockedMessage(reason: LockedReason): string {
  if (reason === 'GROUP_CLOSED') return scheduleStrings.lockedGroupClosed;
  if (reason === 'MONTH_CLOSED') return scheduleStrings.lockedMonthClosed;
  return scheduleStrings.lockedNoMembers;
}

function applyAssignments(data: BazarScheduleData, assignments: Assignment[]): BazarScheduleData {
  const memberById = new Map(data.members.map((member) => [member.id, member.name]));
  const nextDays = data.days.map((day) => {
    const change = assignments.find((entry) => entry.day === day.day);
    if (!change) return day;
    return {
      ...day,
      userId: change.userId,
      userName: change.userId ? (memberById.get(change.userId) ?? day.userName) : null
    };
  });

  const dayCountByMember = new Map<string, number>();
  for (const day of nextDays) {
    if (day.userId) dayCountByMember.set(day.userId, (dayCountByMember.get(day.userId) ?? 0) + 1);
  }

  return {
    ...data,
    days: nextDays,
    members: data.members.map((member) => ({ ...member, dayCount: dayCountByMember.get(member.id) ?? 0 }))
  };
}

function MemberChip({ userId, name, fromDay }: { userId: string; name: string; fromDay?: number }) {
  const dragId = fromDay ? `day-${fromDay}` : `roster-${userId}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { userId, name, fromDay } satisfies DragPayload
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20 } : undefined;

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      aria-label={fromDay ? scheduleStrings.moveChip(name, fromDay) : scheduleStrings.dragChip(name)}
      className={`flex w-full cursor-grab touch-none items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-1 text-left active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <Avatar name={name} size="sm" />
      <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">{name}</span>
    </button>
  );
}

function DayCell({
  bazarDay,
  members,
  editable,
  onAssign
}: {
  bazarDay: BazarDay;
  members: BazarMember[];
  editable: boolean;
  onAssign: (day: number, userId: string | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${bazarDay.day}`, data: { day: bazarDay.day } });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[5.5rem] flex-col gap-1 rounded-xl border p-1.5 ${
        isOver
          ? 'border-brand-400 bg-brand-50/60 dark:border-brand-500 dark:bg-brand-500/10'
          : bazarDay.userId
            ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
            : 'border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40'
      }`}
    >
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
          {formatDayKey(bazarDay.date, 'dayMonth')}
        </span>
        {editable && bazarDay.userId && (
          <button
            type="button"
            onClick={() => onAssign(bazarDay.day, null)}
            aria-label={scheduleStrings.clearDay(bazarDay.userName ?? '')}
            className="text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400"
          >
            ×
          </button>
        )}
      </div>

      {bazarDay.userId ? (
        editable ? (
          <MemberChip userId={bazarDay.userId} name={bazarDay.userName ?? ''} fromDay={bazarDay.day} />
        ) : (
          <span className="flex items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 px-1.5 py-1">
            <Avatar name={bazarDay.userName ?? ''} size="sm" />
            <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">{bazarDay.userName}</span>
          </span>
        )
      ) : (
        <span className="flex-1 text-[11px] text-slate-300 dark:text-slate-600">{scheduleStrings.unassigned}</span>
      )}

      {editable && (
        <select
          aria-label={scheduleStrings.selectLabel(bazarDay.day)}
          value={bazarDay.userId ?? ''}
          onChange={(event) => onAssign(bazarDay.day, event.target.value || null)}
          className="mt-auto w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-0.5 text-[11px] text-slate-500 dark:text-slate-400"
        >
          <option value="">{scheduleStrings.unassigned}</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      )}
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
  const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null);

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  function handleAssign(day: number, userId: string | null) {
    if (!data || saving) return;
    const previous = data;
    setData(applyAssignments(data, [{ day, userId }]));
    void save([{ day, userId }], previous);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDrag((event.active.data.current as DragPayload) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    if (!data || saving) return;

    const { active, over } = event;
    if (!over) return;

    const targetDay = (over.data.current as { day?: number } | undefined)?.day;
    const payload = active.data.current as DragPayload | undefined;
    if (targetDay === undefined || !payload) return;
    if (payload.fromDay === targetDay) return;

    const assignments: Assignment[] = [{ day: targetDay, userId: payload.userId }];
    if (payload.fromDay !== undefined) assignments.push({ day: payload.fromDay, userId: null });

    const previous = data;
    setData(applyAssignments(data, assignments));
    void save(assignments, previous);
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

  const firstWeekday = new Date(`${data.days[0].date}T00:00:00.000Z`).getUTCDay();
  const leadingBlanks = Array.from({ length: firstWeekday }, (_, index) => index);

  const grid = (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6].map((weekday) => (
          <div key={weekday} className="text-center text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500">
            {strings.weekdays[weekday as keyof typeof strings.weekdays].short}
          </div>
        ))}
        {leadingBlanks.map((blank) => (
          <div key={`blank-${blank}`} />
        ))}
        {data.days.map((bazarDay) => (
          <DayCell key={bazarDay.day} bazarDay={bazarDay} members={data.members} editable={data.editable} onAssign={handleAssign} />
        ))}
      </div>
    </div>
  );

  const roster = (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {scheduleStrings.rosterTitle}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{scheduleStrings.rosterHint}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.members.map((member) => (
            <div key={member.id} className="flex w-32 flex-col gap-1">
              <MemberChip userId={member.id} name={member.name} />
              <span className="text-center text-[10px] text-slate-400 dark:text-slate-500">
                {scheduleStrings.dayCount(member.dayCount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleAutoFill}
        disabled={saving}
        title={scheduleStrings.autoFillHint}
        className="shrink-0 rounded-full border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
      >
        {scheduleStrings.autoFill}
      </button>
    </div>
  );

  return (
    <div>
      {!data.editable && <p className="text-xs text-amber-700 dark:text-amber-400">{lockedMessage(data.lockedReason)}</p>}

      {data.editable ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {roster}
          {grid}
          <DragOverlay>{activeDrag && <MemberChip userId={activeDrag.userId} name={activeDrag.name} />}</DragOverlay>
        </DndContext>
      ) : (
        grid
      )}
    </div>
  );
}
