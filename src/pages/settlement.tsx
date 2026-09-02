import { useCallback, useEffect, useState } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import { useGroupMonth } from '@/components/GroupMonthControls';
import { Button, EmptyState, Listbox, PageTitle, useConfirm } from '@/components/ui';
import { strings } from '@/lib/i18n';
import { formatCurrency, formatDay, formatMonthLabel } from '@/lib/format';
import { PAYMENT_STATUS, expenseTypeLabel } from '@/lib/constants';

const settlement = strings.settlement;
const taka = formatCurrency;
const sum = (rows: SettlementMember[], pick: (row: SettlementMember) => number) =>
  rows.reduce((total, row) => total + pick(row), 0);

type SettlementMember = {
  id: string;
  name: string;
  email: string;
  meals: number;
  mealCost: number;
  billShare: number;
  billShareByType: Record<string, number>;
  bazarPaid: number;
  cashPaid: number;
  dueAtClose: number;
  closeStatus: string;
  liveDue: number;
  status: string;
  isCurrentMember: boolean;
};

type Transfer = { fromUserId: string; fromName: string; toUserId: string; toName: string; amount: number };

type SettlementData = {
  groupId: string;
  groupName: string;
  closingId: string;
  monthKey: string;
  closedThrough: string;
  closedBy: string | null;
  settledAt: string | null;
  settledBy: string | null;
  mealRate: number;
  totals: { bazar: number; bills: number; expense: number; meals: number };
  members: SettlementMember[];
  settleUp: { transfers: Transfer[]; unmatched: number; surplus: number };
  allClear: boolean;
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    [PAYMENT_STATUS.PAID]: 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 ring-green-600/20',
    [PAYMENT_STATUS.PARTIAL]: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-600/20',
    [PAYMENT_STATUS.PENDING]: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-red-600/20',
    [PAYMENT_STATUS.REFUND]: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-600/20'
  };
  const label: Record<string, string> = {
    [PAYMENT_STATUS.PAID]: strings.payments.statusSettled,
    [PAYMENT_STATUS.PARTIAL]: strings.payments.statusPartlyPaid,
    [PAYMENT_STATUS.PENDING]: strings.payments.statusUnpaid,
    [PAYMENT_STATUS.REFUND]: strings.payments.statusRefundDue
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status] ?? styles.PENDING}`}>
      {label[status] ?? status}
    </span>
  );
}

function BillBreakdown({ byType }: { byType: Record<string, number> }) {
  const entries = Object.entries(byType).filter(([, amount]) => amount > 0.005);
  if (entries.length === 0) return null;
  return (
    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
      {entries.map(([type, amount]) => `${expenseTypeLabel(type)} ${taka(amount)}`).join(' · ')}
    </p>
  );
}

function MemberSection({ members, currentUserId }: { members: SettlementMember[]; currentUserId?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">{strings.payments.memberBalances}</h2>

      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-3 py-2">{settlement.member}</th>
              <th className="px-3 py-2 text-right">{settlement.meals}</th>
              <th className="px-3 py-2 text-right">{settlement.mealCost}</th>
              <th className="px-3 py-2 text-right">{settlement.billShare}</th>
              <th className="px-3 py-2 text-right">{settlement.bazarBought}</th>
              <th className="px-3 py-2 text-right">{settlement.totalPaid}</th>
              <th className="px-3 py-2 text-right">{settlement.dueOrRefund}</th>
              <th className="px-3 py-2 text-right">{settlement.status}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                <td className="px-3 py-3 font-medium">
                  {m.name}
                  {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600 dark:text-green-400">{strings.common.you}</span>}
                  {!m.isCurrentMember && (
                    <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {strings.payments.left}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{m.meals}</td>
                <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{taka(m.mealCost)}</td>
                <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">
                  {taka(m.billShare)}
                  <BillBreakdown byType={m.billShareByType} />
                </td>
                <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{taka(m.bazarPaid)}</td>
                <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{taka(m.bazarPaid + m.cashPaid)}</td>
                <td className={`px-3 py-3 text-right font-semibold ${m.dueAtClose > 0.005 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {taka(Math.abs(m.dueAtClose))}
                  {m.dueAtClose < -0.005 && <span className="ml-1 text-xs font-normal">{strings.payments.refund}</span>}
                </td>
                <td className="px-3 py-3 text-right">
                  <StatusBadge status={m.closeStatus} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 dark:border-slate-700 text-sm font-semibold">
              <td className="px-3 py-3">{settlement.groupTotal}</td>
              <td className="px-3 py-3 text-right">{sum(members, (m) => m.meals)}</td>
              <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.mealCost))}</td>
              <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.billShare))}</td>
              <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.bazarPaid))}</td>
              <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.bazarPaid + m.cashPaid))}</td>
              <td
                className={`px-3 py-3 text-right ${
                  sum(members, (m) => m.dueAtClose) > 0.005 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                }`}
              >
                {taka(Math.abs(sum(members, (m) => m.dueAtClose)))}
                {sum(members, (m) => m.dueAtClose) < -0.005 && <span className="ml-1 text-xs font-normal">{strings.payments.refund}</span>}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="mt-4 space-y-3 md:hidden">
        {members.map((m) => (
          <li key={m.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">
                {m.name}
                {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600 dark:text-green-400">{strings.common.you}</span>}
              </p>
              <StatusBadge status={m.closeStatus} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">{settlement.meals}</dt>
                <dd className="font-medium">{m.meals}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">{settlement.mealCost}</dt>
                <dd className="font-medium">{taka(m.mealCost)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">{settlement.billShare}</dt>
                <dd className="font-medium">
                  {taka(m.billShare)}
                  <BillBreakdown byType={m.billShareByType} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">{settlement.bazarBought}</dt>
                <dd className="font-medium">{taka(m.bazarPaid)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">{settlement.totalPaid}</dt>
                <dd className="font-medium">{taka(m.bazarPaid + m.cashPaid)}</dd>
              </div>
            </dl>
            <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 dark:border-slate-700 pt-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">{m.dueAtClose < -0.005 ? strings.payments.refundOwed : strings.payments.due}</span>
              <span className={`text-base font-semibold ${m.dueAtClose > 0.005 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {taka(Math.abs(m.dueAtClose))}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-900 p-4 md:hidden">
        <p className="text-sm font-semibold">{settlement.groupTotal}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{settlement.billShare}</dt>
            <dd className="font-medium">{taka(sum(members, (m) => m.billShare))}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{settlement.totalPaid}</dt>
            <dd className="font-medium">{taka(sum(members, (m) => m.bazarPaid + m.cashPaid))}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{settlement.dueOrRefund}</dt>
            <dd
              className={`font-semibold ${
                sum(members, (m) => m.dueAtClose) > 0.005 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              }`}
            >
              {taka(Math.abs(sum(members, (m) => m.dueAtClose)))}
              {sum(members, (m) => m.dueAtClose) < -0.005 && <span className="ml-1 text-xs font-normal">{strings.payments.refund}</span>}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function SettleUpSection({ result }: { result: SettlementData['settleUp'] }) {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      {result.transfers.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{settlement.noTransfersNeeded}</p>
      ) : (
        <>
          <h2 className="text-lg font-semibold">{settlement.settleUpTitle(result.transfers.length)}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{settlement.settleUpHint}</p>
          <ul className="mt-3 space-y-1.5">
            {result.transfers.map((transfer, index) => (
              <li
                key={`${transfer.fromUserId}-${transfer.toUserId}-${index}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm"
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
        </>
      )}

      {result.unmatched > 0 && (
        <p className="mt-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
          <span className="font-semibold tabular-nums">{taka(result.unmatched)}</span> {settlement.unmatchedNote}
        </p>
      )}
      {result.surplus > 0 && (
        <p className="mt-3 rounded-2xl bg-teal-50 dark:bg-teal-500/10 px-4 py-3 text-xs text-teal-900 dark:text-teal-200">
          <span className="font-semibold tabular-nums">{taka(result.surplus)}</span> {settlement.surplusNote}
        </p>
      )}
    </div>
  );
}

function SupervisorAction({
  data,
  marking,
  onMarkSettled
}: {
  data: SettlementData;
  marking: boolean;
  onMarkSettled: () => void;
}) {
  if (data.settledAt) return null;

  const waiting = data.members.filter((m) => m.isCurrentMember && m.closeStatus !== PAYMENT_STATUS.PAID);

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      {data.allClear ? (
        <>
          <h2 className="text-lg font-semibold">{settlement.allClearTitle}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{settlement.allClearHint}</p>
          <Button className="mt-4" onClick={onMarkSettled} loading={marking}>
            {settlement.markSettledButton}
          </Button>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold">{settlement.waitingTitle(waiting.length)}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{settlement.waitingHint}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {waiting.map((m) => (
              <li key={m.id} className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {m.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function SettlementPage() {
  const { user } = useCurrentUser();
  const toast = useToast();
  const confirm = useConfirm();
  const { groups, groupId, setGroupId, loadingGroups } = useGroupMonth();

  const [payload, setPayload] = useState<{ canManage: boolean; settlement: SettlementData | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) {
      setPayload(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/final-settlement`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? settlement.loadFailed);
      setPayload(body);
    } catch (err) {
      toast.error((err as Error).message);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleMarkSettled() {
    if (!groupId) return;
    const confirmed = await confirm({
      title: settlement.markSettledConfirmTitle,
      message: settlement.markSettledConfirmMessage,
      confirmLabel: settlement.markSettledButton
    });
    if (!confirmed) return;

    setMarking(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/final-settlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markSettled' })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? settlement.markSettledFailed);
      setPayload(body);
      toast.success(settlement.markSettledSuccess);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setMarking(false);
    }
  }

  const data = payload?.settlement ?? null;
  const mine = data?.members.find((m) => m.id === user?.id) ?? null;

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:py-10">
      <PageTitle title={settlement.title} />
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">{settlement.title}</h1>
        {data && <p className="text-sm text-slate-500 dark:text-slate-400">{settlement.subtitle(formatMonthLabel(data.monthKey))}</p>}
      </div>

      {groups.length > 1 && (
        <div className="mt-4 max-w-xs">
          <Listbox
            label={strings.common.group}
            value={groupId}
            onChange={setGroupId}
            options={groups.map((group) => ({ value: group.id, label: group.name }))}
          />
        </div>
      )}

      <div className="mt-6 space-y-6">
        {loadingGroups || loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{strings.common.loading}</p>
        ) : groups.length === 0 ? (
          <EmptyState title={settlement.notPartOfGroup} />
        ) : !data ? (
          <EmptyState title={settlement.notFinalizedYet} />
        ) : (
          <>
            {mine && mine.closeStatus !== PAYMENT_STATUS.PAID && (
              <div
                className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${
                  mine.dueAtClose > 0.005
                    ? 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10'
                    : 'border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10'
                }`}
              >
                <p className={`text-lg font-semibold ${mine.dueAtClose > 0.005 ? 'text-red-900 dark:text-red-200' : 'text-sky-900 dark:text-sky-200'}`}>
                  {mine.dueAtClose > 0.005 ? settlement.youOwe(taka(Math.abs(mine.dueAtClose))) : settlement.youAreOwed(taka(Math.abs(mine.dueAtClose)))}
                </p>
                {mine.dueAtClose > 0.005 && (
                  <p className="mt-1 text-sm text-red-800 dark:text-red-300">{settlement.payReminder}</p>
                )}
              </div>
            )}
            {mine && mine.closeStatus === PAYMENT_STATUS.PAID && (
              <div className="rounded-3xl border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 p-5 shadow-sm sm:p-6">
                <p className="text-lg font-semibold text-green-900 dark:text-green-200">{settlement.youAreSettled}</p>
              </div>
            )}

            {data.settledAt && (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {data.settledBy ? settlement.settledBanner(data.settledBy, formatDay(data.closedThrough)) : settlement.settledBannerNoActor(formatDay(data.closedThrough))}
                </p>
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400">{settlement.closedThrough(formatDay(data.closedThrough))}</p>

            <MemberSection members={data.members} currentUserId={user?.id} />
            <SettleUpSection result={data.settleUp} />

            {payload?.canManage && <SupervisorAction data={data} marking={marking} onMarkSettled={handleMarkSettled} />}
          </>
        )}
      </div>
    </div>
  );
}
