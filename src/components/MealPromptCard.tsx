import { useEffect, useState } from 'react';
import { Badge, Button } from '@/components/ui';
import { mealPromptConfig } from '@/config';
import { MEAL_PROMPT_ANSWERS, type MealPromptAnswer } from '@/lib/constants';
import { formatDay } from '@/lib/format';
import { strings } from '@/lib/i18n';

export type MealCounts = { breakfast: number; lunch: number; dinner: number };

export type MealPromptState = {
  groupId: string;
  groupName: string;
  date: string;
  counts: MealCounts;
  planned: MealCounts;
  answer: string | null;
};

const MEALS: { key: keyof MealCounts; label: string }[] = [
  { key: 'breakfast', label: strings.meals.breakfast },
  { key: 'lunch', label: strings.meals.lunch },
  { key: 'dinner', label: strings.meals.dinner }
];

const ANSWER_LABELS: Record<string, string> = {
  [MEAL_PROMPT_ANSWERS.YES]: strings.mealPrompt.answeredYes,
  [MEAL_PROMPT_ANSWERS.NO]: strings.mealPrompt.answeredNo,
  [MEAL_PROMPT_ANSWERS.CUSTOM]: strings.mealPrompt.answeredCustom
};

export function summarizeCounts(counts: MealCounts): string {
  if (counts.breakfast + counts.lunch + counts.dinner === 0) return strings.mealPrompt.noneSummary;
  return strings.mealPrompt.counts(counts.breakfast, counts.lunch, counts.dinner);
}

function Stepper({
  label,
  value,
  disabled,
  onChange
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  const clamp = (next: number) => Math.min(mealPromptConfig.maxCountPerMeal, Math.max(0, next));

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || value <= 0}
          aria-label={`${label} -`}
          onClick={() => onChange(clamp(value - 1))}
        >
          −
        </Button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums">{value}</span>
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || value >= mealPromptConfig.maxCountPerMeal}
          aria-label={`${label} +`}
          onClick={() => onChange(clamp(value + 1))}
        >
          +
        </Button>
      </div>
    </div>
  );
}

export function MealPromptCard({
  prompt,
  busy = false,
  disabled = false,
  compact = false,
  onAnswer
}: {
  prompt: MealPromptState;
  busy?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onAnswer: (answer: MealPromptAnswer, counts?: MealCounts) => void | Promise<void>;
}) {
  const [choosing, setChoosing] = useState(false);
  const [draft, setDraft] = useState<MealCounts>(prompt.counts);

  useEffect(() => {
    setDraft(prompt.counts);
  }, [prompt.counts]);

  const locked = busy || disabled;
  const answered = Boolean(prompt.answer);

  if (compact) {
    return (
      <div className="rounded-3xl border border-brand-100 dark:border-brand-500/30 bg-brand-50/70 dark:bg-brand-500/10 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11h18" />
                <path d="M5 11a7 7 0 0 1 14 0" />
                <path d="M4 15h16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
              </svg>
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{strings.mealPrompt.cardTitle}</p>
                {answered && <Badge tone="success">{ANSWER_LABELS[prompt.answer as string] ?? ''}</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                {strings.mealPrompt.question(prompt.groupName, formatDay(prompt.date))}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {answered
                  ? strings.mealPrompt.savedDetail(summarizeCounts(prompt.counts))
                  : `${strings.mealPrompt.usualHint} ${summarizeCounts(prompt.planned)}.`}
              </p>
            </div>
          </div>

          {!choosing && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button disabled={locked} onClick={() => onAnswer(MEAL_PROMPT_ANSWERS.YES)}>
                {strings.mealPrompt.yes}
              </Button>
              <Button variant="secondary" disabled={locked} onClick={() => onAnswer(MEAL_PROMPT_ANSWERS.NO)}>
                {strings.mealPrompt.no}
              </Button>
              <button
                type="button"
                disabled={locked}
                onClick={() => setChoosing(true)}
                className="rounded-full px-3 py-2 text-sm font-medium text-brand-700 dark:text-brand-400 underline-offset-2 hover:underline disabled:opacity-40"
              >
                {strings.mealPrompt.choose}
              </button>
            </div>
          )}
        </div>

        {choosing && (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {MEALS.map((meal) => (
              <Stepper
                key={meal.key}
                label={meal.label}
                value={draft[meal.key]}
                disabled={locked}
                onChange={(next) => setDraft((current) => ({ ...current, [meal.key]: next }))}
              />
            ))}

            <div className="flex flex-wrap justify-end gap-2 sm:col-span-3">
              <Button variant="secondary" disabled={locked} onClick={() => setChoosing(false)}>
                {strings.common.cancel}
              </Button>
              <Button
                loading={busy}
                disabled={disabled}
                onClick={async () => {
                  await onAnswer(MEAL_PROMPT_ANSWERS.CUSTOM, draft);
                  setChoosing(false);
                }}
              >
                {strings.common.save}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{strings.mealPrompt.cardTitle}</p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {strings.mealPrompt.question(prompt.groupName, formatDay(prompt.date))}
          </p>
        </div>
        {answered && <Badge tone="success">{ANSWER_LABELS[prompt.answer as string] ?? ''}</Badge>}
      </div>

      {answered && (
        <p className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400">
          {strings.mealPrompt.savedDetail(summarizeCounts(prompt.counts))}
        </p>
      )}

      {!choosing ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button fullWidth disabled={locked} onClick={() => onAnswer(MEAL_PROMPT_ANSWERS.YES)}>
              {strings.mealPrompt.yes}
            </Button>
            <Button fullWidth variant="secondary" disabled={locked} onClick={() => onAnswer(MEAL_PROMPT_ANSWERS.NO)}>
              {strings.mealPrompt.no}
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {strings.mealPrompt.usualHint} {summarizeCounts(prompt.planned)}.
            </p>
            <button
              type="button"
              disabled={locked}
              onClick={() => setChoosing(true)}
              className="text-sm font-medium text-slate-700 dark:text-slate-300 underline-offset-2 hover:underline disabled:opacity-40"
            >
              {strings.mealPrompt.choose}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-4 space-y-2">
          {MEALS.map((meal) => (
            <Stepper
              key={meal.key}
              label={meal.label}
              value={draft[meal.key]}
              disabled={locked}
              onChange={(next) => setDraft((current) => ({ ...current, [meal.key]: next }))}
            />
          ))}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="secondary" disabled={locked} onClick={() => setChoosing(false)}>
              {strings.common.cancel}
            </Button>
            <Button
              loading={busy}
              disabled={disabled}
              onClick={async () => {
                await onAnswer(MEAL_PROMPT_ANSWERS.CUSTOM, draft);
                setChoosing(false);
              }}
            >
              {strings.common.save}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MealPromptCard;
