const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#cbd5e1';
const FILL = '#f8fafc';
const ACCENT = '#0f172a';
const GREEN = '#15803d';
const AMBER = '#b45309';
const RED = '#b91c1c';

type FigureProps = { title: string; caption: string; children: React.ReactNode };

export function Figure({ title, caption, children }: FigureProps) {
  return (
    <figure className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto p-4 sm:p-6">{children}</div>
      <figcaption className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:px-6">
        <span className="font-medium text-slate-900">{title}.</span> {caption}
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
  tone = 'plain'
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  tone?: 'plain' | 'dark' | 'green' | 'amber' | 'red';
}) {
  const stroke = tone === 'green' ? GREEN : tone === 'amber' ? AMBER : tone === 'red' ? RED : LINE;
  const fill = tone === 'dark' ? ACCENT : FILL;
  const text = tone === 'dark' ? '#ffffff' : INK;
  const subText = tone === 'dark' ? '#cbd5e1' : MUTED;

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
        <text x={x + w / 2} y={y + h / 2 + 15} textAnchor="middle" fill={subText} fontSize={12}>
          {sub}
        </text>
      )}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={LINE} strokeWidth={1.5} markerEnd="url(#bp-arrow)" />;
}

function Defs() {
  return (
    <defs>
      <marker id="bp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0 0 L10 5 L0 10 z" fill={LINE} />
      </marker>
    </defs>
  );
}

export function RolesFigure() {
  return (
    <svg viewBox="0 0 720 240" className="h-auto w-full min-w-[560px]" role="img" aria-label="Who does what">
      <Defs />
      <Box x={270} y={10} w={180} h={54} label="Admin" sub="runs the whole site" tone="dark" />
      <Arrow x1={360} y1={64} x2={360} y2={92} />
      <Box x={270} y={94} w={180} h={54} label="Supervisor" sub="runs one mess" />
      <Arrow x1={310} y1={148} x2={190} y2={176} />
      <Arrow x1={360} y1={148} x2={360} y2={176} />
      <Arrow x1={410} y1={148} x2={530} y2={176} />
      <Box x={100} y={178} w={180} h={54} label="Member" sub="logs their meals" />
      <Box x={270} y={178} w={180} h={54} label="Member" sub="logs their meals" />
      <Box x={440} y={178} w={180} h={54} label="Member" sub="logs their meals" />
    </svg>
  );
}

export function MonthFlowFigure() {
  const steps = [
    { label: 'Log meals', sub: 'every member' },
    { label: 'Record bazar', sub: 'who bought what' },
    { label: 'Record bills', sub: 'rent, wifi, gas' },
    { label: 'Take payments', sub: 'cash handed over' },
    { label: 'Close month', sub: 'freeze + carry over' }
  ];

  return (
    <svg viewBox="0 0 760 120" className="h-auto w-full min-w-[680px]" role="img" aria-label="A month in the mess">
      <Defs />
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
            />
            {index < steps.length - 1 && <Arrow x1={x + 134} y1={59} x2={x + 150} y2={59} />}
          </g>
        );
      })}
    </svg>
  );
}

export function MealRateFigure() {
  return (
    <svg viewBox="0 0 720 250" className="h-auto w-full min-w-[600px]" role="img" aria-label="How the meal rate is worked out">
      <Defs />

      <text x={0} y={16} fill={MUTED} fontSize={12} fontWeight={600}>
        ONE RATE FOR THE MONTH
      </text>
      <Box x={0} y={28} w={170} h={52} label="৳9,000" sub="bazar this month" />
      <text x={186} y={60} fill={MUTED} fontSize={20}>
        ÷
      </text>
      <Box x={210} y={28} w={170} h={52} label="300 meals" sub="everyone together" />
      <text x={396} y={60} fill={MUTED} fontSize={20}>
        =
      </text>
      <Box x={420} y={28} w={170} h={52} label="৳30.00" sub="per meal, all month" tone="dark" />

      <line x1={0} y1={110} x2={720} y2={110} stroke={LINE} strokeWidth={1} strokeDasharray="4 4" />

      <text x={0} y={140} fill={MUTED} fontSize={12} fontWeight={600}>
        A RATE FOR EACH DAY
      </text>
      <Box x={0} y={152} w={110} h={52} label="৳420" sub="1 Aug bazar" />
      <text x={124} y={184} fill={MUTED} fontSize={18}>
        ÷
      </text>
      <Box x={144} y={152} w={110} h={52} label="12 meals" sub="eaten 1 Aug" />
      <text x={268} y={184} fill={MUTED} fontSize={18}>
        =
      </text>
      <Box x={288} y={152} w={120} h={52} label="৳35.00" sub="rate for 1 Aug" tone="dark" />

      <Box x={430} y={152} w={290} h={52} label="Bazar on a day nobody ate" sub="shared across the month, never dropped" tone="amber" />
    </svg>
  );
}

export function BalanceFigure() {
  return (
    <svg viewBox="0 0 720 230" className="h-auto w-full min-w-[620px]" role="img" aria-label="How one member's due is worked out">
      <Defs />

      <text x={0} y={16} fill={MUTED} fontSize={12} fontWeight={600}>
        WHAT THEY OWE
      </text>
      <Box x={0} y={28} w={150} h={50} label="৳0" sub="brought forward" />
      <text x={160} y={58} fill={MUTED} fontSize={18}>
        +
      </text>
      <Box x={180} y={28} w={150} h={50} label="৳595" sub="meal share" />
      <text x={340} y={58} fill={MUTED} fontSize={18}>
        +
      </text>
      <Box x={360} y={28} w={150} h={50} label="৳1,300" sub="bills share" />
      <text x={520} y={58} fill={MUTED} fontSize={18}>
        =
      </text>
      <Box x={540} y={28} w={150} h={50} label="৳1,895" sub="total cost" />

      <text x={0} y={116} fill={MUTED} fontSize={12} fontWeight={600}>
        WHAT THEY PUT IN
      </text>
      <Box x={0} y={128} w={230} h={50} label="৳595" sub="groceries they bought" tone="green" />
      <text x={240} y={158} fill={MUTED} fontSize={18}>
        +
      </text>
      <Box x={260} y={128} w={230} h={50} label="৳500" sub="cash they handed over" tone="green" />

      <line x1={520} y1={118} x2={520} y2={196} stroke={LINE} strokeWidth={1} />
      <Box x={540} y={128} w={150} h={50} label="৳800" sub="still due" tone="red" />
      <text x={615} y={200} textAnchor="middle" fill={MUTED} fontSize={11}>
        1,895 − 595 − 500
      </text>
    </svg>
  );
}

export function SplitFigure() {
  return (
    <svg viewBox="0 0 720 200" className="h-auto w-full min-w-[560px]" role="img" aria-label="How a bill is split">
      <Defs />
      <Box x={270} y={8} w={180} h={50} label="৳3,900 rent" sub="one bill" tone="dark" />

      <text x={0} y={92} fill={MUTED} fontSize={12} fontWeight={600}>
        SPLIT EQUALLY
      </text>
      <Arrow x1={330} y1={58} x2={140} y2={98} />
      <Box x={0} y={100} w={100} h={46} label="৳1,300" />
      <Box x={110} y={100} w={100} h={46} label="৳1,300" />
      <Box x={220} y={100} w={100} h={46} label="৳1,300" />

      <text x={400} y={92} fill={MUTED} fontSize={12} fontWeight={600}>
        SELECTED MEMBERS
      </text>
      <Arrow x1={390} y1={58} x2={540} y2={98} />
      <Box x={400} y={100} w={150} h={46} label="৳2,600" sub="shares a room" />
      <Box x={560} y={100} w={160} h={46} label="৳1,300" sub="own room" />

      <text x={0} y={186} fill={MUTED} fontSize={11}>
        Shares are saved with the bill, so a member joining later never changes a bill that was already agreed.
      </text>
    </svg>
  );
}

export function MealEditFigure() {
  return (
    <svg viewBox="0 0 760 210" className="h-auto w-full min-w-[700px]" role="img" aria-label="Changing a meal that has already passed">
      <Defs />

      <text x={0} y={16} fill={MUTED} fontSize={12} fontWeight={600}>
        A MEMBER CHANGES A PAST DAY
      </text>
      <Box x={0} y={28} w={150} h={54} label="Unlock" sub="tick the box" />
      <Arrow x1={152} y1={55} x2={172} y2={55} />
      <Box x={174} y={28} w={150} h={54} label="Edit the day" sub="within the window" tone="amber" />
      <Arrow x1={326} y1={55} x2={346} y2={55} />
      <Box x={348} y={28} w={180} h={54} label="Supervisor approves" sub="nothing counts before" tone="amber" />
      <Arrow x1={530} y1={55} x2={550} y2={55} />
      <Box x={552} y={28} w={180} h={54} label="Meal table updates" sub="rate recalculates" tone="green" />

      <line x1={0} y1={110} x2={760} y2={110} stroke={LINE} strokeWidth={1} strokeDasharray="4 4" />

      <text x={0} y={144} fill={MUTED} fontSize={12} fontWeight={600}>
        THE SUPERVISOR CHANGES A PAST DAY
      </text>
      <Box x={0} y={156} w={200} h={46} label="Edit the day" sub="applies at once" />
      <Arrow x1={202} y1={179} x2={222} y2={179} />
      <Box x={224} y={156} w={250} h={46} label="Everyone is notified" sub="in the app and by email" tone="green" />
      <Arrow x1={476} y1={179} x2={496} y2={179} />
      <Box x={498} y={156} w={234} h={46} label="Nothing happens quietly" sub="the change is on the record" />
    </svg>
  );
}

export function ClosingFigure() {
  return (
    <svg viewBox="0 0 720 190" className="h-auto w-full min-w-[600px]" role="img" aria-label="Closing a month">
      <Defs />
      <Box x={0} y={20} w={200} h={60} label="August" sub="meals, bazar, bills, cash" />
      <Arrow x1={202} y1={50} x2={242} y2={50} />
      <Box x={244} y={20} w={200} h={60} label="Close on any date" sub="whole mess or one member" tone="dark" />
      <Arrow x1={446} y1={50} x2={486} y2={50} />
      <Box x={488} y={20} w={200} h={60} label="Figures frozen" sub="a later edit cannot rewrite it" tone="green" />

      <Arrow x1={588} y1={82} x2={588} y2={110} />
      <Box x={430} y={112} w={290} h={58} label="September opens with ৳800 brought forward" sub="unpaid balances follow the member" tone="amber" />

      <text x={0} y={128} fill={MUTED} fontSize={11}>
        Closing mid-month is how you settle up
      </text>
      <text x={0} y={146} fill={MUTED} fontSize={11}>
        with someone who is moving out on the 12th,
      </text>
      <text x={0} y={164} fill={MUTED} fontSize={11}>
        without disturbing anybody else&apos;s month.
      </text>
    </svg>
  );
}
