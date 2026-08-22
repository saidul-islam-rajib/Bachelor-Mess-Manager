import { EXPENSE_ACTIONS } from '@/lib/constants';
import { formatCurrency, formatInstant } from '@/lib/format';
import { strings } from '@/lib/i18n';

export type HistoryEvent = {
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

const TONES: Record<string, string> = {
  [EXPENSE_ACTIONS.CREATED]: 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 ring-green-600/20',
  [EXPENSE_ACTIONS.UPDATED]: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-600/20',
  [EXPENSE_ACTIONS.DELETED]: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-red-600/20'
};

export function describeHistoryEvent(event: HistoryEvent, fallbackLabel: string): string {
  const copy = strings.history;
  const label = event.noteTo || event.noteFrom || fallbackLabel;

  if (event.action === EXPENSE_ACTIONS.CREATED) {
    return copy.added(label, event.amountTo !== null ? formatCurrency(event.amountTo) : '');
  }
  if (event.action === EXPENSE_ACTIONS.DELETED) {
    return copy.deleted(label, event.amountFrom !== null ? formatCurrency(event.amountFrom) : '');
  }

  const parts: string[] = [];
  if (event.amountFrom !== null && event.amountTo !== null) {
    parts.push(copy.amountChange(formatCurrency(event.amountFrom), formatCurrency(event.amountTo)));
  }
  if (event.dateFrom && event.dateTo) parts.push(copy.dateChange(event.dateFrom, event.dateTo));
  if (event.noteFrom !== null && event.noteTo !== null) {
    parts.push(copy.noteChange(event.noteFrom, event.noteTo));
  }

  return copy.changed(parts.join(', '));
}

export function HistoryList({
  history,
  fallbackLabel,
  emptyText
}: {
  history: HistoryEvent[];
  fallbackLabel: string;
  emptyText?: string;
}) {
  const copy = strings.history;

  if (history.length === 0) {
    return <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{emptyText ?? copy.empty}</p>;
  }

  return (
    <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">
      {history.map((event) => (
        <li key={event.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
          <div className="min-w-0">
            <p className="text-sm">
              <span className="font-medium">{event.actorName}</span>{' '}
              <span className="text-slate-600 dark:text-slate-400">{describeHistoryEvent(event, fallbackLabel)}</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{formatInstant(event.at, 'dayMonthTime')}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
              TONES[event.action] ?? TONES[EXPENSE_ACTIONS.UPDATED]
            }`}
          >
            {copy.actions[event.action] ?? event.action}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ChangeHistory({
  history,
  fallbackLabel,
  subtitle
}: {
  history: HistoryEvent[];
  fallbackLabel: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">{strings.history.title}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      <HistoryList history={history} fallbackLabel={fallbackLabel} />
    </div>
  );
}
