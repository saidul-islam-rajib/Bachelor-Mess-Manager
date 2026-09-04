import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { Listbox, useConfirm } from '@/components/ui';
import { api, errorMessage } from '@/lib/api-client';
import { GROUP_STATUS, MEAL_RATE_MODES, USER_ROLES } from '@/lib/constants';
import { strings } from '@/lib/i18n';

type GroupDetail = {
  id: string;
  name: string;
  status: string;
  mealWeightBreakfast: number;
  mealWeightLunch: number;
  mealWeightDinner: number;
  mealRateMode: string;
  carryForwardEnabled: boolean;
  mealEditRequiresApproval: boolean | null;
  maxSupervisors: number | null;
  bazarReminderEnabled: boolean;
  bazarReminderTime: string;
};

type SupervisorState = {
  supervisors: { id: string; name: string; email: string; isPrimary: boolean }[];
  maxSupervisors: number;
  siteMaxSupervisors: number;
  overriddenByGroup: boolean;
  canAddMore: boolean;
};

type MealEditPolicy = {
  windowMinutes: number;
  requiresApproval: boolean;
  siteRequiresApproval: boolean;
  overriddenByGroup: boolean;
};

const SUPERVISORS_INHERIT = 'INHERIT';
const APPROVAL_INHERIT = 'INHERIT';
const APPROVAL_REQUIRED = 'REQUIRED';
const APPROVAL_AUTO = 'AUTO';

export default function GroupSettings({ groupId, onChanged }: { groupId: string; onChanged?: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useCurrentUser();
  const isAdmin = user?.role === USER_ROLES.ADMIN;
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [policy, setPolicy] = useState<MealEditPolicy | null>(null);
  const [supervisors, setSupervisors] = useState<SupervisorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      const data = await res.json().catch(() => ({}));
      setGroup(res.ok ? data.group : null);
      setPolicy(res.ok ? (data.mealEditPolicy ?? null) : null);
      setSupervisors(res.ok ? (data.supervisors ?? null) : null);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback(
    async (body: Record<string, unknown>, message: string, fallbackError: string) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/groups/${groupId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? fallbackError);
        toast.success(message);
        await load();
        onChanged?.();
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [groupId, load, onChanged, toast]
  );

  async function toggleStatus() {
    if (!group) return;

    const deactivating = group.status === GROUP_STATUS.ACTIVE;
    const accepted = await confirm({
      title: deactivating
        ? strings.groups.deactivateConfirm(group.name)
        : strings.groups.activateConfirm(group.name),
      message: deactivating ? strings.groups.deactivateMessage : strings.groups.activateMessage,
      confirmLabel: deactivating ? strings.groups.deactivate : strings.groups.activate,
      destructive: deactivating
    });
    if (!accepted) return;

    await patch(
      { status: deactivating ? GROUP_STATUS.INACTIVE : GROUP_STATUS.ACTIVE },
      deactivating ? strings.groups.deactivated(group.name) : strings.groups.activated(group.name),
      strings.groups.statusUpdateFailed
    );
  }

  async function sendReminderNow() {
    setSendingReminder(true);
    try {
      const data = await api.post<{ sent: number; message: string }>('/api/bazar-duty/dispatch', { groupId });
      toast.success(data.message);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSendingReminder(false);
    }
  }

  if (loading && !group) {
    return <Card>{strings.common.loading}</Card>;
  }

  if (!group) {
    return <Card>{strings.groups.notFound}</Card>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-semibold">{strings.groups.statusTitle}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{strings.groups.statusHint}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-sm ${
              group.status === GROUP_STATUS.ACTIVE ? 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            {group.status}
          </span>
          <button
            type="button"
            onClick={toggleStatus}
            disabled={busy}
            className={`rounded-full px-5 py-2 text-sm transition-colors disabled:opacity-50 ${
              group.status === GROUP_STATUS.ACTIVE
                ? 'border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50'
                : 'bg-brand-600 shadow-sm shadow-brand-600/20 text-white hover:bg-brand-700 transition-all active:translate-y-px'
            }`}
          >
            {group.status === GROUP_STATUS.ACTIVE ? strings.groups.deactivate : strings.groups.activate}
          </button>
        </div>
      </Card>

      <MealWeights
        key={`${group.id}-weights`}
        initial={{
          breakfast: group.mealWeightBreakfast,
          lunch: group.mealWeightLunch,
          dinner: group.mealWeightDinner
        }}
        busy={busy}
        onSave={(weights) =>
          patch(
            {
              mealWeightBreakfast: weights.breakfast,
              mealWeightLunch: weights.lunch,
              mealWeightDinner: weights.dinner
            },
            strings.groups.mealWeightsSaved,
            strings.groups.mealWeightsFailed
          )
        }
      />

      <Card>
        <h2 className="text-lg font-semibold">{strings.groups.costRulesTitle}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{strings.groups.costRulesHint}</p>

        <Listbox
          className="mt-4 block max-w-md"
          label={strings.groups.rateLabel}
          value={group.mealRateMode}
          disabled={busy}
          onChange={(next) => patch({ mealRateMode: next }, strings.groups.rateSaved, strings.groups.settingFailed)}
          options={[
            { value: MEAL_RATE_MODES.MONTHLY, label: strings.groups.rateMonthly },
            { value: MEAL_RATE_MODES.DAILY, label: strings.groups.rateDaily }
          ]}
        />
        <p className="mt-2 max-w-xl text-xs text-slate-500 dark:text-slate-400">
          {group.mealRateMode === MEAL_RATE_MODES.DAILY
            ? strings.groups.rateDailyHint
            : strings.groups.rateMonthlyHint}
        </p>

        <label className="mt-5 flex max-w-xl cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={group.carryForwardEnabled}
            disabled={busy}
            onChange={(event) =>
              patch(
                { carryForwardEnabled: event.target.checked },
                strings.groups.carrySaved,
                strings.groups.settingFailed
              )
            }
            className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
          />
          <span>
            <span className="text-sm font-medium">{strings.groups.carryLabel}</span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{strings.groups.carryHint}</span>
          </span>
        </label>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{strings.groups.pastMealsTitle}</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{strings.groups.pastMealsHint}</p>

        <Listbox
          className="mt-4 block max-w-md"
          label={strings.groups.pastMealsLabel}
          value={
            group.mealEditRequiresApproval === null || group.mealEditRequiresApproval === undefined
              ? APPROVAL_INHERIT
              : group.mealEditRequiresApproval
                ? APPROVAL_REQUIRED
                : APPROVAL_AUTO
          }
          disabled={busy}
          onChange={(next) =>
            patch(
              {
                mealEditRequiresApproval:
                  next === APPROVAL_INHERIT ? null : next === APPROVAL_REQUIRED
              },
              strings.groups.pastMealsSaved,
              strings.groups.settingFailed
            )
          }
          options={[
            {
              value: APPROVAL_INHERIT,
              label: strings.groups.pastMealsInherit(
                policy?.siteRequiresApproval ?? true ? strings.groups.pastMealsRequired : strings.groups.pastMealsAuto
              )
            },
            { value: APPROVAL_REQUIRED, label: strings.groups.pastMealsRequired },
            { value: APPROVAL_AUTO, label: strings.groups.pastMealsAuto }
          ]}
        />

        <p className="mt-2 max-w-2xl text-xs text-slate-500 dark:text-slate-400">
          {policy?.requiresApproval ? strings.groups.pastMealsRequiredHint : strings.groups.pastMealsAutoHint}
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{strings.groups.bazarReminderTitle}</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{strings.groups.bazarReminderHint}</p>

        <label className="mt-4 flex max-w-xl cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={group.bazarReminderEnabled}
            disabled={busy}
            onChange={(event) =>
              patch(
                { bazarReminderEnabled: event.target.checked },
                event.target.checked ? strings.groups.bazarReminderEnabledSaved : strings.groups.bazarReminderDisabledSaved,
                strings.groups.settingFailed
              )
            }
            className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
          />
          <span>
            <span className="text-sm font-medium">{strings.groups.bazarReminderEnableLabel}</span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              {strings.groups.bazarReminderEnableHint}
            </span>
          </span>
        </label>

        <BazarReminderTimeField
          key={`${group.id}-${group.bazarReminderTime}`}
          initial={group.bazarReminderTime}
          disabled={busy || !group.bazarReminderEnabled}
          onSave={(time) => patch({ bazarReminderTime: time }, strings.groups.bazarReminderTimeSaved, strings.groups.settingFailed)}
        />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
          <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">{strings.groups.bazarReminderSendNowHint}</p>
          <button
            type="button"
            onClick={sendReminderNow}
            disabled={sendingReminder || !group.bazarReminderEnabled}
            className="shrink-0 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {sendingReminder ? strings.groups.bazarReminderSending : strings.groups.bazarReminderSendNow}
          </button>
        </div>
      </Card>

      {isAdmin && supervisors && (
        <Card>
          <h2 className="text-lg font-semibold">{strings.groups.supervisorsForThisMess}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            {strings.groups.supervisorsForThisMessHint}
          </p>

          <Listbox
            className="mt-4 block max-w-md"
            label={strings.groups.supervisorsAllowedLabel}
            value={group.maxSupervisors === null || group.maxSupervisors === undefined ? SUPERVISORS_INHERIT : String(group.maxSupervisors)}
            disabled={busy}
            onChange={(next) =>
              patch(
                { maxSupervisors: next === SUPERVISORS_INHERIT ? null : Number(next) },
                strings.groups.supervisorLimitUpdated,
                strings.groups.settingFailed
              )
            }
            options={[
              {
                value: SUPERVISORS_INHERIT,
                label: strings.groups.followSiteDefault(supervisors.siteMaxSupervisors)
              },
              { value: '1', label: strings.groups.oneOneSupervisor },
              { value: '2', label: strings.groups.twoAllowSecondSupervisor }
            ]}
          />

          <p className="mt-2 max-w-2xl text-xs text-slate-500 dark:text-slate-400">
            {strings.groups.usingOfMax(supervisors.supervisors.length, supervisors.maxSupervisors)}{' '}
            {supervisors.canAddMore
              ? strings.groups.addSecondFromRoster
              : strings.groups.removeFromRosterFirst}
          </p>
        </Card>
      )}
    </div>
  );
}

function MealWeights({
  initial,
  busy,
  onSave
}: {
  initial: { breakfast: number; lunch: number; dinner: number };
  busy: boolean;
  onSave: (weights: { breakfast: number; lunch: number; dinner: number }) => void;
}) {
  const [breakfast, setBreakfast] = useState(String(initial.breakfast));
  const [lunch, setLunch] = useState(String(initial.lunch));
  const [dinner, setDinner] = useState(String(initial.dinner));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ breakfast: Number(breakfast), lunch: Number(lunch), dinner: Number(dinner) });
  }

  const fields = [
    { label: strings.meals.breakfast, value: breakfast, set: setBreakfast },
    { label: strings.meals.lunch, value: lunch, set: setLunch },
    { label: strings.meals.dinner, value: dinner, set: setDinner }
  ];

  return (
    <Card>
      <h2 className="text-lg font-semibold">{strings.groups.mealWeightsTitle}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{strings.groups.mealWeightsHint}</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={submit}>
        {fields.map((field) => (
          <label key={field.label} className="text-sm">
            <span className="text-slate-600 dark:text-slate-400">{field.label}</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={field.value}
              onChange={(event) => field.set(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-2"
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={busy}
          className="self-end rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-6 py-2.5 text-sm text-white hover:bg-brand-700 transition-all active:translate-y-px disabled:opacity-50"
        >
          {busy ? strings.common.saving : strings.common.save}
        </button>
      </form>
    </Card>
  );
}

function BazarReminderTimeField({
  initial,
  disabled,
  onSave
}: {
  initial: string;
  disabled: boolean;
  onSave: (time: string) => void;
}) {
  const [time, setTime] = useState(initial);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(time);
  }

  return (
    <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={submit}>
      <label className="text-sm">
        <span className="text-slate-600 dark:text-slate-400">{strings.groups.bazarReminderTimeLabel}</span>
        <input
          type="time"
          value={time}
          disabled={disabled}
          onChange={(event) => setTime(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-2 disabled:opacity-50"
        />
      </label>
      <button
        type="submit"
        disabled={disabled}
        className="rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-6 py-2.5 text-sm text-white hover:bg-brand-700 transition-all active:translate-y-px disabled:opacity-50"
      >
        {strings.common.save}
      </button>
      <span className="w-full text-xs text-slate-500 dark:text-slate-400">{strings.groups.bazarReminderTimeHint}</span>
    </form>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">{children}</div>;
}
