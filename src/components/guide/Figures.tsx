import { useEffect, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { strings } from '@/lib/i18n';

const figures = strings.guide.figures;

type FigureColors = {
  ink: string;
  muted: string;
  line: string;
  fill: string;
  accent: string;
  accentText: string;
  green: string;
  amber: string;
  red: string;
};

const LIGHT_COLORS: FigureColors = {
  ink: '#0f172a',
  muted: '#64748b',
  line: '#cbd5e1',
  fill: '#f8fafc',
  accent: '#0f172a',
  accentText: '#ffffff',
  green: '#15803d',
  amber: '#b45309',
  red: '#b91c1c'
};

const DARK_COLORS: FigureColors = {
  ink: '#e2e8f0',
  muted: '#94a3b8',
  line: '#475569',
  fill: '#1e293b',
  accent: '#4f46e5',
  accentText: '#ffffff',
  green: '#4ade80',
  amber: '#fbbf24',
  red: '#f87171'
};

function useFigureColors(): FigureColors {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted && resolvedTheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}

type FigureProps = { title: string; caption: string; children: React.ReactNode };

export function Figure({ title, caption, children }: FigureProps) {
  return (
    <figure className="mt-6 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
      <div className="overflow-x-auto p-4 sm:p-6">{children}</div>
      <figcaption className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm text-slate-600 dark:text-slate-400 sm:px-6">
        <span className="font-medium text-slate-900 dark:text-slate-100">{title}.</span> {caption}
      </figcaption>
    </figure>
  );
}

function Box({
  x,
  y,
  w,
  h,
  label,
  sub,
  tone = 'plain',
  colors
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  tone?: 'plain' | 'dark' | 'green' | 'amber' | 'red';
  colors: FigureColors;
}) {
  const stroke = tone === 'green' ? colors.green : tone === 'amber' ? colors.amber : tone === 'red' ? colors.red : colors.line;
  const fill = tone === 'dark' ? colors.accent : colors.fill;
  const text = tone === 'dark' ? colors.accentText : colors.ink;
  const subText = tone === 'dark' ? colors.accentText : colors.muted;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <text
        x={x + w / 2}
        y={sub ? y + h / 2 - 4 : y + h / 2 + 5}
        textAnchor="middle"
        fill={text}
        fontSize={14}
        fontWeight={600}
      >
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 15} textAnchor="middle" fill={subText} fontSize={12} opacity={tone === 'dark' ? 0.85 : 1}>
          {sub}
        </text>
      )}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, colors }: { x1: number; y1: number; x2: number; y2: number; colors: FigureColors }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.line} strokeWidth={1.5} markerEnd="url(#bp-arrow)" />;
}

function Defs({ colors }: { colors: FigureColors }) {
  return (
    <defs>
      <marker id="bp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0 0 L10 5 L0 10 z" fill={colors.line} />
      </marker>
    </defs>
  );
}

export function RolesFigure() {
  const colors = useFigureColors();
  const t = figures.roles;
  return (
    <svg viewBox="0 0 720 240" className="h-auto w-full min-w-[560px]" role="img" aria-label={t.ariaLabel}>
      <Defs colors={colors} />
      <Box x={270} y={10} w={180} h={54} label={t.admin} sub={t.adminSub} tone="dark" colors={colors} />
      <Arrow x1={360} y1={64} x2={360} y2={92} colors={colors} />
      <Box x={270} y={94} w={180} h={54} label={t.supervisor} sub={t.supervisorSub} colors={colors} />
      <Arrow x1={310} y1={148} x2={190} y2={176} colors={colors} />
      <Arrow x1={360} y1={148} x2={360} y2={176} colors={colors} />
      <Arrow x1={410} y1={148} x2={530} y2={176} colors={colors} />
      <Box x={100} y={178} w={180} h={54} label={t.member} sub={t.memberSub} colors={colors} />
      <Box x={270} y={178} w={180} h={54} label={t.member} sub={t.memberSub} colors={colors} />
      <Box x={440} y={178} w={180} h={54} label={t.member} sub={t.memberSub} colors={colors} />
    </svg>
  );
}

export function MonthFlowFigure() {
  const colors = useFigureColors();
  const t = figures.monthFlow;
  const steps = [
    { label: t.logMeals, sub: t.logMealsSub },
    { label: t.recordBazar, sub: t.recordBazarSub },
    { label: t.recordBills, sub: t.recordBillsSub },
    { label: t.takePayments, sub: t.takePaymentsSub },
    { label: t.closeMonth, sub: t.closeMonthSub }
  ];

  return (
    <svg viewBox="0 0 760 120" className="h-auto w-full min-w-[680px]" role="img" aria-label={t.ariaLabel}>
      <Defs colors={colors} />
      {steps.map((step, index) => {
        const x = index * 152;
        return (
          <g key={step.label}>
            <Box
              x={x}
              y={30}
              w={132}
              h={58}
              label={step.label}
              sub={step.sub}
              tone={index === steps.length - 1 ? 'dark' : 'plain'}
              colors={colors}
            />
            {index < steps.length - 1 && <Arrow x1={x + 134} y1={59} x2={x + 150} y2={59} colors={colors} />}
          </g>
        );
      })}
    </svg>
  );
}

export function MealRateFigure() {
  const colors = useFigureColors();
  const t = figures.mealRate;
  return (
    <svg viewBox="0 0 720 250" className="h-auto w-full min-w-[600px]" role="img" aria-label={t.ariaLabel}>
      <Defs colors={colors} />

      <text x={0} y={16} fill={colors.muted} fontSize={12} fontWeight={600}>
        {t.oneRateHeading}
      </text>
      <Box x={0} y={28} w={170} h={52} label={t.bazarThisMonth} sub={t.bazarThisMonthSub} colors={colors} />
      <text x={186} y={60} fill={colors.muted} fontSize={20}>
        ÷
      </text>
      <Box x={210} y={28} w={170} h={52} label={t.totalMeals} sub={t.totalMealsSub} colors={colors} />
      <text x={396} y={60} fill={colors.muted} fontSize={20}>
        =
      </text>
      <Box x={420} y={28} w={170} h={52} label={t.perMealAllMonth} sub={t.perMealAllMonthSub} tone="dark" colors={colors} />

      <line x1={0} y1={110} x2={720} y2={110} stroke={colors.line} strokeWidth={1} strokeDasharray="4 4" />

      <text x={0} y={140} fill={colors.muted} fontSize={12} fontWeight={600}>
        {t.dayRateHeading}
      </text>
      <Box x={0} y={152} w={110} h={52} label={t.aug1Bazar} sub={t.aug1BazarSub} colors={colors} />
      <text x={124} y={184} fill={colors.muted} fontSize={18}>
        ÷
      </text>
      <Box x={144} y={152} w={110} h={52} label={t.aug1Meals} sub={t.aug1MealsSub} colors={colors} />
      <text x={268} y={184} fill={colors.muted} fontSize={18}>
        =
      </text>
      <Box x={288} y={152} w={120} h={52} label={t.aug1Rate} sub={t.aug1RateSub} tone="dark" colors={colors} />

      <Box x={430} y={152} w={290} h={52} label={t.noMealsDayLabel} sub={t.noMealsDaySub} tone="amber" colors={colors} />
    </svg>
  );
}

export function BalanceFigure() {
  const colors = useFigureColors();
  const t = figures.balance;
  return (
    <svg viewBox="0 0 720 230" className="h-auto w-full min-w-[620px]" role="img" aria-label={t.ariaLabel}>
      <Defs colors={colors} />

      <text x={0} y={16} fill={colors.muted} fontSize={12} fontWeight={600}>
        {t.whatTheyOweHeading}
      </text>
      <Box x={0} y={28} w={150} h={50} label={t.broughtForward} sub={t.broughtForwardSub} colors={colors} />
      <text x={160} y={58} fill={colors.muted} fontSize={18}>
        +
      </text>
      <Box x={180} y={28} w={150} h={50} label={t.mealShare} sub={t.mealShareSub} colors={colors} />
      <text x={340} y={58} fill={colors.muted} fontSize={18}>
        +
      </text>
      <Box x={360} y={28} w={150} h={50} label={t.billsShare} sub={t.billsShareSub} colors={colors} />
      <text x={520} y={58} fill={colors.muted} fontSize={18}>
        =
      </text>
      <Box x={540} y={28} w={150} h={50} label={t.totalCost} sub={t.totalCostSub} colors={colors} />

      <text x={0} y={116} fill={colors.muted} fontSize={12} fontWeight={600}>
        {t.whatTheyPutInHeading}
      </text>
      <Box x={0} y={128} w={230} h={50} label={t.groceriesBought} sub={t.groceriesBoughtSub} tone="green" colors={colors} />
      <text x={240} y={158} fill={colors.muted} fontSize={18}>
        +
      </text>
      <Box x={260} y={128} w={230} h={50} label={t.cashHandedOver} sub={t.cashHandedOverSub} tone="green" colors={colors} />

      <line x1={520} y1={118} x2={520} y2={196} stroke={colors.line} strokeWidth={1} />
      <Box x={540} y={128} w={150} h={50} label={t.stillDue} sub={t.stillDueSub} tone="red" colors={colors} />
      <text x={615} y={200} textAnchor="middle" fill={colors.muted} fontSize={11}>
        {t.formula}
      </text>
    </svg>
  );
}

export function SplitFigure() {
  const colors = useFigureColors();
  const t = figures.split;
  return (
    <svg viewBox="0 0 720 200" className="h-auto w-full min-w-[560px]" role="img" aria-label={t.ariaLabel}>
      <Defs colors={colors} />
      <Box x={270} y={8} w={180} h={50} label={t.rentLabel} sub={t.rentSub} tone="dark" colors={colors} />

      <text x={0} y={92} fill={colors.muted} fontSize={12} fontWeight={600}>
        {t.splitEquallyHeading}
      </text>
      <Arrow x1={330} y1={58} x2={140} y2={98} colors={colors} />
      <Box x={0} y={100} w={100} h={46} label={t.equalShare} colors={colors} />
      <Box x={110} y={100} w={100} h={46} label={t.equalShare} colors={colors} />
      <Box x={220} y={100} w={100} h={46} label={t.equalShare} colors={colors} />

      <text x={400} y={92} fill={colors.muted} fontSize={12} fontWeight={600}>
        {t.selectedMembersHeading}
      </text>
      <Arrow x1={390} y1={58} x2={540} y2={98} colors={colors} />
      <Box x={400} y={100} w={150} h={46} label={t.sharedRoom} sub={t.sharedRoomSub} colors={colors} />
      <Box x={560} y={100} w={160} h={46} label={t.ownRoom} sub={t.ownRoomSub} colors={colors} />

      <text x={0} y={186} fill={colors.muted} fontSize={11}>
        {t.footnote}
      </text>
    </svg>
  );
}

export function MealEditFigure() {
  const colors = useFigureColors();
  const t = figures.mealEdit;
  return (
    <svg viewBox="0 0 760 210" className="h-auto w-full min-w-[700px]" role="img" aria-label={t.ariaLabel}>
      <Defs colors={colors} />

      <text x={0} y={16} fill={colors.muted} fontSize={12} fontWeight={600}>
        {t.memberChangesHeading}
      </text>
      <Box x={0} y={28} w={150} h={54} label={t.unlock} sub={t.unlockSub} colors={colors} />
      <Arrow x1={152} y1={55} x2={172} y2={55} colors={colors} />
      <Box x={174} y={28} w={150} h={54} label={t.editTheDay} sub={t.editTheDaySub} tone="amber" colors={colors} />
      <Arrow x1={326} y1={55} x2={346} y2={55} colors={colors} />
      <Box x={348} y={28} w={180} h={54} label={t.supervisorApproves} sub={t.supervisorApprovesSub} tone="amber" colors={colors} />
      <Arrow x1={530} y1={55} x2={550} y2={55} colors={colors} />
      <Box x={552} y={28} w={180} h={54} label={t.mealTableUpdates} sub={t.mealTableUpdatesSub} tone="green" colors={colors} />

      <line x1={0} y1={110} x2={760} y2={110} stroke={colors.line} strokeWidth={1} strokeDasharray="4 4" />

      <text x={0} y={144} fill={colors.muted} fontSize={12} fontWeight={600}>
        {t.supervisorChangesHeading}
      </text>
      <Box x={0} y={156} w={200} h={46} label={t.editTheDayAtOnce} sub={t.editTheDayAtOnceSub} colors={colors} />
      <Arrow x1={202} y1={179} x2={222} y2={179} colors={colors} />
      <Box x={224} y={156} w={250} h={46} label={t.everyoneNotified} sub={t.everyoneNotifiedSub} tone="green" colors={colors} />
      <Arrow x1={476} y1={179} x2={496} y2={179} colors={colors} />
      <Box x={498} y={156} w={234} h={46} label={t.nothingQuietly} sub={t.nothingQuietlySub} colors={colors} />
    </svg>
  );
}

export function ClosingFigure() {
  const colors = useFigureColors();
  const t = figures.closing;
  return (
    <svg viewBox="0 0 720 190" className="h-auto w-full min-w-[600px]" role="img" aria-label={t.ariaLabel}>
      <Defs colors={colors} />
      <Box x={0} y={20} w={200} h={60} label={t.augustLabel} sub={t.augustSub} colors={colors} />
      <Arrow x1={202} y1={50} x2={242} y2={50} colors={colors} />
      <Box x={244} y={20} w={200} h={60} label={t.closeOnAnyDate} sub={t.closeOnAnyDateSub} tone="dark" colors={colors} />
      <Arrow x1={446} y1={50} x2={486} y2={50} colors={colors} />
      <Box x={488} y={20} w={200} h={60} label={t.figuresFrozen} sub={t.figuresFrozenSub} tone="green" colors={colors} />

      <Arrow x1={588} y1={82} x2={588} y2={110} colors={colors} />
      <Box x={430} y={112} w={290} h={58} label={t.septemberOpens} sub={t.septemberOpensSub} tone="amber" colors={colors} />

      <text x={0} y={128} fill={colors.muted} fontSize={11}>
        {t.footnote1}
      </text>
      <text x={0} y={146} fill={colors.muted} fontSize={11}>
        {t.footnote2}
      </text>
      <text x={0} y={164} fill={colors.muted} fontSize={11}>
        {t.footnote3}
      </text>
    </svg>
  );
}
