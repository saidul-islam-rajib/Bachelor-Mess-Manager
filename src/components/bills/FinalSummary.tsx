import { useMemo, useState } from 'react';
import { Chevron, LineRows } from '@/components/bills/MemberSummaryList';
import {
  settleUp,
  sortByPosition,
  summarizeMembers,
  summaryTotals,
  totalsOf,
  type Bill,
  type MemberSummary
} from '@/lib/bill-view';
import { formatCurrency } from '@/lib/format';
import { round2 } from '@/lib/month';

const taka = formatCurrency;

function positionOf(row: MemberSummary) {
  if (row.net > 0) {
    return {
      label: 'Gets back',
      amount: `+${taka(row.net)}`,
      text: 'text-teal-700',
      pill: 'bg-teal-100 text-teal-800',
      row: 'bg-teal-50/50'
    };
  }
  if (row.net < 0) {
    return {
      label: 'Still to pay',
      amount: taka(-row.net),
      text: 'text-rose-600',
      pill: 'bg-rose-100 text-rose-800',
      row: 'bg-white'
    };
  }
  return {
    label: 'Settled',
    amount: taka(0),
    text: 'text-green-700',
    pill: 'bg-green-100 text-green-800',
    row: 'bg-white'
  };
}

function MemberRow({
  row,
  labels,
  onOpenBill
}: {
  row: MemberSummary;
  labels: Record<string, string>;
  onOpenBill?: (billId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const position = positionOf(row);

  return (
    <li className={row.isCurrentUser ? 'bg-brand-50/40' : position.row}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="w-full px-4 py-3 text-left transition-colors hover:bg-slate-50/70 sm:grid sm:grid-cols-[minmax(0,1fr)_6rem_6rem_9rem_1rem] sm:items-center sm:gap-3"
      >
        <span className="block min-w-0">
          <span className="block truncate font-medium text-slate-900">
            {row.userName}
            {row.isCurrentUser && <span className="ml-1.5 text-xs font-normal text-brand-700">(you)</span>}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {row.billCount} {row.billCount === 1 ? 'bill' : 'bills'} · owes {taka(row.outstanding)} · overpaid{' '}
            {taka(row.advance)}
          </span>
        </span>

        <span className="hidden text-right text-sm tabular-nums text-slate-600 sm:block">{taka(row.share)}</span>
        <span className="hidden text-right text-sm font-medium tabular-nums text-slate-900 sm:block">
          {taka(row.paid)}
        </span>

        <span className="mt-2 flex items-center justify-between gap-2 sm:mt-0 sm:justify-end sm:text-right">
          <span className={`text-base font-bold tabular-nums ${position.text}`}>{position.amount}</span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${position.pill}`}>{position.label}</span>
        </span>

        <span className="hidden justify-end sm:flex">
          <Chevron open={open} />
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <p className="text-xs text-slate-500">
            Share {taka(row.share)} − paid {taka(row.paid)} ={' '}
            <span className={`font-semibold ${position.text}`}>
              {row.net > 0 ? `${taka(row.net)} back to ${row.userName}` : row.net < 0 ? `${taka(-row.net)} still to pay` : 'nothing outstanding'}
            </span>
          </p>
          <div className="mt-2">
            <LineRows lines={row.lines} labels={labels} onOpenBill={onOpenBill} />
          </div>
        </div>
      )}
    </li>
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
    <div className="rounded-3xl border border-slate-300 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Final summary</h2>
          <p className="mt-1 text-sm text-slate-500">
            Every bill of the month netted per member — dues and overpayments cancel each other out, so each person
            ends up with one number: what they still owe, or what the mess owes them back.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {billTotals.count} {billTotals.count === 1 ? 'bill' : 'bills'} · {taka(billTotals.total)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Total shares</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{taka(totals.share)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Paid in</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-green-600">{taka(totals.paid)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Still to pay</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-rose-600">{taka(totals.toPay)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">To refund</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-teal-700">{taka(totals.toRefund)}</dd>
        </div>
      </dl>

      {cancelled > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Bill by bill the members are short {taka(billTotals.outstanding)}, but{' '}
          <span className="font-semibold text-slate-700">{taka(cancelled)}</span> of that cancels against what the same
          members overpaid elsewhere — only {taka(totals.toPay)} has to change hands.
        </p>
      )}

      {summaries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No shares recorded this month.</p>
      ) : (
        <>
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
            <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[minmax(0,1fr)_6rem_6rem_9rem_1rem] sm:gap-3">
              <span className="font-semibold">Member</span>
              <span className="text-right font-semibold">Share</span>
              <span className="text-right font-semibold">Paid</span>
              <span className="text-right font-semibold">Final position</span>
              <span />
            </div>
            <ul className="divide-y divide-slate-100">
              {summaries.map((row) => (
                <MemberRow key={row.userId} row={row} labels={labels} onOpenBill={onOpenBill} />
              ))}
            </ul>
          </div>

          {settlement.transfers.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Settle up in {settlement.transfers.length}{' '}
                {settlement.transfers.length === 1 ? 'hand-over' : 'hand-overs'}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                The shortest way to clear the month: the members still short pay the members who fronted the money.
              </p>
              <ul className="mt-2 space-y-1.5">
                {settlement.transfers.map((transfer, index) => (
                  <li
                    key={`${transfer.fromUserId}-${transfer.toUserId}-${index}`}
                    className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-900">{transfer.fromName}</span>
                    <span className="text-slate-400">pays</span>
                    <span className="font-semibold tabular-nums text-slate-900">{taka(transfer.amount)}</span>
                    <span className="text-slate-400">to</span>
                    <span className="font-medium text-slate-900">{transfer.toName}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {settlement.unmatched > 0 && (
            <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <span className="font-semibold tabular-nums">{taka(settlement.unmatched)}</span> of the dues is not owed
              to any member — it is the part of the bills nobody has fronted yet, so it goes to the mess to pay the
              vendors.
            </p>
          )}

          {settlement.surplus > 0 && (
            <p className="mt-3 rounded-2xl bg-teal-50 px-4 py-3 text-xs text-teal-900">
              <span className="font-semibold tabular-nums">{taka(settlement.surplus)}</span> more has been collected
              than the bills come to, so the mess itself refunds that much.
            </p>
          )}

          <p className="mt-3 text-xs text-slate-500">
            {owing.length} {owing.length === 1 ? 'member' : 'members'} still to pay ·{' '}
            {gettingBack.length} {gettingBack.length === 1 ? 'member gets' : 'members get'} money back · a member who
            overpaid one bill but skipped another is counted once, on the difference.
          </p>
        </>
      )}
    </div>
  );
}
