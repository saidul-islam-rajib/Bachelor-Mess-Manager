import { useMemo, useState } from 'react';
import { strings } from '@/lib/i18n';
import { MEAL_RATE_MODES } from '@/lib/constants';
import { formatCurrency, formatDayKey } from '@/lib/format';

export type DailyRate = {
  date: string;
  rate: number;
  groupMeals: number;
  myMeals: number;
  myCost: number;
};

type Props = {
  days: DailyRate[];
  today: string;
  monthRate: number;
  rateMode: string;
  myMeals: number;
  myCost: number;
};

const COLLAPSED_ROWS = 7;

const taka = formatCurrency;

const dayLabel = (date: string) => formatDayKey(date, 'weekdayDayMonth');
const shortDayLabel = (date: string) => formatDayKey(date, 'weekdayDay');

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function MealRateCard({ days, today, monthRate, rateMode, myMeals, myCost }: Props) {
  const copy = strings.meals.rate;
  const [open, setOpen] = useState(false);
  const [expandedDays, setExpandedDays] = useState(false);

  const priced = useMemo(
    () => days.filter((day) => day.rate > 0).sort((a, b) => b.date.localeCompare(a.date)),
    [days]
  );

  const todayRow = priced.find((day) => day.date === today) ?? null;
  const headline = todayRow ?? priced[0] ?? null;
  const isToday = Boolean(todayRow);

  const visible = expandedDays ? priced : priced.slice(0, COLLAPSED_ROWS);
  const isDaily = rateMode === MEAL_RATE_MODES.DAILY;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 bg-gradient-to-br from-brand-50 to-white px-5 py-4 text-left transition-colors hover:from-brand-100 sm:px-6 sm:py-5"
      >
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-brand-700/80">
            {headline ? (isToday ? copy.todayLabel : copy.latestLabel(dayLabel(headline.date))) : copy.title}
          </p>
          {headline ? (
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular-nums text-slate-900 sm:text-4xl">{taka(headline.rate)}</span>
              <span className="text-sm text-slate-500">{copy.perMealUnit}</span>
            </p>
          ) : (
            <p className="mt-1 text-xl font-semibold text-slate-900">{copy.noRateYet}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{copy.monthLabel}</p>
            <p className="text-lg font-semibold tabular-nums text-slate-900">{monthRate > 0 ? taka(monthRate) : '—'}</p>
          </div>
          <Chevron open={open} />
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          <p className="text-sm text-slate-500">
            {headline ? (
              <>
                {copy.yourMealsToday(headline.myMeals)} · {copy.yourCostToday} {taka(headline.myCost)}
              </>
            ) : (
              copy.noRateYetHint
            )}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <Tile label={copy.monthLabel} value={monthRate > 0 ? taka(monthRate) : '—'} />
            <Tile label={copy.yourMealsMonth} value={String(myMeals)} />
            <Tile label={copy.yourCostMonth} value={taka(myCost)} />
          </div>

          <p className="mt-4 text-xs text-slate-500">
            {isDaily ? copy.modeDaily : copy.modeMonthly}. {isDaily ? copy.monthHintDaily : copy.monthHintMonthly}
          </p>

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.dayByDay}</h3>

            {priced.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{copy.noPricedDays}</p>
            ) : (
              <>
                <ul className="mt-2 divide-y divide-slate-100">
                  <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 pb-1.5 text-[11px] uppercase tracking-wide text-slate-400 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                    <span>{copy.colDay}</span>
                    <span className="hidden text-right sm:block">{copy.colGroupMeals}</span>
                    <span className="text-right">{copy.colRate}</span>
                    <span className="text-right">{copy.colYourCost}</span>
                  </li>

                  {visible.map((day) => (
                    <li
                      key={day.date}
                      className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] ${
                        day.date === today ? 'font-medium text-brand-800' : ''
                      }`}
                    >
                      <span className="truncate">
                        <span className="sm:hidden">{shortDayLabel(day.date)}</span>
                        <span className="hidden sm:inline">{dayLabel(day.date)}</span>
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          {copy.colYourMeals} {day.myMeals}
                        </span>
                      </span>
                      <span className="hidden text-right tabular-nums text-slate-500 sm:block">{day.groupMeals}</span>
                      <span className="text-right tabular-nums text-slate-600">{taka(day.rate)}</span>
                      <span className="text-right tabular-nums font-medium">{taka(day.myCost)}</span>
                    </li>
                  ))}
                </ul>

                {priced.length > COLLAPSED_ROWS && (
                  <button
                    type="button"
                    onClick={() => setExpandedDays((value) => !value)}
                    aria-expanded={expandedDays}
                    className="mt-3 min-h-[2.25rem] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
                  >
                    {expandedDays ? copy.showLess : copy.showAll(priced.length)}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5 text-center">
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-slate-900 sm:text-base">{value}</p>
    </div>
  );
}
