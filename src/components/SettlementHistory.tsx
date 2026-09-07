import { useState } from 'react';
import { strings } from '@/lib/i18n';
import { formatCurrency, formatDate, formatMonthLabel } from '@/lib/format';
import type { SettlementHistoryEntry } from '@/lib/settlement-history';

const t = strings.settlement;
const taka = formatCurrency;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 text-slate-400 transition-transform dark:text-slate-500 ${open ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function balanceLabel(dueAtClose: number): { text: string; tone: string } {
  if (dueAtClose > 0.005) return { text: t.historyDueAmount(taka(dueAtClose)), tone: 'text-rose-600 dark:text-rose-400' };
  if (dueAtClose < -0.005) {
    return { text: t.historyRefundAmount(taka(-dueAtClose)), tone: 'text-teal-700 dark:text-teal-400' };
  }
  return { text: t.historySettledAmount, tone: 'text-slate-500 dark:text-slate-400' };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3.5 py-3 dark:bg-slate-900/60">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function TypeList({
  title,
  byType,
  total,
  labels
}: {
  title: string;
  byType: Record<string, number>;
  total: number;
  labels: Record<string, string>;
}) {
  const rows = Object.entries(byType)
    .filter(([, amount]) => Math.abs(amount) > 0.005)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  if (rows.length === 0) return null;

  return (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{title}</h4>
      <ul className="mt-2 space-y-1.5">
        {rows.map(([type, amount]) => (
          <li key={type} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">{labels[type] ?? type}</span>
            <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-400">{taka(amount)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-semibold dark:border-slate-700">
        <span className="text-slate-600 dark:text-slate-400">{strings.common.total}</span>
        <span className="tabular-nums text-slate-900 dark:text-slate-100">{taka(total)}</span>
      </p>
    </div>
  );
}

function EntryRow({ entry, viewerIsSelf }: { entry: SettlementHistoryEntry; viewerIsSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const balance = balanceLabel(entry.dueAtClose);
  const methodBadge = entry.method === 'SELF' ? t.historyMethodSelf : t.historyMethodSupervisor;
  const settledBy =
    entry.method === 'SELF'
      ? viewerIsSelf
        ? t.historyBySelf
        : null
      : t.historyByActor(entry.actorName);

  return (
    <li className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/60"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {formatMonthLabel(entry.monthKey)}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-400">
              {methodBadge}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
            {entry.groupName} · {t.historySubmittedOn(formatDate(entry.submittedAt))}
            {settledBy ? ` · ${settledBy}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={`text-sm font-semibold tabular-nums ${balance.tone}`}>{balance.text}</span>
          <Chevron open={open} />
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/50">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Stat label={strings.memberDetail.meals} value={String(entry.meals)} />
            <Stat label={strings.memberDetail.mealCost} value={taka(entry.mealCost)} />
            <Stat label={strings.memberDetail.billShare} value={taka(entry.billShare)} />
            <Stat label={strings.memberDetail.bazarPaid} value={taka(entry.bazarPaid)} />
            <Stat label={strings.memberDetail.paid} value={taka(entry.cashPaid)} />
            <Stat label={strings.memberDetail.totalCost} value={taka(entry.totalCost)} />
            {Math.abs(entry.carryIn) > 0.005 && (
              <Stat label={strings.memberDetail.carryIn} value={taka(entry.carryIn)} />
            )}
          </div>

          {entry.mealRate > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.historyMealRateNote(taka(entry.mealRate))}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <TypeList
              title={viewerIsSelf ? t.historyPayableBreakdown : t.historyPayableBreakdownMember}
              byType={entry.payableByType}
              total={entry.totalCost}
              labels={entry.categoryLabels}
            />
            <TypeList
              title={viewerIsSelf ? t.historyPaidBreakdown : t.historyPaidBreakdownMember}
              byType={entry.paidByType}
              total={entry.bazarPaid + entry.cashPaid}
              labels={entry.categoryLabels}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3.5 py-3 text-sm dark:bg-slate-800">
            <span className="font-medium text-slate-600 dark:text-slate-400">{t.historyDueAtClose}</span>
            <span className={`font-semibold tabular-nums ${balance.tone}`}>{balance.text}</span>
          </div>

          {entry.transfers.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {t.historyTransfersTitle}
              </h4>
              <ul className="mt-2 space-y-1.5">
                {entry.transfers.map((transfer, index) => (
                  <li
                    key={`${transfer.direction}-${transfer.counterpartyName}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm dark:bg-slate-800"
                  >
                    <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">
                      {transfer.direction === 'out'
                        ? t.historyTransferOut(transfer.counterpartyName)
                        : t.historyTransferIn(transfer.counterpartyName)}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {taka(transfer.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function SettlementHistoryList({
  items,
  viewerIsSelf = true
}: {
  items: SettlementHistoryEntry[];
  viewerIsSelf?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <ul className="space-y-2.5">
      {items.map((entry) => (
        <EntryRow key={entry.id} entry={entry} viewerIsSelf={viewerIsSelf} />
      ))}
    </ul>
  );
}
