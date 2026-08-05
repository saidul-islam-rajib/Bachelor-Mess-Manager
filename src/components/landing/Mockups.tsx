import { Fragment, type ReactNode } from 'react';
import { Avatar } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { strings } from '@/lib/i18n';

const MEMBERS = ['Rakib Hasan', 'Tanvir Ahmed', 'Nayeem Islam', 'Sabbir Rahman'] as const;

const MONTH_LABEL = 'July 2026';

const MEAL_ROWS = [
  { name: MEMBERS[0], breakfast: true, lunch: true, dinner: true },
  { name: MEMBERS[1], breakfast: false, lunch: true, dinner: true },
  { name: MEMBERS[2], breakfast: true, lunch: false, dinner: true },
  { name: MEMBERS[3], breakfast: false, lunch: true, dinner: true }
];

const MEAL_WEIGHTS = { breakfast: 0.5, lunch: 1, dinner: 1 };

const BAZAR_ITEMS = [
  { name: 'Rice 5kg', amount: 420 },
  { name: 'Chicken 2kg', amount: 680 },
  { name: 'Vegetables', amount: 260 },
  { name: 'Cooking oil 1L', amount: 190 }
];

const SPEND_BREAKDOWN = [
  { label: strings.expenseTypes.BAZAR, amount: 13108 },
  { label: strings.expenseTypes.RENT, amount: 9000 },
  { label: strings.expenseTypes.CHEF, amount: 3000 },
  { label: strings.expenseTypes.ELECTRICITY, amount: 2400 },
  { label: strings.expenseTypes.WIFI, amount: 1200 }
];

const BILLS_SHARE_PER_MEMBER = 980;

const BALANCE_ROWS = [
  { name: MEMBERS[0], meals: 74, bought: 5200, paid: 0 },
  { name: MEMBERS[1], meals: 68, bought: 0, paid: 3000 },
  { name: MEMBERS[2], meals: 59, bought: 1550, paid: 1000 },
  { name: MEMBERS[3], meals: 71, bought: 0, paid: 2500 }
];

export const TOTAL_BAZAR = SPEND_BREAKDOWN[0].amount;
export const TOTAL_MEALS = BALANCE_ROWS.reduce((sum, row) => sum + row.meals, 0);
export const MEAL_RATE = TOTAL_BAZAR / TOTAL_MEALS;

function mealsFor(row: (typeof MEAL_ROWS)[number]) {
  return (
    (row.breakfast ? MEAL_WEIGHTS.breakfast : 0) +
    (row.lunch ? MEAL_WEIGHTS.lunch : 0) +
    (row.dinner ? MEAL_WEIGHTS.dinner : 0)
  );
}

function balanceFor(row: (typeof BALANCE_ROWS)[number]) {
  const mealShare = row.meals * MEAL_RATE;
  return { mealShare, due: mealShare + BILLS_SHARE_PER_MEMBER - row.bought - row.paid };
}

function AppFrame({ path, label, children }: { path: string; label: string; children: ReactNode }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        </div>
        <div className="min-w-0 flex-1 truncate rounded-full bg-white px-3 py-1 text-[10px] text-slate-400 sm:text-[11px]">
          {path}
        </div>
      </div>
      <div className="p-3 sm:p-5">{children}</div>
    </div>
  );
}

function PreviewHeading({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {meta && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">{meta}</span>}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
      <div className="text-[9px] uppercase leading-tight tracking-wide text-slate-500 sm:text-[10px]">{label}</div>
      <div className={`mt-1 truncate text-sm font-semibold tabular-nums sm:text-lg ${color}`}>{value}</div>
    </div>
  );
}

export function DashboardPreview() {
  const maxAmount = Math.max(...SPEND_BREAKDOWN.map((row) => row.amount));
  const viewer = BALANCE_ROWS[0];
  const viewerBalance = balanceFor(viewer);
  const owing = BALANCE_ROWS.map((row) => ({ name: row.name, ...balanceFor(row) }))
    .filter((row) => row.due > 0)
    .slice(0, 2);

  return (
    <AppFrame path="bachelor-point.app/dashboard" label={strings.landing.hero.previewLabel}>
      <PreviewHeading title={strings.dashboard.title} meta={MONTH_LABEL} />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile label={strings.dashboard.yourMeals} value={String(viewer.meals)} />
        <Tile label={strings.dashboard.mealRate} value={formatCurrency(MEAL_RATE)} />
        <Tile
          label={strings.dashboard.refundOwed}
          value={formatCurrency(Math.max(0, -viewerBalance.due))}
          tone="green"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 p-3">
        <div className="text-[11px] font-medium text-slate-500">{strings.dashboard.whereMoneyWent}</div>
        <ul className="mt-3 space-y-2">
          {SPEND_BREAKDOWN.map((row) => (
            <li key={row.label} className="flex items-center gap-2 sm:gap-3">
              <span className="w-14 shrink-0 truncate text-[10px] text-slate-600 sm:w-20 sm:text-[11px]">
                {row.label}
              </span>
              <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full rounded-full bg-brand-600"
                  style={{ width: `${Math.round((row.amount / maxAmount) * 100)}%` }}
                />
              </span>
              <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-slate-500 sm:w-20 sm:text-[11px]">
                {formatCurrency(row.amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 p-3">
        <div className="text-[11px] font-medium text-slate-500">{strings.dashboard.whoOwes}</div>
        <ul className="mt-2 divide-y divide-slate-100">
          {owing.map((row) => (
            <li key={row.name} className="flex items-center gap-3 py-2">
              <Avatar name={row.name} size="sm" />
              <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{row.name}</span>
              <span className="text-xs font-semibold tabular-nums text-red-600">{formatCurrency(row.due)}</span>
            </li>
          ))}
        </ul>
      </div>
    </AppFrame>
  );
}

export function MealsPreview() {
  const total = MEAL_ROWS.reduce((sum, row) => sum + mealsFor(row), 0);
  const columns = [
    { key: 'breakfast', label: strings.meals.breakfast },
    { key: 'lunch', label: strings.meals.lunch },
    { key: 'dinner', label: strings.meals.dinner }
  ] as const;

  return (
    <AppFrame path="bachelor-point.app/meals" label={strings.landing.screens.meals.title}>
      <PreviewHeading title={strings.meals.title} meta="12 Jul 2026" />

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pb-2 text-[9px] uppercase tracking-wide text-slate-400 sm:gap-3">
        <span>{strings.common.member}</span>
        <span className="grid grid-cols-3 gap-1.5 text-center">
          {columns.map((column) => (
            <span key={column.key} className="w-10 sm:w-16">
              <span className="hidden sm:inline">{column.label}</span>
              <span className="sm:hidden">{column.label.charAt(0)}</span>
            </span>
          ))}
        </span>
      </div>

      <ul className="divide-y divide-slate-100">
        {MEAL_ROWS.map((row) => (
          <li
            key={row.name}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2.5 sm:gap-3"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={row.name} size="sm" className="hidden sm:flex" />
              <span className="truncate text-[11px] text-slate-700 sm:text-xs">{row.name}</span>
            </span>
            <span className="grid grid-cols-3 gap-1.5">
              {columns.map((column) => (
                <span
                  key={column.key}
                  className={`flex h-7 w-10 items-center justify-center rounded-full text-[11px] font-medium sm:w-16 ${
                    row[column.key]
                      ? 'bg-brand-600 text-white'
                      : 'border border-dashed border-slate-200 text-slate-300'
                  }`}
                >
                  {row[column.key] ? '✓' : '–'}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2.5">
        <span className="text-[11px] text-slate-500">{strings.meals.totalMeals}</span>
        <span className="text-sm font-semibold tabular-nums text-slate-900">{total}</span>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">{strings.meals.pastLocked}</p>
    </AppFrame>
  );
}

export function BazarPreview() {
  const total = BAZAR_ITEMS.reduce((sum, item) => sum + item.amount, 0);

  return (
    <AppFrame path="bachelor-point.app/expenses" label={strings.landing.screens.bazar.title}>
      <PreviewHeading title={strings.expenses.title} meta="11 Jul 2026" />

      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
        <Avatar name={MEMBERS[0]} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-slate-900">{MEMBERS[0]}</div>
          <div className="text-[11px] text-slate-500">{strings.payments.boughtGroceries}</div>
        </div>
        <div className="text-right">
          <div className="text-base font-semibold tabular-nums text-slate-900">{formatCurrency(total)}</div>
        </div>
      </div>

      <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 px-3">
        {BAZAR_ITEMS.map((item) => (
          <li key={item.name} className="flex items-center justify-between gap-3 py-2.5">
            <span className="truncate text-xs text-slate-700">{item.name}</span>
            <span className="text-xs tabular-nums text-slate-500">{formatCurrency(item.amount)}</span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 py-2.5">
          <span className="text-xs font-semibold text-slate-900">{strings.common.total}</span>
          <span className="text-xs font-semibold tabular-nums text-slate-900">{formatCurrency(total)}</span>
        </li>
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
          {strings.expenses.changeHistory}
        </span>
        <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] text-green-700">
          {strings.expenses.shoppingReport}
        </span>
      </div>
    </AppFrame>
  );
}

export function BalancesPreview() {
  const rows = BALANCE_ROWS.map((row) => ({ ...row, ...balanceFor(row) }));
  const outstanding = rows.reduce((sum, row) => sum + Math.max(0, row.due), 0);
  const refunds = rows.reduce((sum, row) => sum + Math.max(0, -row.due), 0);

  return (
    <AppFrame path="bachelor-point.app/payments" label={strings.landing.screens.balances.title}>
      <PreviewHeading title={strings.payments.memberBalances} meta={MONTH_LABEL} />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile label={strings.meals.perMealPrice} value={formatCurrency(MEAL_RATE)} />
        <Tile label={strings.payments.outstanding} value={formatCurrency(outstanding)} tone="red" />
        <Tile label={strings.payments.toRefund} value={formatCurrency(refunds)} tone="green" />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left xl:min-w-[34rem]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-400">
              <th className="pb-2 font-normal">{strings.common.member}</th>
              <th className="hidden pb-2 text-right font-normal sm:table-cell">{strings.payments.mealShare}</th>
              <th className="hidden pb-2 text-right font-normal sm:table-cell">{strings.payments.bills}</th>
              <th className="hidden pb-2 text-right font-normal xl:table-cell">
                {strings.payments.boughtGroceries}
              </th>
              <th className="hidden pb-2 text-right font-normal xl:table-cell">{strings.payments.cashPaid}</th>
              <th className="pb-2 text-right font-normal">{strings.payments.due}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.name} className="text-[11px] text-slate-600 sm:text-xs">
                <td className="py-2.5 pr-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={row.name} size="sm" className="hidden sm:flex" />
                    <span className="truncate text-slate-700">{row.name}</span>
                  </span>
                </td>
                <td className="hidden py-2.5 text-right tabular-nums sm:table-cell">
                  {formatCurrency(row.mealShare)}
                </td>
                <td className="hidden py-2.5 text-right tabular-nums sm:table-cell">
                  {formatCurrency(BILLS_SHARE_PER_MEMBER)}
                </td>
                <td className="hidden py-2.5 text-right tabular-nums xl:table-cell">{formatCurrency(row.bought)}</td>
                <td className="hidden py-2.5 text-right tabular-nums xl:table-cell">{formatCurrency(row.paid)}</td>
                <td
                  className={`py-2.5 text-right font-semibold tabular-nums ${
                    row.due > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {row.due > 0 ? formatCurrency(row.due) : formatCurrency(-row.due)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">{strings.payments.balanceFormula}</p>
    </AppFrame>
  );
}

export function MealRateDiagram() {
  const parts = [
    { label: strings.landing.math.totalBazar, value: formatCurrency(TOTAL_BAZAR), operator: '÷' },
    { label: strings.landing.math.totalMeals, value: String(TOTAL_MEALS), operator: '=' },
    { label: strings.landing.math.mealRate, value: formatCurrency(MEAL_RATE), operator: null }
  ];

  return (
    <div
      role="img"
      aria-label={strings.landing.math.diagramLabel}
      className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:flex-wrap sm:gap-4 sm:p-8"
    >
      {parts.map((part, index) => (
        <Fragment key={part.label}>
          <div
            className={`w-full rounded-2xl px-4 py-3 text-center sm:w-auto sm:min-w-[7.5rem] ${
              index === parts.length - 1 ? 'bg-brand-600 text-white' : 'bg-slate-50 text-slate-900'
            }`}
          >
            <div
              className={`text-[10px] uppercase tracking-wide ${
                index === parts.length - 1 ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {part.label}
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">{part.value}</div>
          </div>
          {part.operator && <span className="text-xl font-light text-slate-400 sm:text-2xl">{part.operator}</span>}
        </Fragment>
      ))}
    </div>
  );
}
