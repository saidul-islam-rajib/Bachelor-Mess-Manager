import { useMemo, useState } from 'react';
import { strings } from '@/lib/i18n';
import { MEAL_RATE_MODES } from '@/lib/constants';

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

const taka = (value: number) => `৳${value.toFixed(2)}`;

function dayLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  });
}

function shortDayLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

export default function MealRateCard({ days, today, monthRate, rateMode, myMeals, myCost }: Props) {
  const copy = strings.meals.rate;
  const [expanded, setExpanded] = useState(false);

  const priced = useMemo(
    () => days.filter((day) => day.rate > 0).sort((a, b) => b.date.localeCompare(a.date)),
    [days]
  );

  const todayRow = priced.find((day) => day.date === today) ?? null;
  const headline = todayRow ?? priced[0] ?? null;
  const isToday = Boolean(todayRow);

  const visible = expanded ? priced : priced.slice(0, COLLAPSED_ROWS);
  const isDaily = rateMode === MEAL_RATE_MODES.DAILY;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-5 py-6 text-white sm:px-6">
        <p className="text-xs font-medium uppercase tracking-wide text-white/70">
          {headline ? (isToday ? copy.todayLabel : copy.latestLabel(dayLabel(headline.date))) : copy.title}
        </p>

        {headline ? (
          <>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tabular-nums sm:text-5xl">{taka(headline.rate)}</span>
              <span className="text-sm text-white/80">{copy.perMealUnit}</span>
            </p>
            <p className="mt-2 text-sm text-white/85">
              {copy.yourMealsToday(headline.myMeals)} · {copy.yourCostToday} {taka(headline.myCost)}
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-2xl font-semibold sm:text-3xl">{copy.noRateYet}</p>
            <p className="mt-2 text-sm text-white/85">{copy.noRateYetHint}</p>
          </>
        )}
      </div>

      <dl className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        <Tile label={copy.monthLabel} value={monthRate > 0 ? taka(monthRate) : '—'} />
        <Tile label={copy.yourMealsMonth} value={String(myMeals)} />
        <Tile label={copy.yourCostMonth} value={taka(myCost)} />
      </dl>

      <p className="px-5 pt-3 text-xs text-slate-500 sm:px-6">
        {isDaily ? copy.modeDaily : copy.modeMonthly}. {isDaily ? copy.monthHintDaily : copy.monthHintMonthly}
      </p>

      <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
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
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
                className="mt-3 min-h-[2.25rem] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
              >
                {expanded ? copy.showLess : copy.showAll(priced.length)}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3 text-center sm:px-4">
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-base font-semibold tabular-nums sm:text-lg">{value}</dd>
    </div>
  );
}
