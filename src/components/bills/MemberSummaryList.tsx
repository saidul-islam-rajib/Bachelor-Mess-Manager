import { useState } from 'react';
import { StatusPill } from '@/components/bills/StatusPill';
import {
  BILL_KIND_COPY,
  KIND_ORDER,
  type MemberBillLine,
  type MemberSummary
} from '@/lib/bill-view';
import { formatCurrency, formatDayKey } from '@/lib/format';

const taka = formatCurrency;

export function Money({ value, tone }: { value: number; tone?: 'due' | 'back' | 'paid' }) {
  if (value <= 0) return <span className="text-slate-300">—</span>;
  const color =
    tone === 'due'
      ? 'font-semibold text-rose-600'
      : tone === 'back'
        ? 'font-semibold text-teal-700'
        : tone === 'paid'
          ? 'font-medium text-slate-900'
          : 'text-slate-600';
  return (
    <span className={`tabular-nums ${color}`}>
      {tone === 'back' ? '+' : ''}
      {taka(value)}
    </span>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
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
        <li
          key={line.billId}
          className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs sm:flex sm:items-center sm:gap-3"
        >
          <div className="min-w-0 flex-1">
            <span className="font-medium text-slate-900">{labels[line.type] ?? line.type}</span>
            <span className="ml-1.5 text-slate-400">{formatDayKey(line.date, 'dayMonth')}</span>
            {line.payerName && <span className="ml-1.5 text-slate-400">· paid by {line.payerName}</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 sm:mt-0 sm:justify-end">
            <span className="text-slate-500">
              share <Money value={line.share} />
            </span>
            <span className="text-slate-500">
              paid <Money value={line.paid} tone="paid" />
            </span>
            {line.outstanding > 0 ? (
              <span className="text-slate-500">
                due <Money value={line.outstanding} tone="due" />
              </span>
            ) : line.advance > 0 ? (
              <span className="text-slate-500">
                back <Money value={line.advance} tone="back" />
              </span>
            ) : null}
            <StatusPill entry={line} />
            {onOpenBill && (
              <button
                type="button"
                onClick={() => onOpenBill(line.billId)}
                className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
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
    <div className="space-y-2.5">
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

export function MemberSummaryList({
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
  const [open, setOpen] = useState<string[]>([]);

  function toggle(userId: string) {
    setOpen((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  if (summaries.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
      <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_7.5rem] sm:gap-3">
        <span className="font-semibold">Member</span>
        <span className="text-right font-semibold">Share</span>
        <span className="text-right font-semibold">Paid</span>
        <span className="text-right font-semibold">Due</span>
        <span className="text-right font-semibold">Status</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {summaries.map((row) => {
          const isOpen = open.includes(row.userId);
          return (
            <li
              key={row.userId}
              className={
                row.advance > 0 ? 'bg-teal-50/50' : row.isCurrentUser ? 'bg-brand-50/40' : 'bg-white'
              }
            >
              <button
                type="button"
                onClick={() => toggle(row.userId)}
                aria-expanded={isOpen}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-slate-50/70 sm:grid sm:grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_7.5rem] sm:items-center sm:gap-3"
              >
                <span className="block min-w-0">
                  <span className="block truncate font-medium text-slate-900">
                    {row.userName}
                    {row.isCurrentUser && (
                      <span className="ml-1.5 text-xs font-normal text-brand-700">(you)</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {row.billCount} {row.billCount === 1 ? 'bill' : 'bills'}
                    {row.unpaidCount > 0 && ` · ${row.unpaidCount} still due`}
                    <span className="sm:hidden">
                      {' '}
                      · share {taka(row.share)} · paid {taka(row.paid)}
                    </span>
                  </span>
                </span>

                <span className="hidden text-right text-sm sm:block">
                  <Money value={row.share} />
                </span>
                <span className="hidden text-right text-sm sm:block">
                  <Money value={row.paid} tone="paid" />
                </span>
                <span className="hidden text-right text-sm sm:block">
                  {row.outstanding > 0 ? (
                    <Money value={row.outstanding} tone="due" />
                  ) : row.advance > 0 ? (
                    <span className="text-xs font-semibold text-teal-700">
                      +{taka(row.advance)}
                      <span className="block text-[10px] font-normal text-teal-600">gets back</span>
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </span>

                <span className="mt-2 flex items-center justify-between gap-2 sm:mt-0 sm:justify-end">
                  <span className="flex items-center gap-2 sm:hidden">
                    {row.outstanding > 0 ? (
                      <span className="text-sm font-bold tabular-nums text-rose-600">
                        {taka(row.outstanding)} due
                      </span>
                    ) : row.advance > 0 ? (
                      <span className="text-sm font-bold tabular-nums text-teal-700">
                        +{taka(row.advance)} back
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-green-700">Settled</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusPill entry={row} />
                    <Chevron open={isOpen} />
                  </span>
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                  <LineRows lines={row.lines} labels={labels} onOpenBill={onOpenBill} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
