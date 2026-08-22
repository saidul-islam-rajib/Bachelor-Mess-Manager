import { useMemo } from 'react';
import { MemberTable } from '@/components/bills/MemberTable';
import {
  settleUp,
  sortByPosition,
  summarizeMembers,
  summaryTotals,
  totalsOf,
  type Bill
} from '@/lib/bill-view';
import { formatCurrency } from '@/lib/format';
import { round2 } from '@/lib/month';
import { strings } from '@/lib/i18n';

const taka = formatCurrency;
const finalSummary = strings.bills.finalSummary;

function Total({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: 'green' | 'rose' | 'teal';
}) {
  const color =
    tone === 'green'
      ? 'text-green-600 dark:text-green-400'
      : tone === 'rose'
        ? 'text-rose-600'
        : tone === 'teal'
          ? 'text-teal-700'
          : 'text-slate-900 dark:text-slate-100';
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-xs">{label}</dt>
      <dd className={`mt-0.5 text-sm font-semibold tabular-nums sm:text-base ${color}`}>{value}</dd>
    </div>
  );
}

export function FinalSummary({
  bills,
  labels,
  currentUserId,
  onOpenBill
}: {
  bills: Bill[];
  labels: Record<string, string>;
  currentUserId: string;
  onOpenBill?: (billId: string) => void;
}) {
  const summaries = useMemo(
    () => sortByPosition(summarizeMembers(bills, currentUserId)),
    [bills, currentUserId]
  );
  const totals = useMemo(() => summaryTotals(summaries), [summaries]);
  const billTotals = useMemo(() => totalsOf(bills), [bills]);
  const settlement = useMemo(() => settleUp(summaries), [summaries]);

  const owing = summaries.filter((row) => row.net < 0);
  const gettingBack = summaries.filter((row) => row.net > 0);
  const cancelled = round2(billTotals.outstanding - totals.toPay);

  return (
    <div className="rounded-3xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold">{finalSummary.title}</h2>
        <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-400">
          {finalSummary.billsAndTotal(billTotals.count, taka(billTotals.total))}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {finalSummary.subtitle}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 dark:bg-slate-900 px-4 py-3 sm:grid-cols-4">
        <Total label={finalSummary.totalShares} value={taka(totals.share)} />
        <Total label={finalSummary.paidIn} value={taka(totals.paid)} tone="green" />
        <Total label={finalSummary.stillToPayLabel} value={taka(totals.toPay)} tone="rose" />
        <Total label={strings.payments.toRefund} value={taka(totals.toRefund)} tone="teal" />
      </dl>

      {cancelled > 0 && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {finalSummary.cancelledPre(taka(billTotals.outstanding))}{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-300">{taka(cancelled)}</span> {finalSummary.cancelledPost(taka(totals.toPay))}
        </p>
      )}

      <MemberTable
        summaries={summaries}
        labels={labels}
        emptyText={finalSummary.noShares}
        onOpenBill={onOpenBill}
      />

      {summaries.length > 0 && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {finalSummary.payGetBackSummary(owing.length, gettingBack.length)}
        </p>
      )}

      {settlement.transfers.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/70 p-3.5 sm:p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {finalSummary.settleUpIn(settlement.transfers.length)}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {finalSummary.settleUpHint}
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {settlement.transfers.map((transfer, index) => (
              <li
                key={`${transfer.fromUserId}-${transfer.toUserId}-${index}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-slate-800 px-3 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{transfer.fromName}</span>
                  <span className="text-slate-400 dark:text-slate-500"> → </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{transfer.toName}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-100">{taka(transfer.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {settlement.unmatched > 0 && (
        <p className="mt-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
          <span className="font-semibold tabular-nums">{taka(settlement.unmatched)}</span> {finalSummary.unmatchedNote}
        </p>
      )}

      {settlement.surplus > 0 && (
        <p className="mt-3 rounded-2xl bg-teal-50 px-4 py-3 text-xs text-teal-900">
          <span className="font-semibold tabular-nums">{taka(settlement.surplus)}</span> {finalSummary.surplusNote}
        </p>
      )}
    </div>
  );
}
