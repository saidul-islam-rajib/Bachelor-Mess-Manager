import { useMemo, useState, type ReactNode } from 'react';
import { LineRows, MemberTable } from '@/components/bills/MemberTable';
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
import { strings } from '@/lib/i18n';

const taka = formatCurrency;
const stats = strings.bills.stats;

type FocusKey = 'total' | 'collected' | 'owed' | 'mine';

const PANEL_TITLES: Record<FocusKey, { title: string; subtitle: string }> = stats.panels;

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
  const color = tone === 'green' ? 'text-green-600 dark:text-green-400' : tone === 'red' ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`rounded-3xl border bg-white dark:bg-slate-800 p-3.5 text-left shadow-sm transition-all sm:p-5 ${
        active
          ? 'border-brand-500 ring-2 ring-brand-100'
          : 'border-slate-200 dark:border-slate-700 hover:border-brand-300 hover:shadow-md'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-xs">{label}</div>
      <div className={`mt-1.5 text-lg font-semibold tabular-nums sm:mt-2 sm:text-2xl ${color}`}>{value}</div>
      <div className={`mt-1 text-[11px] font-medium ${active ? 'text-brand-700' : 'text-slate-400 dark:text-slate-500'}`}>
        {active ? stats.hideDetails : `${hint} ▼`}
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
    <div className="rounded-3xl border border-brand-200 bg-white dark:bg-slate-800 p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">{copy.title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-[2rem] shrink-0 items-center rounded-full border border-slate-200 dark:border-slate-700 px-3 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          {strings.common.close}
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy.subtitle}</p>
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
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {showDateOnly ? (
                    formatDayKey(bill.date, 'dayMonth')
                  ) : (
                    <>
                      {labels[bill.type] ?? bill.type}
                      <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                        {formatDayKey(bill.date, 'dayMonth')}
                      </span>
                    </>
                  )}
                  {bill.payer && <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">{strings.bills.paidByName(bill.payer.name)}</span>}
                </span>
                <span className="text-sm font-semibold tabular-nums">{taka(bill.amount)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  {strings.bills.collectedLabel} <span className="font-semibold text-slate-700 dark:text-slate-300">{taka(bill.collected)}</span>
                  {bill.uncollected > 0 && (
                    <span className="ml-1.5 font-semibold text-rose-600">
                      · {stats.stillOwedByCount(taka(bill.uncollected), bill.unpaidMemberCount)}
                    </span>
                  )}
                </span>
                <span className="text-slate-400 dark:text-slate-500">{stats.openInList}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
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
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {copy.title} <span className="font-normal text-slate-400 dark:text-slate-500">({bills.length})</span>
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {taka(totals.total)} · {strings.bills.collectedAmount(taka(totals.collected))}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{copy.hint}</p>

      <div className="mt-3 space-y-3">
        {billsByType(bills).map((group) => (
          <div key={group.type}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {labels[group.type] ?? group.type}
                {group.bills.length > 1 && (
                  <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">{stats.billsCountShort(group.bills.length)}</span>
                )}
              </span>
              <span className="tabular-nums text-slate-500 dark:text-slate-400">{taka(group.totals.total)}</span>
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
  const refunds = summaries.filter((row) => row.net > 0);
  const aheadDespiteDues = owing.filter((row) => row.net >= 0).length;
  const myShare = mine?.share ?? 0;
  const myDue = mine?.outstanding ?? 0;

  function select(key: FocusKey) {
    setFocus((current) => (current === key ? null : key));
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatButton
          label={strings.bills.totalBills}
          value={taka(totals.total)}
          active={focus === 'total'}
          hint={strings.bills.billCount(bills.length)}
          onClick={() => select('total')}
        />
        <StatButton
          label={strings.bills.collectedLabel}
          value={taka(totals.collected)}
          tone="green"
          active={focus === 'collected'}
          hint={stats.paidCount(payers.length)}
          onClick={() => select('collected')}
        />
        <StatButton
          label={stats.stillOwedStat}
          value={taka(totals.uncollected)}
          tone="red"
          active={focus === 'owed'}
          hint={owing.length === 0 ? stats.allSettled : stats.memberCount(owing.length)}
          onClick={() => select('owed')}
        />
        <StatButton
          label={myDue > 0 ? stats.yourShareDueLabel : strings.bills.yourShare}
          value={myDue > 0 ? `${taka(myShare)} · ${taka(myDue)}` : taka(myShare)}
          tone={myDue > 0 ? 'red' : undefined}
          active={focus === 'mine'}
          hint={strings.bills.billCount(mine?.billCount ?? 0)}
          onClick={() => select('mine')}
        />
      </div>

      {focus === 'total' && (
        <Panel focus="total" onClose={() => setFocus(null)}>
          <KindSection kind={BILL_KINDS.SHARED} bills={grouped.SHARED} labels={labels} onOpenBill={onOpenBill} />
          <KindSection kind={BILL_KINDS.ASSIGNED} bills={grouped.ASSIGNED} labels={labels} onOpenBill={onOpenBill} />
          {bills.length === 0 && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{strings.bills.none}</p>}
        </Panel>
      )}

      {focus === 'collected' && (
        <Panel focus="collected" onClose={() => setFocus(null)}>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            {stats.collectedSummary(taka(totals.collected), taka(totals.total), payers.length)}
          </p>
          <MemberTable
            summaries={payers}
            labels={labels}
            emptyText={stats.nothingCollectedYet}
            onOpenBill={onOpenBill}
          />
        </Panel>
      )}

      {focus === 'owed' && (
        <Panel focus="owed" onClose={() => setFocus(null)}>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            {owing.length === 0 ? (
              stats.allPaidThisMonth
            ) : (
              <>
                <span className="font-semibold text-rose-600">{taka(totals.uncollected)}</span>{' '}
                {stats.stillToComeSuffix(owing.length)}
              </>
            )}
          </p>
          {aheadDespiteDues > 0 && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {stats.overpaidNote(aheadDespiteDues)}
            </p>
          )}
          <MemberTable
            summaries={owing}
            labels={labels}
            emptyText={stats.nobodyOwesAnything}
            onOpenBill={onOpenBill}
          />
          {refunds.length > 0 && (
            <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50/60 p-3.5 sm:p-4">
              <h3 className="text-sm font-semibold text-teal-900">{stats.getsMoneyBack}</h3>
              <p className="mt-0.5 text-xs text-teal-800">
                {stats.getsMoneyBackHint}
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {refunds.map((row) => (
                  <li key={row.userId} className="flex items-center justify-between gap-3">
                    <span className="truncate text-teal-900">
                      {row.userName}
                      {row.isCurrentUser && <span className="ml-1.5 text-xs text-teal-700">{strings.common.you}</span>}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-teal-800">+{taka(row.net)}</span>
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
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{stats.noShareThisMonth}</p>
          ) : (
            <>
              <dl className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{strings.bills.yourShare}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{taka(mine.share)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{strings.bills.paid}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-green-600 dark:text-green-400">{taka(mine.paid)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{stats.stillDueDt}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-rose-600">{taka(mine.outstanding)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{stats.getsBackDt}</dt>
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
