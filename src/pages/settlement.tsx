import { useCallback, useEffect, useState } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import { useGroupMonth } from '@/components/GroupMonthControls';
import { Button, EmptyState, Listbox, PageTitle, useConfirm } from '@/components/ui';
import { MemberDueTable, type MemberDueRow } from '@/components/MemberDueTable';
import { strings } from '@/lib/i18n';
import { formatCurrency, formatDay, formatMonthLabel } from '@/lib/format';
import { PAYMENT_STATUS } from '@/lib/constants';

const settlement = strings.settlement;
const taka = formatCurrency;

type SettlementMember = {
  id: string;
  name: string;
  email: string;
  meals: number;
  mealCost: number;
  billShare: number;
  billShareByType: Record<string, number>;
  totalCost: number;
  payableByType: Record<string, number>;
  bazarPaid: number;
  cashPaid: number;
  paidByType: Record<string, number>;
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
  categoryLabels: Record<string, string>;
  members: SettlementMember[];
  settleUp: { transfers: Transfer[]; unmatched: number; surplus: number };
  allClear: boolean;
};

function MemberSection({
  members,
  currentUserId,
  categoryLabels
}: {
  members: SettlementMember[];
  currentUserId?: string;
  categoryLabels: Record<string, string>;
}) {
  const rows: MemberDueRow[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    isCurrentUser: m.id === currentUserId,
    hasLeft: !m.isCurrentMember,
    payable: m.totalCost,
    paid: m.bazarPaid + m.cashPaid,
    net: -m.dueAtClose,
    payableByType: m.payableByType,
    paidByType: m.paidByType
  }));

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">{strings.payments.memberBalances}</h2>
      <div className="mt-4">
        <MemberDueTable rows={rows} payableLabel={settlement.totalPayable} categoryLabels={categoryLabels} />
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
  settlingId,
  settlingAll,
  onMarkSettled,
  onSettleMember,
  onSettleAll
}: {
  data: SettlementData;
  marking: boolean;
  settlingId: string | null;
  settlingAll: boolean;
  onMarkSettled: () => void;
  onSettleMember: (member: SettlementMember) => void;
  onSettleAll: () => void;
}) {
  if (data.settledAt) return null;

  const waiting = data.members.filter((m) => m.closeStatus !== PAYMENT_STATUS.PAID);
  const everyoneSettled = waiting.length === 0;

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      {everyoneSettled ? (
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
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{settlement.supervisorSettleHint}</p>
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">
            {waiting.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 text-sm">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{m.name}</span>
                  {!m.isCurrentMember && (
                    <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {strings.payments.left}
                    </span>
                  )}
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                    {m.dueAtClose > 0.005
                      ? settlement.memberOwesInline(taka(m.dueAtClose))
                      : settlement.memberOwedInline(taka(Math.abs(m.dueAtClose)))}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={settlingId === m.id}
                  disabled={settlingAll}
                  onClick={() => onSettleMember(m)}
                >
                  {settlement.settleShort}
                </Button>
              </li>
            ))}
          </ul>
          <Button className="mt-4" variant="secondary" onClick={onSettleAll} loading={settlingAll} disabled={settlingId !== null}>
            {settlement.settleAllButton}
          </Button>
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
  const [settling, setSettling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [settlingAll, setSettlingAll] = useState(false);

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

  async function handleSettleMine(due: number) {
    if (!groupId) return;
    const owed = due < 0;
    const amount = taka(Math.abs(due));
    const confirmed = await confirm({
      title: owed ? settlement.settleOwedTitle : settlement.settleDueTitle,
      message: owed ? settlement.settleOwedMessage(amount) : settlement.settleDueMessage(amount),
      confirmLabel: settlement.settleConfirm,
      destructive: owed
    });
    if (!confirmed) return;

    setSettling(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/final-settlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settleMember' })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? settlement.settleFailed);
      setPayload(body);
      toast.success(settlement.settleSuccess);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSettling(false);
    }
  }

  async function handleSettleMember(member: SettlementMember) {
    if (!groupId) return;
    const owed = member.dueAtClose < 0;
    const amount = taka(Math.abs(member.dueAtClose));
    const confirmed = await confirm({
      title: settlement.settleMemberConfirmTitle(member.name),
      message: owed
        ? settlement.settleMemberOwedMessage(member.name, amount)
        : settlement.settleMemberOwesMessage(member.name, amount),
      confirmLabel: settlement.settleConfirm,
      destructive: owed
    });
    if (!confirmed) return;

    setSettlingId(member.id);
    try {
      const res = await fetch(`/api/groups/${groupId}/final-settlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settleMember', userId: member.id })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? settlement.settleFailed);
      setPayload(body);
      toast.success(settlement.settleMemberSuccess(member.name));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSettlingId(null);
    }
  }

  async function handleSettleAll() {
    if (!groupId || !data) return;
    const pending = data.members.filter((m) => m.closeStatus !== PAYMENT_STATUS.PAID).length;
    const confirmed = await confirm({
      title: settlement.settleAllConfirmTitle,
      message: settlement.settleAllConfirmMessage(pending),
      confirmLabel: settlement.settleAllButton,
      destructive: true
    });
    if (!confirmed) return;

    setSettlingAll(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/final-settlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settleAll' })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? settlement.settleAllFailed);
      setPayload(body);
      toast.success(settlement.settleAllSuccess(pending));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSettlingAll(false);
    }
  }

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
                <button
                  type="button"
                  onClick={() => handleSettleMine(mine.dueAtClose)}
                  disabled={settling}
                  className="mt-4 inline-flex min-h-[2.5rem] items-center rounded-full border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {settling ? strings.common.saving : settlement.settleMineButton}
                </button>
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

            <MemberSection members={data.members} currentUserId={user?.id} categoryLabels={data.categoryLabels} />
            <SettleUpSection result={data.settleUp} />

            {payload?.canManage && (
              <SupervisorAction
                data={data}
                marking={marking}
                settlingId={settlingId}
                settlingAll={settlingAll}
                onMarkSettled={handleMarkSettled}
                onSettleMember={handleSettleMember}
                onSettleAll={handleSettleAll}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
