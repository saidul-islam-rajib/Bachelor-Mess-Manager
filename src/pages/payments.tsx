import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import { GroupMonthControls, useGroupMonth } from '@/components/GroupMonthControls';
import { Listbox, ListboxControl, PageTitle } from '@/components/ui';
import { strings } from '@/lib/i18n';
import { daysInMonth, todayKey } from '@/lib/month';
import { PAYMENT_STATUS } from '@/lib/constants';

const payments = strings.payments;

type MemberRow = {
  id: string;
  name: string;
  email: string;
  meals: number;
  carryIn: number;
  mealCost: number;
  billShare: number;
  billShareByType: Record<string, number>;
  cost: number;
  bazarPaid: number;
  collected: number;
  due: number;
  status: string;
  isActive: boolean;
};

type Payment = {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  date: string;
  billId: string | null;
  billType: string | null;
  isReversal: boolean;
  isReversed: boolean;
};

type DayRate = {
  date: string;
  meals: number;
  bazar: number;
  charged: number;
  rate: number;
  runningRate: number;
  cost: number;
};

type Totals = {
  bazar: number;
  bills: number;
  expense: number;
  cost: number;
  carryIn: number;
  mealRate: number;
  averageDayRate: number;
  ratioRate: number;
  pricedDays: number;
  meals: number;
  collected: number;
  outstanding: number;
  refunds: number;
  unallocatedBazar: number;
  unpricedMeals: number;
};

type PaymentsData = {
  canManage: boolean;
  currentUserId?: string;
  rateMode: string;
  effectiveRateMode: string;
  rateModeFallbackReason: string | null;
  categoryLabels: Record<string, string>;
  closing: { closedAt: string; closedThrough: string; closedBy: string | null } | null;
  members: MemberRow[];
  days: DayRate[];
  payments: Payment[];
  totals: Totals;
  byType: Record<string, number>;
};

const taka = (n: number) => `৳${n.toFixed(2)}`;
const sum = (rows: MemberRow[], pick: (row: MemberRow) => number) =>
  rows.reduce((total, row) => total + pick(row), 0);

export default function PaymentsPage() {
  const { user } = useCurrentUser();
  const toast = useToast();
  const { groups, groupId, setGroupId, month, setMonth, loadingGroups } = useGroupMonth();

  const [data, setData] = useState<PaymentsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [payerId, setPayerId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayKey());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/payments?month=${month}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? payments.loadFailed);
      setData(body);
    } catch (err) {
      toast.error((err as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, month, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function record(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payerId) {
      toast.error(strings.payments.selectMember);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: payerId, amount: Number(amount), date })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? payments.recordFailed);
      toast.success(payments.recorded);
      setAmount('');
      setPayerId('');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(payments.reverseConfirm)) {
      return;
    }
    try {
      const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? payments.reverseFailed);
      toast.success(payments.reversed);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const canManage = data?.canManage ?? false;

  return (
    <section className="mx-auto max-w-content px-4 py-8 sm:py-10">
      <PageTitle title={payments.title} />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">{payments.title}</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">{canManage ? payments.subtitleManage : payments.subtitleMember}</p>
      </div>

      {loadingGroups ? (
        <Card>{strings.common.loading}</Card>
      ) : groups.length === 0 ? (
        <Card>{payments.notPartOfGroup}</Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <GroupMonthControls groups={groups} groupId={groupId} setGroupId={setGroupId} month={month} setMonth={setMonth} />
          </Card>

          {loading || !data ? (
            <Card>{payments.loadingPayments}</Card>
          ) : (
            <>
              {data.closing && (
                <div className="rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-5 py-4 text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">{payments.monthClosedPre}</span>{' '}
                  {payments.monthClosedThrough(data.closing.closedThrough)}
                  {data.closing.closedBy ? payments.monthClosedBy(data.closing.closedBy) : ''}
                  {payments.monthClosedPost}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
                <Stat label={payments.bazar} value={taka(data.totals.bazar)} />
                <Stat label={payments.bills} value={taka(data.totals.bills)} />
                <Stat label={payments.collected} value={taka(data.totals.collected)} tone="green" />
                <Stat label={payments.outstanding} value={taka(data.totals.outstanding)} tone="red" />
                <Stat label={payments.toRefund} value={taka(data.totals.refunds)} />
              </div>

              {canManage && (
                <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-semibold">{payments.record}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{payments.recordHint}</p>
                  <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_auto_auto]" onSubmit={record}>
                    <ListboxControl
                      value={payerId}
                      onChange={setPayerId}
                      placeholder={payments.selectMemberOption}
                      buttonClassName="!rounded-xl !py-2"
                      options={[
                        { value: '', label: payments.selectMemberOption },
                        ...data.members.map((m) => ({
                          value: m.id,
                          label: `${m.name}${m.id === user?.id ? ` (${strings.common.you})` : ''}`
                        }))
                      ]}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      placeholder={payments.amountPlaceholder}
                      className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-2"
                    />
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-2"
                    />
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-6 py-2 text-sm text-white hover:bg-brand-700 transition-all active:translate-y-px disabled:opacity-50"
                    >
                      {saving ? payments.recording : payments.recordButton}
                    </button>
                  </form>
                </div>
              )}

              {canManage && (
                <CloseMonth
                  groupId={groupId}
                  month={month}
                  members={data.members}
                  closing={data.closing}
                  outstanding={data.totals.outstanding}
                  onChanged={load}
                />
              )}

              <MemberBalances members={data.members} currentUserId={user?.id} totals={data.totals} />
              <MemberCostBreakdown
                members={data.members}
                labels={data.categoryLabels}
                byType={data.byType}
                totals={data.totals}
                currentUserId={user?.id}
              />
              <MealRateBreakdown
                days={data.days}
                totals={data.totals}
                effectiveRateMode={data.effectiveRateMode}
                members={data.members}
                currentUserId={user?.id}
              />
              <PaymentLog
                payments={data.payments}
                canManage={canManage}
                categoryLabels={data.categoryLabels}
                onRemove={remove}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function lastDayOfMonth(month: string): string {
  const days = daysInMonth(month);
  return days[days.length - 1];
}

function CloseMonth({
  groupId,
  month,
  members,
  closing,
  outstanding,
  onChanged
}: {
  groupId: string;
  month: string;
  members: MemberRow[];
  closing: PaymentsData['closing'];
  outstanding: number;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [through, setThrough] = useState(() => lastDayOfMonth(month));
  const [scope, setScope] = useState<'GROUP' | 'MEMBERS'>('GROUP');
  const [selected, setSelected] = useState<string[]>([]);
  const [endMembership, setEndMembership] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setThrough(lastDayOfMonth(month));
    setOpen(false);
    setSelected([]);
  }, [month]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (scope === 'MEMBERS' && selected.length === 0) {
      toast.error(payments.pickAtLeastOneMember);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/closings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          through,
          note,
          userIds: scope === 'MEMBERS' ? selected : undefined,
          endMembership: scope === 'MEMBERS' && endMembership
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? payments.closeFailed);

      toast.success(payments.closedSummary(body.members, taka(body.carriedForward)));
      setOpen(false);
      setSelected([]);
      setNote('');
      await onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (closing) {
    return (
      <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">{payments.monthClosedTitle}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {payments.closedThroughHint(
            closing.closedThrough,
            closing.closedBy ? payments.monthClosedBy(closing.closedBy) : '.'
          )}
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-4 rounded-full border border-slate-300 dark:border-slate-600 px-5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          {open ? payments.cancel : payments.closeForMoreMembers}
        </button>
        {open && (
          <CloseForm
            through={through}
            setThrough={setThrough}
            scope="MEMBERS"
            setScope={setScope}
            members={members}
            selected={selected}
            setSelected={setSelected}
            endMembership={endMembership}
            setEndMembership={setEndMembership}
            note={note}
            setNote={setNote}
            saving={saving}
            onSubmit={submit}
            lockScope
          />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{payments.closeMonthTitle}</h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">{payments.stillOutstanding(taka(outstanding))}</span>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{payments.closeMonthHint}</p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-all active:translate-y-px"
        >
          {payments.closeButton(month)}
        </button>
      ) : (
        <CloseForm
          through={through}
          setThrough={setThrough}
          scope={scope}
          setScope={setScope}
          members={members}
          selected={selected}
          setSelected={setSelected}
          endMembership={endMembership}
          setEndMembership={setEndMembership}
          note={note}
          setNote={setNote}
          saving={saving}
          onSubmit={submit}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function CloseForm({
  through,
  setThrough,
  scope,
  setScope,
  members,
  selected,
  setSelected,
  endMembership,
  setEndMembership,
  note,
  setNote,
  saving,
  onSubmit,
  onCancel,
  lockScope
}: {
  through: string;
  setThrough: (value: string) => void;
  scope: 'GROUP' | 'MEMBERS';
  setScope: (value: 'GROUP' | 'MEMBERS') => void;
  members: MemberRow[];
  selected: string[];
  setSelected: (value: string[]) => void;
  endMembership: boolean;
  setEndMembership: (value: boolean) => void;
  note: string;
  setNote: (value: string) => void;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  lockScope?: boolean;
}) {
  function toggle(id: string) {
    setSelected(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4 border-t border-slate-100 dark:border-slate-700 pt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{payments.closeThrough}</span>
          <input
            type="date"
            value={through}
            onChange={(e) => setThrough(e.target.value)}
            required
            className="mt-1 w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-4 py-2.5"
          />
        </label>

        {!lockScope && (
          <Listbox
            className="block"
            label={payments.closeFor}
            value={scope}
            onChange={(next) => setScope(next as 'GROUP' | 'MEMBERS')}
            options={[
              { value: 'GROUP', label: payments.everyoneInMess },
              { value: 'MEMBERS', label: payments.selectedMembersOnly }
            ]}
          />
        )}
      </div>

      {scope === 'MEMBERS' && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{payments.membersLabel}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {members.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => toggle(member.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    selected.includes(member.id)
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {member.name}
                  <span className="ml-1.5 text-xs opacity-70">{taka(member.due)}</span>
                </button>
              </li>
            ))}
          </ul>

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={endMembership}
              onChange={(e) => setEndMembership(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
            />
            {payments.leavingOnThisDate}
          </label>
        </div>
      )}

      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{payments.notePlaceholder}</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder={payments.noteExample}
          className="mt-1 w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-4 py-2.5"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-5 py-2.5 text-sm text-white hover:bg-brand-700 transition-all active:translate-y-px disabled:opacity-50"
        >
          {saving ? payments.closing : payments.confirmClose}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {payments.cancel}
          </button>
        )}
      </div>
    </form>
  );
}

function MemberBalances({
  members,
  currentUserId,
  totals
}: {
  members: MemberRow[];
  currentUserId?: string;
  totals: Totals;
}) {
  const hasOpening = members.some((m) => Math.abs(m.carryIn) > 0.005);
  const columns = hasOpening ? 10 : 9;

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">{payments.memberBalances}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {hasOpening ? payments.balanceFormulaWithCarryIn : payments.balanceFormula}
      </p>

      {members.length === 0 ? (
        <p className="mt-4 text-slate-500 dark:text-slate-400">{payments.noMembersThisMonth}</p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2">{payments.member}</th>
                  <th className="px-3 py-2 text-right">{payments.meals}</th>
                  {hasOpening && <th className="px-3 py-2 text-right">{payments.broughtForward}</th>}
                  <th className="px-3 py-2 text-right">{payments.mealShare}</th>
                  <th className="px-3 py-2 text-right">{payments.billsShare}</th>
                  <th className="px-3 py-2 text-right">{payments.totalCost}</th>
                  <th className="px-3 py-2 text-right">{payments.boughtGroceries}</th>
                  <th className="px-3 py-2 text-right">{payments.cashPaid}</th>
                  <th className="px-3 py-2 text-right">{payments.due}</th>
                  <th className="px-3 py-2 text-right">{payments.status}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <td className="px-3 py-3 font-medium">
                      {m.name}
                      {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600 dark:text-green-400">({strings.common.you})</span>}
                      {!m.isActive && (
                        <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {payments.left}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{m.meals}</td>
                    {hasOpening && <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{taka(m.carryIn)}</td>}
                    <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{taka(m.mealCost)}</td>
                    <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{taka(m.billShare)}</td>
                    <td className="px-3 py-3 text-right font-medium">{taka(m.cost)}</td>
                    <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{taka(m.bazarPaid)}</td>
                    <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{taka(m.collected)}</td>
                    <td className={`px-3 py-3 text-right font-semibold ${m.due > 0.005 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {taka(Math.abs(m.due))}
                      {m.due < -0.005 && <span className="ml-1 text-xs font-normal">{payments.refund}</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <StatusBadge status={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 text-sm font-semibold">
                  <td className="px-3 py-3">{payments.groupTotal}</td>
                  <td className="px-3 py-3 text-right">{totals.meals}</td>
                  {hasOpening && <td className="px-3 py-3 text-right">{taka(totals.carryIn)}</td>}
                  <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.mealCost))}</td>
                  <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.billShare))}</td>
                  <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.cost))}</td>
                  <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.bazarPaid))}</td>
                  <td className="px-3 py-3 text-right">{taka(totals.collected)}</td>
                  <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.due))}</td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={columns} className="px-3 pb-1 pt-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                    {payments.footerFootnote(taka(totals.bazar), taka(totals.bills))}
                  </td>
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
                    {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600 dark:text-green-400">({strings.common.you})</span>}
                  </p>
                  <StatusBadge status={m.status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <Field label={payments.meals} value={String(m.meals)} />
                  {hasOpening && <Field label={payments.broughtForward} value={taka(m.carryIn)} />}
                  <Field label={payments.mealShare} value={taka(m.mealCost)} />
                  <Field label={payments.billsShare} value={taka(m.billShare)} />
                  <Field label={payments.totalCost} value={taka(m.cost)} />
                  <Field label={payments.boughtGroceries} value={taka(m.bazarPaid)} />
                  <Field label={payments.cashPaid} value={taka(m.collected)} />
                </dl>
                <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 dark:border-slate-700 pt-3">
                  <span className="text-sm text-slate-500 dark:text-slate-400">{m.due < -0.005 ? payments.refundOwed : payments.due}</span>
                  <span className={`text-base font-semibold ${m.due > 0.005 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {taka(Math.abs(m.due))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function MemberCostBreakdown({
  members,
  labels,
  byType,
  totals,
  currentUserId
}: {
  members: MemberRow[];
  labels: Record<string, string>;
  byType: Record<string, number>;
  totals: Totals;
  currentUserId?: string;
}) {
  const types = Object.keys(byType)
    .filter((code) => Math.abs(byType[code]) > 0.005)
    .sort((a, b) => byType[b] - byType[a]);

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">{payments.whoIsChargedWhat}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{payments.whoIsChargedWhatHint}</p>

      {members.length === 0 ? (
        <p className="mt-4 text-slate-500 dark:text-slate-400">{payments.noMembersThisMonth}</p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto lg:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2">{payments.member}</th>
                  <th className="px-3 py-2 text-right">{payments.meals}</th>
                  <th className="px-3 py-2 text-right">{payments.bazarBought}</th>
                  <th className="px-3 py-2 text-right">{payments.mealShare}</th>
                  {types.map((code) => (
                    <th key={code} className="px-3 py-2 text-right">
                      {labels[code] ?? code}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">{payments.totalCharged}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <td className="px-3 py-3 font-medium">
                      {m.name}
                      {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600 dark:text-green-400">({strings.common.you})</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{m.meals}</td>
                    <td className="px-3 py-3 text-right font-medium text-green-700 dark:text-green-400">{taka(m.bazarPaid)}</td>
                    <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{taka(m.mealCost)}</td>
                    {types.map((code) => (
                      <td key={code} className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">
                        {taka(m.billShareByType?.[code] ?? 0)}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-semibold">{taka(m.mealCost + m.billShare)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-semibold">
                  <td className="px-3 py-3">{payments.groupTotal}</td>
                  <td className="px-3 py-3 text-right">{totals.meals}</td>
                  <td className="px-3 py-3 text-right text-green-700 dark:text-green-400">{taka(sum(members, (m) => m.bazarPaid))}</td>
                  <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.mealCost))}</td>
                  {types.map((code) => (
                    <td key={code} className="px-3 py-3 text-right">
                      {taka(byType[code])}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right">{taka(sum(members, (m) => m.mealCost + m.billShare))}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <ul className="mt-4 space-y-3 lg:hidden">
            {members.map((m) => (
              <li key={m.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {m.name}
                    {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600 dark:text-green-400">({strings.common.you})</span>}
                  </p>
                  <span className="text-sm font-semibold">{taka(m.mealCost + m.billShare)}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <Field label={payments.meals} value={String(m.meals)} />
                  <Field label={payments.bazarBought} value={taka(m.bazarPaid)} />
                  <Field label={payments.mealShare} value={taka(m.mealCost)} />
                  {types.map((code) => (
                    <Field key={code} label={labels[code] ?? code} value={taka(m.billShareByType?.[code] ?? 0)} />
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function MealRateBreakdown({
  days,
  totals,
  effectiveRateMode,
  members,
  currentUserId
}: {
  days: DayRate[];
  totals: Totals;
  effectiveRateMode: string;
  members: MemberRow[];
  currentUserId?: string;
}) {
  const daily = effectiveRateMode === 'DAILY';
  const priced = days.filter((day) => day.meals > 0 || day.bazar > 0);
  const bazarBuyers = members.filter((m) => m.bazarPaid > 0.005);

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{payments.mealRateTitle}</h2>
        <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-400">
          {daily ? payments.pricedDayByDay : payments.oneRateForMonth}
        </span>
      </div>

      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {payments.monthRateFormula(taka(totals.bazar), totals.meals)}
        <span className="font-semibold text-slate-900 dark:text-slate-100">{taka(totals.mealRate)}</span>
        {payments.monthRateSuffix}
      </p>

      {daily && (
        <p className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {payments.dailyExplanationPre}
          {taka(totals.averageDayRate)}
          {payments.dailyExplanationMid(totals.pricedDays)}
        </p>
      )}

      {daily && totals.unallocatedBazar > 0.005 && (
        <p className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          {payments.unallocatedNote(taka(totals.unallocatedBazar))}
        </p>
      )}

      {priced.length === 0 ? (
        <p className="mt-4 text-slate-500 dark:text-slate-400">{payments.nothingRecordedYet}</p>
      ) : (
        <div className="mt-4 max-h-80 overflow-auto rounded-2xl border border-slate-100 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2">{payments.colDay}</th>
                <th className="px-3 py-2 text-right">{payments.meals}</th>
                <th className="px-3 py-2 text-right">{payments.colBazarSpent}</th>
                {daily && <th className="px-3 py-2 text-right">{payments.colBazarUsed}</th>}
                <th className="px-3 py-2 text-right">{payments.colRateThatDay}</th>
                <th className="px-3 py-2 text-right" title={payments.runningRateTooltip}>
                  {payments.colRunningRate}
                </th>
                <th className="px-3 py-2 text-right" title={payments.atThatDaysPriceTooltip}>
                  {payments.colAtThatDaysPrice}
                </th>
              </tr>
            </thead>
            <tbody>
              {priced.map((day) => (
                <tr key={day.date} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-3 py-2 font-medium">{day.date}</td>
                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{day.meals}</td>
                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{day.bazar > 0 ? taka(day.bazar) : '—'}</td>
                  {daily && (
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{day.charged > 0 ? taka(day.charged) : '—'}</td>
                  )}
                  <td className="px-3 py-2 text-right font-medium text-slate-900 dark:text-slate-100">
                    {day.meals > 0 ? taka(day.rate) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                    {day.runningRate > 0 ? taka(day.runningRate) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{day.meals > 0 ? taka(day.cost) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-semibold">
                <td className="px-3 py-2">{payments.total}</td>
                <td className="px-3 py-2 text-right">{totals.meals}</td>
                <td className="px-3 py-2 text-right">{taka(totals.bazar)}</td>
                {daily && <td className="px-3 py-2 text-right">{taka(totals.bazar)}</td>}
                <td className="px-3 py-2 text-right">{taka(totals.mealRate)}</td>
                <td className="px-3 py-2 text-right">
                  {days.length > 0 ? taka(days[days.length - 1].runningRate) : '—'}
                </td>
                <td className="px-3 py-2 text-right">{taka(days.reduce((a, d) => a + d.cost, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold">{payments.bazarByMemberTitle}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{payments.bazarByMemberHint}</p>

      {bazarBuyers.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{payments.noBazarRecorded}</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2">{payments.colMember}</th>
                <th className="px-3 py-2 text-right">{payments.bazarBought}</th>
                <th className="px-3 py-2 text-right">{payments.colShareOfBazar}</th>
                <th className="px-3 py-2 text-right">{payments.colPerMealEaten}</th>
              </tr>
            </thead>
            <tbody>
              {bazarBuyers.map((m) => (
                <tr key={m.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-3 py-2 font-medium">
                    {m.name}
                    {m.id === currentUserId && <span className="ml-1 text-xs font-normal text-green-600 dark:text-green-400">({strings.common.you})</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-green-700 dark:text-green-400">{taka(m.bazarPaid)}</td>
                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                    {totals.bazar > 0 ? `${Math.round((m.bazarPaid / totals.bazar) * 100)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                    {totals.meals > 0 ? taka(m.bazarPaid / totals.meals) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-semibold">
                <td className="px-3 py-2">{payments.total}</td>
                <td className="px-3 py-2 text-right">{taka(sum(bazarBuyers, (m) => m.bazarPaid))}</td>
                <td className="px-3 py-2 text-right">100%</td>
                <td className="px-3 py-2 text-right">{taka(totals.mealRate)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function PaymentLog({
  payments: paymentRows,
  canManage,
  categoryLabels,
  onRemove
}: {
  payments: Payment[];
  canManage: boolean;
  categoryLabels: Record<string, string>;
  onRemove: (id: string) => void;
}) {
  const total = paymentRows.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{payments.received}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{payments.countSummary(paymentRows.length, taka(total))}</p>
      </div>
      {paymentRows.length === 0 ? (
        <p className="mt-4 text-slate-500 dark:text-slate-400">{payments.noPaymentsRecorded}</p>
      ) : (
        <>
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">
          {paymentRows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className={`font-medium ${p.isReversed ? 'text-slate-400 dark:text-slate-500 line-through' : ''}`}>
                  {p.userName}
                  {p.billId && (
                    <span className="ml-2 rounded-full bg-brand-50 dark:bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-400">
                      {payments.billBadgeSuffix(categoryLabels[p.billType ?? ''] ?? p.billType ?? '')}
                    </span>
                  )}
                  {p.isReversal && (
                    <span className="ml-2 rounded-full bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-400">
                      {payments.correctionBadge}
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {p.date}
                  {p.isReversed && <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{payments.reversedBadge}</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`font-semibold tabular-nums ${
                    p.amount < 0 ? 'text-rose-600 dark:text-rose-400' : p.isReversed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {p.amount < 0 ? `−${taka(Math.abs(p.amount))}` : taka(p.amount)}
                </span>
                {canManage && !p.isReversal && !p.isReversed && (
                  <button
                    onClick={() => onRemove(p.id)}
                    className="rounded-full border border-red-200 dark:border-red-500/30 px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50"
                  >
                    {payments.reverse}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">{payments.neverEditedFootnote}</p>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    [PAYMENT_STATUS.PAID]: 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 ring-green-600/20',
    [PAYMENT_STATUS.PARTIAL]: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-600/20',
    [PAYMENT_STATUS.PENDING]: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-red-600/20',
    [PAYMENT_STATUS.REFUND]: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-600/20'
  };
  const label: Record<string, string> = {
    [PAYMENT_STATUS.PAID]: payments.statusSettled,
    [PAYMENT_STATUS.PARTIAL]: payments.statusPartlyPaid,
    [PAYMENT_STATUS.PENDING]: payments.statusUnpaid,
    [PAYMENT_STATUS.REFUND]: payments.statusRefundDue
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status] ?? styles.PENDING}`}>
      {label[status] ?? status}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-green-600 dark:text-green-400' : tone === 'red' ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100';
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold sm:text-2xl ${color}`}>{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm text-slate-600 dark:text-slate-400 sm:p-6">{children}</div>;
}
