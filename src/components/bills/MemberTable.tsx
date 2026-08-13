import { useState, type ReactNode } from 'react';
import { PositionPill, StatusPill, positionOf } from '@/components/bills/StatusPill';
import { BILL_KIND_COPY, KIND_ORDER, type MemberBillLine, type MemberSummary } from '@/lib/bill-view';
import { formatCurrency, formatDayKey } from '@/lib/format';

const taka = formatCurrency;

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
      className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Figure({
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
      <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span
        className={`mt-0.5 block truncate tabular-nums ${strong ? 'text-base font-bold' : 'text-sm font-medium'} ${
          className || 'text-slate-700'
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
        <li key={line.billId} className="rounded-xl border border-slate-100 bg-white p-2.5 sm:flex sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{labels[line.type] ?? line.type}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {formatDayKey(line.date, 'dayMonth')}
              {line.payerName && ` · paid by ${line.payerName}`}
            </p>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 sm:mt-0 sm:w-64 sm:shrink-0">
            <Figure label="Share" value={taka(line.share)} />
            <Figure label="Paid" value={line.paid > 0 ? taka(line.paid) : '—'} className="text-slate-900" />
            {line.outstanding > 0 ? (
              <Figure label="Due" value={taka(line.outstanding)} className="text-rose-600" />
            ) : line.advance > 0 ? (
              <Figure label="Back" value={`+${taka(line.advance)}`} className="text-teal-700" />
            ) : (
              <Figure label="Due" value="—" className="text-slate-300" />
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 sm:mt-0 sm:w-32 sm:shrink-0 sm:justify-end">
            <StatusPill entry={line} />
            {onOpenBill && (
              <button
                type="button"
                onClick={() => onOpenBill(line.billId)}
                className="inline-flex min-h-[1.9rem] items-center rounded-full border border-slate-200 px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                Open
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
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
    <li className={row.isCurrentUser ? 'bg-brand-50/40' : row.net > 0 ? 'bg-teal-50/40' : 'bg-white'}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="w-full px-3.5 py-3 text-left transition-colors hover:bg-slate-50/70 sm:px-4"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="block min-w-0">
            <span className="block truncate font-semibold text-slate-900">
              {row.userName}
              {row.isCurrentUser && <span className="ml-1.5 text-xs font-normal text-brand-700">(you)</span>}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              {row.billCount} {row.billCount === 1 ? 'bill' : 'bills'}
              {row.unpaidCount > 0 && ` · ${row.unpaidCount} not paid yet`}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <PositionPill net={row.net} />
            <Chevron open={open} />
          </span>
        </span>

        <span className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-xl bg-slate-50/80 px-3 py-2 sm:grid-cols-4 sm:bg-transparent sm:px-0 sm:py-0">
          <Figure label="Share" value={taka(row.share)} />
          <Figure label="Paid" value={taka(row.paid)} className="text-slate-900" />
          <Figure
            label="Unpaid on bills"
            value={row.outstanding > 0 ? taka(row.outstanding) : '—'}
            className={row.outstanding > 0 ? 'text-rose-600' : 'text-slate-300'}
          />
          <Figure strong label="Final" value={netLabel(row.net)} className={position.text} />
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-3.5 py-3 sm:px-4">
          <p className="text-xs text-slate-600">
            Share {taka(row.share)} − paid {taka(row.paid)} ={' '}
            <span className={`font-semibold ${position.text}`}>
              {row.net > 0
                ? `${taka(row.net)} back to ${row.userName}`
                : row.net < 0
                  ? `${taka(-row.net)} still to pay`
                  : 'nothing outstanding'}
            </span>
            {row.outstanding > 0 && row.advance > 0 && (
              <span className="text-slate-500">
                {' '}
                — {taka(row.outstanding)} unpaid on some bills, {taka(row.advance)} overpaid on others.
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
    return <p className="mt-3 text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
      {summaries.map((row) => (
        <MemberRow key={row.userId} row={row} labels={labels} onOpenBill={onOpenBill} />
      ))}
    </ul>
  );
}
