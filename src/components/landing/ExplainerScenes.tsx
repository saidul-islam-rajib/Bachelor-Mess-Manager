import { LandingIcon } from '@/components/landing/Icons';
import { WEEKDAYS } from '@/lib/constants';

const AVATAR_COLORS = ['bg-brand-600', 'bg-amber-500', 'bg-teal-600'];

function AvatarCircle({ initial, index = 0 }: { initial: string; index?: number }) {
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white sm:h-12 sm:w-12 ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}
    >
      {initial}
    </span>
  );
}

function FieldRow({ label, value, delayMs }: { label: string; value: string; delayMs: number }) {
  return (
    <div className="mb-2.5 animate-slide-up-fade opacity-0" style={{ animationDelay: `${delayMs}ms` }}>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <span>{value}</span>
        <span className="inline-block h-4 w-px bg-slate-400 animate-blink-caret" />
      </div>
    </div>
  );
}

export function RegisterScene() {
  return (
    <div className="mx-auto w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:max-w-sm">
      <div className="mb-4 flex items-center gap-2">
        <LandingIcon name="lock" className="h-5 w-5 text-brand-600" />
        <span className="text-sm font-semibold text-slate-700">Create account</span>
      </div>
      <FieldRow label="Name" value="Rakib Hasan" delayMs={0} />
      <FieldRow label="Email" value="rakib@mail.com" delayMs={300} />
      <FieldRow label="Phone" value="+8801•••••" delayMs={600} />
      <div className="mt-4 flex items-center gap-2 animate-pop-in opacity-0" style={{ animationDelay: '1000ms' }}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-xs text-white">✓</span>
        <span className="text-sm font-medium text-green-700">Setup link emailed</span>
      </div>
    </div>
  );
}

export function JoinOrSuperviseScene() {
  return (
    <div className="mx-auto flex w-full max-w-sm gap-4 sm:max-w-md">
      <div className="flex-1 animate-slide-up-fade rounded-2xl border border-slate-200 bg-white p-4 text-center opacity-0 shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <LandingIcon name="groups" className="h-7 w-7" />
        </div>
        <p className="mt-2.5 text-sm font-medium text-slate-700">Accept invite</p>
        <span
          className="mt-1.5 inline-flex h-6 w-6 animate-pop-in items-center justify-center rounded-full bg-green-500 text-xs text-white opacity-0"
          style={{ animationDelay: '600ms' }}
        >
          ✓
        </span>
      </div>
      <div
        className="flex-1 animate-slide-up-fade rounded-2xl border border-slate-200 bg-white p-4 text-center opacity-0 shadow-sm"
        style={{ animationDelay: '200ms' }}
      >
        <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <LandingIcon name="shield" className="h-7 w-7" />
          <span
            className="absolute -top-4 animate-crown-drop text-2xl opacity-0"
            style={{ animationDelay: '800ms' }}
            aria-hidden
          >
            👑
          </span>
        </div>
        <p className="mt-2.5 text-sm font-medium text-slate-700">Run your own mess</p>
      </div>
    </div>
  );
}

export function MealsScene() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:max-w-md">
      <div className="mb-4 flex items-center gap-2">
        <LandingIcon name="meals" className="h-5 w-5 text-brand-600" />
        <span className="text-sm font-semibold text-slate-700">This week</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((day, i) => (
          <div key={day.value} className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] text-slate-400">{day.short.slice(0, 1)}</span>
            <span
              className="flex h-7 w-7 animate-pop-in items-center justify-center rounded-full bg-green-500 text-xs text-white opacity-0"
              style={{ animationDelay: `${300 + i * 120}ms` }}
            >
              ✓
            </span>
          </div>
        ))}
      </div>
      <div
        className="mt-4 flex animate-slide-up-fade items-center justify-between opacity-0"
        style={{ animationDelay: '1300ms' }}
      >
        <span className="text-sm text-slate-500">Meals this month</span>
        <span className="text-base font-semibold text-slate-900">21</span>
      </div>
    </div>
  );
}

const BAZAR_ITEMS = [
  { name: 'Rice 5kg', amount: '৳420' },
  { name: 'Chicken 2kg', amount: '৳680' },
  { name: 'Vegetables', amount: '৳260' }
];

export function BazarScene() {
  return (
    <div className="mx-auto flex w-full max-w-sm items-end justify-center gap-5 sm:max-w-md">
      <div className="w-44 animate-slide-up-fade rounded-t-xl border border-b-0 border-slate-200 bg-white p-3.5 opacity-0 shadow-sm">
        <p className="text-center text-xs font-semibold tracking-wide text-slate-500">RECEIPT</p>
        <ul className="mt-2 space-y-1.5">
          {BAZAR_ITEMS.map((item, i) => (
            <li
              key={item.name}
              className="flex animate-fade-up justify-between text-xs text-slate-600 opacity-0"
              style={{ animationDelay: `${200 + i * 200}ms` }}
            >
              <span>{item.name}</span>
              <span>{item.amount}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-dashed border-slate-300 pt-1.5 text-sm font-semibold text-slate-700">
          <span>Total</span>
          <span>৳1,360</span>
        </div>
      </div>
      <div className="flex animate-pop-in flex-col items-center gap-1.5 opacity-0" style={{ animationDelay: '1000ms' }}>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
          <LandingIcon name="check" className="h-6 w-6" />
        </span>
        <span className="text-sm font-medium text-green-700">Credited</span>
      </div>
    </div>
  );
}

export function BillsScene() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 sm:max-w-md">
      <div className="flex animate-slide-up-fade items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 opacity-0 shadow-sm">
        <LandingIcon name="bills" className="h-5 w-5 text-brand-600" />
        <span className="text-sm font-semibold text-slate-700">Electricity ৳2,400</span>
      </div>
      <div className="flex gap-4">
        {['R', 'T', 'N'].map((initial, i) => (
          <div
            key={initial}
            className="flex animate-slide-up-fade flex-col items-center gap-2 opacity-0"
            style={{ animationDelay: `${300 + i * 180}ms` }}
          >
            <AvatarCircle initial={initial} index={i} />
            <span
              className="animate-pop-in rounded-full bg-brand-50 px-2.5 py-1 text-sm font-medium text-brand-700 opacity-0"
              style={{ animationDelay: `${800 + i * 180}ms` }}
            >
              ৳800
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const DASHBOARD_BARS = [42, 68, 55, 90, 64];

export function DashboardScene() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:max-w-md">
      <div className="flex h-24 items-end justify-center gap-3">
        {DASHBOARD_BARS.map((height, i) => (
          <span
            key={i}
            className="w-5 origin-bottom animate-bar-grow rounded-t-md bg-brand-500 sm:w-6"
            style={{ height: `${height}%`, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <div className="mt-4 flex justify-between gap-2">
        <div className="animate-slide-up-fade opacity-0" style={{ animationDelay: '800ms' }}>
          <p className="text-xs text-slate-400">Meal rate</p>
          <p className="text-base font-semibold text-slate-900">৳92</p>
        </div>
        <div className="animate-slide-up-fade text-right opacity-0" style={{ animationDelay: '950ms' }}>
          <p className="text-xs text-slate-400">You owe</p>
          <p className="text-base font-semibold text-rose-600">৳320</p>
        </div>
      </div>
    </div>
  );
}

export function PaymentsScene() {
  return (
    <div className="mx-auto flex w-full max-w-sm items-center justify-center gap-3 sm:max-w-md">
      <AvatarCircle initial="R" index={0} />
      <div className="relative h-8 w-24 sm:w-28">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-slate-300" />
        <span className="absolute left-0 top-1/2 -translate-y-1/2 animate-coin-fly text-2xl" aria-hidden>
          🪙
        </span>
      </div>
      <AvatarCircle initial="T" index={1} />
      <span
        className="ml-2 flex h-8 animate-pop-in items-center gap-1.5 rounded-full bg-green-100 px-3 text-sm font-medium text-green-700 opacity-0"
        style={{ animationDelay: '1300ms' }}
      >
        <LandingIcon name="check" className="h-4 w-4" />
        Settled
      </span>
    </div>
  );
}

export const TOPIC_SCENES: Record<number, () => JSX.Element> = {
  1: RegisterScene,
  2: JoinOrSuperviseScene,
  3: MealsScene,
  4: BazarScene,
  5: BillsScene,
  6: DashboardScene,
  7: PaymentsScene
};
