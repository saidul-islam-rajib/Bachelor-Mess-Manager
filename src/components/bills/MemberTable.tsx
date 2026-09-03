import { useState, type ReactNode } from 'react';
import { PositionPill, StatusPill, positionOf } from '@/components/bills/StatusPill';
import { BILL_KIND_COPY, KIND_ORDER, type MemberBillLine, type MemberSummary } from '@/lib/bill-view';
import { formatCurrency, formatDayKey } from '@/lib/format';
import { strings } from '@/lib/i18n';

const taka = formatCurrency;
const memberTable = strings.bills.memberTable;

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 text-slate-400 dark:text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function Figure({
  label,
  value,
  className = '',
  strong
}: {
  label: string;
  value: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <span className="block min-w-0">
      <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</span>
      <span
        className={`mt-0.5 block truncate tabular-nums ${strong ? 'text-base font-bold' : 'text-sm font-medium'} ${
          className || 'text-slate-700 dark:text-slate-300'
        }`}
      >
        {value}
      </span>
    </span>
  );
}

function netLabel(net: number) {
  if (net > 0) return `+${taka(net)}`;
  if (net < 0) return taka(-net);
  return taka(0);
}

function LineList({
  lines,
  labels,
  onOpenBill
}: {
  lines: MemberBillLine[];
  labels: Record<string, string>;
  onOpenBill?: (billId: string) => void;
}) {
  return (
    <ul className="mt-1.5 space-y-1.5">
      {lines.map((line) => (
        <li key={line.billId} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 sm:flex sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{labels[line.type] ?? line.type}</p>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              {formatDayKey(line.date, 'dayMonth')}
              {line.payerName && ` · ${strings.bills.paidByName(line.payerName)}`}
            </p>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 sm:mt-0 sm:w-64 sm:shrink-0">
            <Figure label={strings.bills.colShare} value={taka(line.share)} />
            <Figure label={strings.bills.colPaid} value={line.paid > 0 ? taka(line.paid) : '—'} className="text-slate-900 dark:text-slate-100" />
            {line.outstanding > 0 ? (
              <Figure label={strings.bills.colDue} value={taka(line.outstanding)} className="text-rose-600" />
            ) : line.advance > 0 ? (
              <Figure label={memberTable.backDt} value={`+${taka(line.advance)}`} className="text-teal-700 dark:text-teal-400" />
            ) : (
              <Figure label={strings.bills.colDue} value="—" className="text-slate-300 dark:text-slate-600" />
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 sm:mt-0 sm:w-32 sm:shrink-0 sm:justify-end">
            <StatusPill entry={line} />
            {onOpenBill && (
              <button
                type="button"
                onClick={() => onOpenBill(line.billId)}
                className="inline-flex min-h-[1.9rem] items-center rounded-full border border-slate-200 dark:border-slate-700 px-2.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                {memberTable.open}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LineRows({
  lines,
  labels,
  onOpenBill
}: {
  lines: MemberBillLine[];
  labels: Record<string, string>;
  onOpenBill?: (billId: string) => void;
}) {
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    lines: lines.filter((line) => line.kind === kind)
  })).filter((group) => group.lines.length > 0);

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.kind}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {BILL_KIND_COPY[group.kind].title}
          </p>
          <LineList lines={group.lines} labels={labels} onOpenBill={onOpenBill} />
        </div>
      ))}
    </div>
  );
}

export function MemberRow({
  row,
  labels,
  onOpenBill
}: {
  row: MemberSummary;
  labels: Record<string, string>;
  onOpenBill?: (billId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const position = positionOf(row.net);

  return (
    <li className={row.isCurrentUser ? 'bg-brand-50/40 dark:bg-brand-500/10' : row.net > 0 ? 'bg-teal-50/40 dark:bg-teal-500/10' : 'bg-white dark:bg-slate-800'}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="w-full px-3.5 py-3 text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/70 sm:px-4"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="block min-w-0">
            <span className="block truncate font-semibold text-slate-900 dark:text-slate-100">
              {row.userName}
              {row.isCurrentUser && <span className="ml-1.5 text-xs font-normal text-brand-700">{strings.common.you}</span>}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              {strings.bills.billCount(row.billCount)}
              {row.unpaidCount > 0 && ` ${memberTable.notPaidYet(row.unpaidCount)}`}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <PositionPill net={row.net} />
            <Chevron open={open} />
          </span>
        </span>

        <span className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 px-3 py-2 sm:grid-cols-4 sm:bg-transparent sm:px-0 sm:py-0">
          <Figure label={strings.bills.colShare} value={taka(row.share)} />
          <Figure label={strings.bills.colPaid} value={taka(row.paid)} className="text-slate-900 dark:text-slate-100" />
          <Figure
            label={memberTable.unpaidOnBills}
            value={row.outstanding > 0 ? taka(row.outstanding) : '—'}
            className={row.outstanding > 0 ? 'text-rose-600' : 'text-slate-300 dark:text-slate-600'}
          />
          <Figure strong label={memberTable.final} value={netLabel(row.net)} className={position.text} />
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 px-3.5 py-3 sm:px-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {memberTable.shareMinusPaid(taka(row.share), taka(row.paid))}{' '}
            <span className={`font-semibold ${position.text}`}>
              {row.net > 0
                ? memberTable.backToName(taka(row.net), row.userName)
                : row.net < 0
                  ? memberTable.stillToPay(taka(-row.net))
                  : memberTable.nothingOutstanding}
            </span>
            {row.outstanding > 0 && row.advance > 0 && (
              <span className="text-slate-500 dark:text-slate-400">
                {' '}
                {memberTable.unpaidOverpaidNote(taka(row.outstanding), taka(row.advance))}
              </span>
            )}
          </p>
          <div className="mt-2.5">
            <LineRows lines={row.lines} labels={labels} onOpenBill={onOpenBill} />
          </div>
        </div>
      )}
    </li>
  );
}

export function MemberTable({
  summaries,
  labels,
  emptyText,
  onOpenBill
}: {
  summaries: MemberSummary[];
  labels: Record<string, string>;
  emptyText: string;
  onOpenBill?: (billId: string) => void;
}) {
  if (summaries.length === 0) {
    return <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>;
  }

  return (
    <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
      {summaries.map((row) => (
        <MemberRow key={row.userId} row={row} labels={labels} onOpenBill={onOpenBill} />
      ))}
    </ul>
  );
}
