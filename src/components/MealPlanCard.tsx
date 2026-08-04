import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { MEAL_FIELDS, WEEKDAYS, type MealField } from '@/lib/constants';

export type PlanDay = { weekday: number; enabled: boolean; breakfast: number; lunch: number; dinner: number };

const FIELD_LABELS: Record<MealField, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const FIELD_SHORT: Record<MealField, string> = { breakfast: 'B', lunch: 'L', dinner: 'D' };

const emptyDays = (): PlanDay[] =>
  WEEKDAYS.map((d) => ({ weekday: d.value, enabled: false, breakfast: 0, lunch: 0, dinner: 0 }));
export default function MealPlanCard({ groupId, onApplied }: { groupId: string; onApplied: () => void }) {
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [days, setDays] = useState<PlanDay[]>(emptyDays);
  const [overwriteEdited, setOverwriteEdited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/meal-plan`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not load your meal plan.');
      setIsActive(Boolean(body.plan?.isActive));
      setDays(body.plan?.days?.length === 7 ? body.plan.days : emptyDays());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [groupId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function setDay(weekday: number, patch: Partial<PlanDay>) {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  }

  function copyFirstEnabledToAll() {
    const source = days.find((d) => d.enabled);
    if (!source) {
      toast.info('Turn on a day first, then copy it to the rest.');
      return;
    }
    setDays((prev) =>
      prev.map((d) => ({
        ...d,
        enabled: true,
        breakfast: source.breakfast,
        lunch: source.lunch,
        dinner: source.dinner
      }))
    );
  }

  async function persist(payload: { isActive: boolean; days: PlanDay[]; overwriteEdited: boolean }) {
    const res = await fetch(`/api/groups/${groupId}/meal-plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? 'Could not save your meal plan.');
    return body as { filled?: number };
  }

  function filledMessage(filled: number) {
    return `Plan on — ${filled} upcoming ${filled === 1 ? 'day' : 'days'} filled in.`;
  }

  async function toggleActive(next: boolean) {
    const previous = isActive;
    setIsActive(next);
    setSaving(true);
    try {
      const body = await persist({ isActive: next, days, overwriteEdited: false });
      if (!next) {
        toast.success('Plan off — your upcoming auto-filled days were cleared.');
      } else if (days.every((d) => !d.enabled)) {
        toast.info('Plan is on, but no days are picked yet — tap Edit to choose them.');
      } else {
        toast.success(filledMessage(body.filled ?? 0));
      }
      onApplied();
    } catch (err) {
      setIsActive(previous);
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const body = await persist({ isActive, days, overwriteEdited });
      toast.success(
        isActive ? filledMessage(body.filled ?? 0) : 'Plan off — your upcoming auto-filled days were cleared.'
      );
      onApplied();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const onDays = days.filter((d) => d.enabled);
  const summary = !isActive
    ? 'Off'
    : onDays.length === 0
      ? 'On — but no days selected yet'
      : onDays.map((d) => WEEKDAYS[d.weekday].short).join(', ');

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Default meal plan</h2>
          <p className="mt-1 text-sm text-slate-500">
            Set your usual week once and it repeats — like an alarm. Applies to today and upcoming days only; past days
            never change.
          </p>
          <p className="mt-2 text-sm">
            <span className="text-slate-500">Repeats: </span>
            <span className={`font-medium ${isActive && onDays.length > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
              {loading ? 'Loading...' : summary}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Switch checked={isActive} onChange={toggleActive} disabled={loading || saving} label="Meal plan active" />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Close meal plan editor' : 'Edit meal plan'}
            title={open ? 'Close' : 'Edit meal plan'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            {open ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {open && !loading && (
        <div className="mt-5 border-t border-slate-100 pt-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <QuickButton onClick={() => setDays((p) => p.map((d) => ({ ...d, enabled: true })))}>
              Turn all days on
            </QuickButton>
            <QuickButton onClick={() => setDays((p) => p.map((d) => ({ ...d, enabled: false })))}>
              Turn all days off
            </QuickButton>
            <QuickButton onClick={copyFirstEnabledToAll}>Copy first day to all</QuickButton>
          </div>

          <ul className="space-y-2">
            {days.map((d) => {
              const weekday = WEEKDAYS[d.weekday];
              return (
                <li
                  key={d.weekday}
                  className={`rounded-2xl border p-3 transition-colors sm:p-4 ${
                    d.enabled ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={d.enabled}
                        onChange={(v) => setDay(d.weekday, { enabled: v })}
                        label={`${weekday.label} meals`}
                      />
                      <span className={`font-medium ${d.enabled ? 'text-slate-900' : 'text-slate-400'}`}>
                        {weekday.label}
                      </span>
                      {!d.enabled && <span className="text-xs text-slate-400">off — no meals</span>}
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:w-auto sm:gap-3">
                      {MEAL_FIELDS.map((f) => (
                        <label key={f} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                          <span className={`text-xs ${d.enabled ? 'text-slate-500' : 'text-slate-300'}`}>
                            <span className="sm:hidden">{FIELD_LABELS[f]}</span>
                            <span className="hidden sm:inline">{FIELD_SHORT[f]}</span>
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            inputMode="numeric"
                            disabled={!d.enabled}
                            value={d[f]}
                            onChange={(e) =>
                              setDay(d.weekday, { [f]: Math.max(0, parseInt(e.target.value, 10) || 0) } as Partial<PlanDay>)
                            }
                            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-2 py-1.5 text-center disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300 sm:w-14"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <label className="mt-4 flex items-start gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={overwriteEdited}
              onChange={(e) => setOverwriteEdited(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span>
              Also replace upcoming days I already edited by hand.
              <span className="block text-xs text-slate-400">
                Off by default — one-off changes you made to a specific day are kept.
              </span>
            </span>
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-full bg-brand-600 px-6 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save plan'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOverwriteEdited(false);
                load();
              }}
              className="rounded-full border border-slate-300 px-6 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
  disabled = false
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? 'bg-green-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function QuickButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
    >
      {children}
    </button>
  );
}
