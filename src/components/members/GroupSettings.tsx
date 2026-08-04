import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ui';
import { GROUP_STATUS, MEAL_RATE_MODES } from '@/lib/constants';
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
};

export default function GroupSettings({ groupId, onChanged }: { groupId: string; onChanged?: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      const data = await res.json().catch(() => ({}));
      setGroup(res.ok ? data.group : null);
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
        <p className="mt-1 text-sm text-slate-500">{strings.groups.statusHint}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-sm ${
              group.status === GROUP_STATUS.ACTIVE ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
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
                ? 'border border-red-200 text-red-600 hover:bg-red-50'
                : 'bg-slate-900 text-white hover:bg-slate-700'
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
        <p className="mt-1 text-sm text-slate-500">{strings.groups.costRulesHint}</p>

        <label className="mt-4 block max-w-md">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {strings.groups.rateLabel}
          </span>
          <select
            value={group.mealRateMode}
            disabled={busy}
            onChange={(event) =>
              patch({ mealRateMode: event.target.value }, strings.groups.rateSaved, strings.groups.settingFailed)
            }
            className="app-select mt-1 disabled:opacity-50"
          >
            <option value={MEAL_RATE_MODES.MONTHLY}>{strings.groups.rateMonthly}</option>
            <option value={MEAL_RATE_MODES.DAILY}>{strings.groups.rateDaily}</option>
          </select>
        </label>
        <p className="mt-2 max-w-xl text-xs text-slate-500">
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
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 disabled:opacity-50"
          />
          <span>
            <span className="text-sm font-medium">{strings.groups.carryLabel}</span>
            <span className="mt-0.5 block text-xs text-slate-500">{strings.groups.carryHint}</span>
          </span>
        </label>
      </Card>
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
      <p className="mt-1 text-sm text-slate-500">{strings.groups.mealWeightsHint}</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={submit}>
        {fields.map((field) => (
          <label key={field.label} className="text-sm">
            <span className="text-slate-600">{field.label}</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={field.value}
              onChange={(event) => field.set(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={busy}
          className="self-end rounded-full bg-slate-900 px-6 py-2.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? strings.common.saving : strings.common.save}
        </button>
      </form>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{children}</div>;
}
