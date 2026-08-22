import { strings } from '@/lib/i18n';
import { formatDayKey } from '@/lib/format';

export type PendingMealCounts = { breakfast: number; lunch: number; dinner: number };

export type PendingMealChange = {
  id: string;
  userId: string;
  userName: string | null;
  date: string;
  from: PendingMealCounts;
  to: PendingMealCounts;
  summary: string;
  reason: string | null;
  createdAt: string;
  groupName?: string;
};

function dayLabel(date: string) {
  return formatDayKey(date, 'weekdayDayMonth');
}

export function ChangeSummary({ change }: { change: PendingMealChange }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium">
        {change.userName ? `${change.userName} · ` : ''}
        {dayLabel(change.date)}
        {change.groupName && <span className="font-normal text-slate-500 dark:text-slate-400"> · {change.groupName}</span>}
      </p>
      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{change.summary}</p>
      {change.reason && <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">“{change.reason}”</p>}
    </div>
  );
}

export function PendingMealApprovals({
  changes,
  onDecide
}: {
  changes: PendingMealChange[];
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
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{strings.meals.waitingForYouHint}</p>

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

export default PendingMealApprovals;
