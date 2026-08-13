import { useMemo, useState, type ReactNode } from 'react';
import { LineRows, MemberSummaryList } from '@/components/bills/MemberSummaryList';
import {
  BILL_KINDS,
  BILL_KIND_COPY,
  billsByKind,
  billsByType,
  summarizeMembers,
  totalsOf,
  type Bill,
  type BillKind,
  type BillsData
} from '@/lib/bill-view';
import { formatCurrency, formatDayKey } from '@/lib/format';

const taka = formatCurrency;

type FocusKey = 'total' | 'collected' | 'owed' | 'mine';

const PANEL_TITLES: Record<FocusKey, { title: string; subtitle: string }> = {
  total: {
    title: 'Every bill this month',
    subtitle: 'Shared bills are split equally between all members; assigned bills only touch the people picked for them.'
  },
  collected: {
    title: 'Who has paid',
    subtitle: 'Money already collected from members, per person. Tap a member to see which bills it covered.'
  },
  owed: {
    title: 'Who still owes',
    subtitle: 'Members with an unpaid share, largest first. Tap a member to see exactly which bills are unpaid.'
  },
  mine: {
    title: 'Your share, bill by bill',
    subtitle: 'What each bill costs you, what you have paid and what is left.'
  }
};

function StatButton({
  label,
  value,
  tone,
  active,
  hint,
  onClick
}: {
  label: string;
  value: string;
  tone?: 'green' | 'red';
  active: boolean;
  hint: string;
  onClick: () => void;
}) {
  const color = tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-slate-900';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`rounded-3xl border bg-white p-4 text-left shadow-sm transition-all sm:p-5 ${
        active
          ? 'border-brand-500 ring-2 ring-brand-100'
          : 'border-slate-200 hover:border-brand-300 hover:shadow-md'
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-xl font-semibold sm:text-2xl ${color}`}>{value}</div>
      <div className={`mt-1.5 text-[11px] font-medium ${active ? 'text-brand-700' : 'text-slate-400'}`}>
        {active ? 'Hide details ▲' : `${hint} ▼`}
      </div>
    </button>
  );
}

function Panel({
  focus,
  onClose,
  children
}: {
  focus: FocusKey;
  onClose: () => void;
  children: ReactNode;
}) {
  const copy = PANEL_TITLES[focus];
  return (
    <div className="rounded-3xl border border-brand-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{copy.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Close
        </button>
      </div>
      {children}
    </div>
  );
}

function BillLines({
  bills,
  showDateOnly,
  labels,
  onOpenBill
}: {
  bills: Bill[];
  showDateOnly?: boolean;
  labels: Record<string, string>;
  onOpenBill: (billId: string) => void;
}) {
  return (
    <ul className="mt-2 space-y-2">
      {bills.map((bill) => {
        const percent = bill.amount > 0 ? Math.min(100, Math.round((bill.collected / bill.amount) * 100)) : 0;
        return (
          <li key={bill.id}>
            <button
              type="button"
              onClick={() => onOpenBill(bill.id)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-slate-50"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-slate-900">
                  {showDateOnly ? (
                    formatDayKey(bill.date, 'dayMonth')
                  ) : (
                    <>
                      {labels[bill.type] ?? bill.type}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {formatDayKey(bill.date, 'dayMonth')}
                      </span>
                    </>
                  )}
                  {bill.payer && <span className="ml-2 text-xs font-normal text-slate-500">paid by {bill.payer.name}</span>}
                </span>
                <span className="text-sm font-semibold tabular-nums">{taka(bill.amount)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-500">
                  Collected <span className="font-semibold text-slate-700">{taka(bill.collected)}</span>
                  {bill.uncollected > 0 && (
                    <span className="ml-1.5 font-semibold text-rose-600">
                      · {taka(bill.uncollected)} still owed by {bill.unpaidMemberCount}
                    </span>
                  )}
                </span>
                <span className="text-slate-400">Open in the list ›</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${bill.isFullyCollected ? 'bg-green-500' : 'bg-brand-600'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function KindSection({
  kind,
  bills,
  labels,
  onOpenBill
}: {
  kind: BillKind;
  bills: Bill[];
  labels: Record<string, string>;
  onOpenBill: (billId: string) => void;
}) {
  if (bills.length === 0) return null;
  const totals = totalsOf(bills);
  const copy = BILL_KIND_COPY[kind];

  return (
    <section className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          {copy.title} <span className="font-normal text-slate-400">({bills.length})</span>
        </h3>
        <span className="text-xs text-slate-500">
          {taka(totals.total)} · {taka(totals.collected)} collected
        </span>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{copy.hint}</p>

      <div className="mt-3 space-y-3">
        {billsByType(bills).map((group) => (
          <div key={group.type}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700">
                {labels[group.type] ?? group.type}
                {group.bills.length > 1 && (
                  <span className="ml-1.5 font-normal text-slate-400">{group.bills.length} bills</span>
                )}
              </span>
              <span className="tabular-nums text-slate-500">{taka(group.totals.total)}</span>
            </div>
            <BillLines showDateOnly bills={group.bills} labels={labels} onOpenBill={onOpenBill} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function BillStats({
  bills,
  totals,
  labels,
  currentUserId,
  onOpenBill
}: {
  bills: Bill[];
  totals: BillsData['totals'];
  labels: Record<string, string>;
  currentUserId: string;
  onOpenBill: (billId: string) => void;
}) {
  const [focus, setFocus] = useState<FocusKey | null>(null);

  const summaries = useMemo(() => summarizeMembers(bills, currentUserId), [bills, currentUserId]);
  const grouped = useMemo(() => billsByKind(bills), [bills]);

  const mine = summaries.find((row) => row.isCurrentUser) ?? null;
  const owing = summaries.filter((row) => row.outstanding > 0);
  const payers = summaries.filter((row) => row.paid > 0);
  const refunds = summaries.filter((row) => row.advance > 0);
  const myShare = mine?.share ?? 0;
  const myDue = mine?.outstanding ?? 0;

  function select(key: FocusKey) {
    setFocus((current) => (current === key ? null : key));
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatButton
          label="Total bills"
          value={taka(totals.total)}
          active={focus === 'total'}
          hint={`${bills.length} ${bills.length === 1 ? 'bill' : 'bills'}`}
          onClick={() => select('total')}
        />
        <StatButton
          label="Collected"
          value={taka(totals.collected)}
          tone="green"
          active={focus === 'collected'}
          hint={`${payers.length} paid`}
          onClick={() => select('collected')}
        />
        <StatButton
          label="Still owed"
          value={taka(totals.uncollected)}
          tone="red"
          active={focus === 'owed'}
          hint={owing.length === 0 ? 'All settled' : `${owing.length} ${owing.length === 1 ? 'member' : 'members'}`}
          onClick={() => select('owed')}
        />
        <StatButton
          label={myDue > 0 ? 'Your share · due' : 'Your share'}
          value={myDue > 0 ? `${taka(myShare)} · ${taka(myDue)}` : taka(myShare)}
          tone={myDue > 0 ? 'red' : undefined}
          active={focus === 'mine'}
          hint={`${mine?.billCount ?? 0} ${mine?.billCount === 1 ? 'bill' : 'bills'}`}
          onClick={() => select('mine')}
        />
      </div>

      {focus === 'total' && (
        <Panel focus="total" onClose={() => setFocus(null)}>
          <KindSection kind={BILL_KINDS.SHARED} bills={grouped.SHARED} labels={labels} onOpenBill={onOpenBill} />
          <KindSection kind={BILL_KINDS.ASSIGNED} bills={grouped.ASSIGNED} labels={labels} onOpenBill={onOpenBill} />
          {bills.length === 0 && <p className="mt-3 text-sm text-slate-500">No bills recorded for this month.</p>}
        </Panel>
      )}

      {focus === 'collected' && (
        <Panel focus="collected" onClose={() => setFocus(null)}>
          <p className="mt-3 text-sm text-slate-600">
            <span className="font-semibold text-green-600">{taka(totals.collected)}</span> of{' '}
            {taka(totals.total)} is in — {payers.length} {payers.length === 1 ? 'member has' : 'members have'} paid
            something.
          </p>
          <MemberSummaryList
            summaries={payers}
            labels={labels}
            emptyText="Nothing has been collected yet."
            onOpenBill={onOpenBill}
          />
        </Panel>
      )}

      {focus === 'owed' && (
        <Panel focus="owed" onClose={() => setFocus(null)}>
          <p className="mt-3 text-sm text-slate-600">
            {owing.length === 0 ? (
              'Every member has paid their share for this month.'
            ) : (
              <>
                <span className="font-semibold text-rose-600">{taka(totals.uncollected)}</span> is still to come from{' '}
                {owing.length} {owing.length === 1 ? 'member' : 'members'}.
              </>
            )}
          </p>
          <MemberSummaryList
            summaries={owing}
            labels={labels}
            emptyText="Nobody owes anything right now."
            onOpenBill={onOpenBill}
          />
          {refunds.length > 0 && (
            <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
              <h3 className="text-sm font-semibold text-teal-900">Paid more than their share</h3>
              <p className="mt-0.5 text-xs text-teal-800">
                Funded by the members still due — the mess pays this back once the dues come in.
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {refunds.map((row) => (
                  <li key={row.userId} className="flex items-center justify-between gap-3">
                    <span className="truncate text-teal-900">
                      {row.userName}
                      {row.isCurrentUser && <span className="ml-1.5 text-xs text-teal-700">(you)</span>}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-teal-800">+{taka(row.advance)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      )}

      {focus === 'mine' && (
        <Panel focus="mine" onClose={() => setFocus(null)}>
          {!mine || mine.billCount === 0 ? (
            <p className="mt-3 text-sm text-slate-500">You have no share in this month&apos;s bills.</p>
          ) : (
            <>
              <dl className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Your share</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{taka(mine.share)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Paid</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-green-600">{taka(mine.paid)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Still due</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-rose-600">{taka(mine.outstanding)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Gets back</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-teal-700">{taka(mine.advance)}</dd>
                </div>
              </dl>
              <LineRows lines={mine.lines} labels={labels} onOpenBill={onOpenBill} />
            </>
          )}
        </Panel>
      )}
    </>
  );
}
