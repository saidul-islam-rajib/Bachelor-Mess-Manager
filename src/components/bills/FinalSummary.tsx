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

const taka = formatCurrency;

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
      ? 'text-green-600'
      : tone === 'rose'
        ? 'text-rose-600'
        : tone === 'teal'
          ? 'text-teal-700'
          : 'text-slate-900';
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">{label}</dt>
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
    <div className="rounded-3xl border border-slate-300 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold">Final summary</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {billTotals.count} {billTotals.count === 1 ? 'bill' : 'bills'} · {taka(billTotals.total)}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Every bill of the month netted per member. Being short on one bill and ahead on another cancels out, so each
        person ends with one number: what they still owe, or what the mess owes them back.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 px-4 py-3 sm:grid-cols-4">
        <Total label="Total shares" value={taka(totals.share)} />
        <Total label="Paid in" value={taka(totals.paid)} tone="green" />
        <Total label="Still to pay" value={taka(totals.toPay)} tone="rose" />
        <Total label="To refund" value={taka(totals.toRefund)} tone="teal" />
      </dl>

      {cancelled > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Bill by bill the members are short {taka(billTotals.outstanding)}, but{' '}
          <span className="font-semibold text-slate-700">{taka(cancelled)}</span> of that cancels against what the same
          members overpaid elsewhere — only {taka(totals.toPay)} has to change hands.
        </p>
      )}

      <MemberTable
        summaries={summaries}
        labels={labels}
        emptyText="No shares recorded this month."
        onOpenBill={onOpenBill}
      />

      {summaries.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {owing.length} {owing.length === 1 ? 'member' : 'members'} still to pay ·{' '}
          {gettingBack.length} {gettingBack.length === 1 ? 'member gets' : 'members get'} money back. Tap anyone to see
          it bill by bill.
        </p>
      )}

      {settlement.transfers.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Settle up in {settlement.transfers.length}{' '}
            {settlement.transfers.length === 1 ? 'hand-over' : 'hand-overs'}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            The shortest way to clear the month: the members still short pay the members who fronted the money.
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {settlement.transfers.map((transfer, index) => (
              <li
                key={`${transfer.fromUserId}-${transfer.toUserId}-${index}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-slate-900">{transfer.fromName}</span>
                  <span className="text-slate-400"> → </span>
                  <span className="font-medium text-slate-900">{transfer.toName}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-900">{taka(transfer.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {settlement.unmatched > 0 && (
        <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <span className="font-semibold tabular-nums">{taka(settlement.unmatched)}</span> of the dues is not owed to
          any member — it is the part of the bills nobody has fronted yet, so it goes to the mess to pay the vendors.
        </p>
      )}

      {settlement.surplus > 0 && (
        <p className="mt-3 rounded-2xl bg-teal-50 px-4 py-3 text-xs text-teal-900">
          <span className="font-semibold tabular-nums">{taka(settlement.surplus)}</span> more has been collected than
          the bills come to, so the mess itself refunds that much.
        </p>
      )}
    </div>
  );
}
