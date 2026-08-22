import { useMemo, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { strings } from '@/lib/i18n';
import { formatCurrency, formatDayKey } from '@/lib/format';

export type TrendBuyer = { id: string; name: string; amount: number };
export type TrendDay = { date: string; runningRate: number; buyers: TrendBuyer[] };

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 160;
const PAD_Y = 20;
const DAYS_PER_WEEK = 7;

const taka = formatCurrency;

function weekBucketKey(date: string) {
  const dayOfMonth = Number(date.slice(8, 10));
  return Math.floor((dayOfMonth - 1) / DAYS_PER_WEEK);
}

function edgeAwareTranslateX(xPercent: number) {
  if (xPercent < 15) return '0%';
  if (xPercent > 85) return '-100%';
  return '-50%';
}

export default function MealRateTrendChart({ days, currentUserId }: { days: TrendDay[]; currentUserId?: string }) {
  const copy = strings.meals.trend;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const points = useMemo(
    () => days.filter((d) => d.runningRate > 0).sort((a, b) => a.date.localeCompare(b.date)),
    [days]
  );

  const { path, areaPath, coords, peakIndex, troughIndex } = useMemo(() => {
    if (points.length === 0) {
      return {
        path: '',
        areaPath: '',
        coords: [] as { x: number; y: number }[],
        peakIndex: -1,
        troughIndex: -1
      };
    }

    const rates = points.map((p) => p.runningRate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const span = max - min;

    const coords = points.map((point, index) => {
      const x = points.length === 1 ? VIEW_WIDTH / 2 : (index / (points.length - 1)) * VIEW_WIDTH;
      const y = span === 0 ? VIEW_HEIGHT / 2 : PAD_Y + (1 - (point.runningRate - min) / span) * (VIEW_HEIGHT - PAD_Y * 2);
      return { x, y };
    });

    const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const areaPath =
      coords.length > 0
        ? `${path} L ${coords[coords.length - 1].x.toFixed(1)} ${VIEW_HEIGHT} L ${coords[0].x.toFixed(1)} ${VIEW_HEIGHT} Z`
        : '';

    let peakIndex = 0;
    let troughIndex = 0;
    rates.forEach((rate, index) => {
      if (rate > rates[peakIndex]) peakIndex = index;
      if (rate < rates[troughIndex]) troughIndex = index;
    });

    return { path, areaPath, coords, peakIndex, troughIndex };
  }, [points]);

  const highestWeek = useMemo(() => {
    if (points.length === 0) return null;

    const buckets = new Map<number, { days: TrendDay[]; startIndex: number; endIndex: number }>();
    points.forEach((point, index) => {
      const key = weekBucketKey(point.date);
      const bucket = buckets.get(key);
      if (!bucket) {
        buckets.set(key, { days: [point], startIndex: index, endIndex: index });
      } else {
        bucket.days.push(point);
        bucket.endIndex = index;
      }
    });

    let best: { days: TrendDay[]; startIndex: number; endIndex: number; avg: number } | null = null;
    for (const bucket of buckets.values()) {
      const avg = bucket.days.reduce((a, d) => a + d.runningRate, 0) / bucket.days.length;
      if (!best || avg > best.avg) best = { ...bucket, avg };
    }
    if (!best) return null;

    const buyerTotals = new Map<string, { name: string; amount: number }>();
    for (const day of best.days) {
      for (const buyer of day.buyers) {
        const existing = buyerTotals.get(buyer.id);
        if (existing) existing.amount += buyer.amount;
        else buyerTotals.set(buyer.id, { name: buyer.name, amount: buyer.amount });
      }
    }
    const buyers = [...buyerTotals.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.amount - a.amount);

    return {
      rangeLabel: `${formatDayKey(best.days[0].date, 'dayMonth')} – ${formatDayKey(
        best.days[best.days.length - 1].date,
        'dayMonth'
      )}`,
      avg: best.avg,
      buyers,
      startIndex: best.startIndex,
      endIndex: best.endIndex
    };
  }, [points]);

  function nearestIndex(clientX: number, target: SVGSVGElement) {
    const rect = target.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const x = ratio * VIEW_WIDTH;
    let closest = 0;
    let closestDist = Infinity;
    coords.forEach((c, index) => {
      const dist = Math.abs(c.x - x);
      if (dist < closestDist) {
        closestDist = dist;
        closest = index;
      }
    });
    return closest;
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (coords.length === 0) return;
    setActiveIndex(nearestIndex(event.clientX, event.currentTarget));
  }

  function handleMouseMove(event: ReactMouseEvent<SVGSVGElement>) {
    if (coords.length === 0) return;
    setActiveIndex(nearestIndex(event.clientX, event.currentTarget));
  }

  if (points.length < 2) {
    return (
      <div className="mt-6 border-t border-slate-100 dark:border-slate-700 pt-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{copy.title}</h3>
        <div className="mt-3 flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-sm text-slate-400 dark:text-slate-500">
          {copy.empty}
        </div>
      </div>
    );
  }

  const active = activeIndex !== null ? points[activeIndex] : null;
  const activeCoord = activeIndex !== null ? coords[activeIndex] : null;
  const priorPoint = activeIndex !== null && activeIndex > 0 ? points[activeIndex - 1] : null;
  const delta = active && priorPoint ? round1(active.runningRate - priorPoint.runningRate) : null;

  const dayWidth = points.length > 1 ? VIEW_WIDTH / (points.length - 1) : VIEW_WIDTH;
  const highlightBand = highestWeek
    ? {
        x1: Math.max(0, coords[highestWeek.startIndex].x - dayWidth / 2),
        x2: Math.min(VIEW_WIDTH, coords[highestWeek.endIndex].x + dayWidth / 2)
      }
    : null;

  const peakCoord = coords[peakIndex];
  const troughCoord = coords[troughIndex];
  const buyerList =
    highestWeek && highestWeek.buyers.length > 0
      ? highestWeek.buyers
          .map((b) => `${b.id === currentUserId ? 'you' : b.name} (${taka(b.amount)})`)
          .join(', ')
      : null;

  return (
    <div className="mt-6 border-t border-slate-100 dark:border-slate-700 pt-5">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{copy.title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">{copy.subtitle}</p>

      <div className="relative mt-4">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="none"
          className="h-40 w-full cursor-crosshair touch-manipulation"
          onPointerDown={handlePointerDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setActiveIndex(null)}
          role="img"
          aria-label={`${copy.title}: ${taka(points[0].runningRate)} to ${taka(points[points.length - 1].runningRate)} across ${points.length} priced days`}
        >
          <defs>
            <linearGradient id="mealRateTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
            </linearGradient>
          </defs>

          {highlightBand && (
            <rect
              x={highlightBand.x1}
              y={0}
              width={Math.max(1, highlightBand.x2 - highlightBand.x1)}
              height={VIEW_HEIGHT}
              fill="#f59e0b"
              fillOpacity={0.1}
            />
          )}

          {areaPath && <path d={areaPath} fill="url(#mealRateTrendFill)" stroke="none" />}
          <path d={path} fill="none" stroke="#4f46e5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {coords.map((c, index) => (
            <circle
              key={points[index].date}
              cx={c.x}
              cy={c.y}
              r={index === activeIndex ? 3.5 : index === peakIndex || index === troughIndex ? 4 : 1.6}
              fill="#4f46e5"
              stroke="#fff"
              strokeWidth={index === peakIndex || index === troughIndex ? 2 : 0}
            />
          ))}

          {activeCoord && (
            <line
              x1={activeCoord.x}
              x2={activeCoord.x}
              y1={0}
              y2={VIEW_HEIGHT}
              stroke="#4f46e5"
              strokeOpacity={0.25}
              strokeWidth={1}
            />
          )}
        </svg>

        <div
          className="pointer-events-none absolute whitespace-nowrap rounded-md bg-white dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 shadow-sm ring-1 ring-amber-200"
          style={{
            left: `${(peakCoord.x / VIEW_WIDTH) * 100}%`,
            top: `${(peakCoord.y / VIEW_HEIGHT) * 100}%`,
            transform: `translate(${edgeAwareTranslateX((peakCoord.x / VIEW_WIDTH) * 100)}, -130%)`
          }}
        >
          {copy.highest} · {taka(points[peakIndex].runningRate)}
        </div>
        <div
          className="pointer-events-none absolute whitespace-nowrap rounded-md bg-white dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 shadow-sm ring-1 ring-slate-200"
          style={{
            left: `${(troughCoord.x / VIEW_WIDTH) * 100}%`,
            top: `${(troughCoord.y / VIEW_HEIGHT) * 100}%`,
            transform: `translate(${edgeAwareTranslateX((troughCoord.x / VIEW_WIDTH) * 100)}, 30%)`
          }}
        >
          {copy.lowest} · {taka(points[troughIndex].runningRate)}
        </div>

        {active && activeCoord && (
          <div
            className="pointer-events-none absolute w-max max-w-[13rem] rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{
              left: `${(activeCoord.x / VIEW_WIDTH) * 100}%`,
              top: `${Math.max(0, (activeCoord.y / VIEW_HEIGHT) * 100 - 8)}%`,
              transform: `translate(${edgeAwareTranslateX((activeCoord.x / VIEW_WIDTH) * 100)}, -100%)`
            }}
          >
            <p className="font-semibold">
              {formatDayKey(active.date, 'weekdayDayMonth')} · {taka(active.runningRate)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-300 dark:text-slate-600">
              {delta === null
                ? copy.firstPricedDay
                : delta > 0
                  ? <span className="text-red-400">{copy.moreThanPriorDay(taka(Math.abs(delta)))}</span>
                  : delta < 0
                    ? <span className="text-green-400">{copy.lessThanPriorDay(taka(Math.abs(delta)))}</span>
                    : copy.samePriorDay}
            </p>
          </div>
        )}

        <div className="mt-1.5 flex justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <span>{formatDayKey(points[0].date, 'dayMonth')}</span>
          <span>{formatDayKey(points[points.length - 1].date, 'dayMonth')}</span>
        </div>
      </div>

      {highestWeek && (
        <div className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-semibold">{copy.highestWeekLabel(highestWeek.rangeLabel)}</p>
          <p className="mt-0.5 text-amber-800 dark:text-amber-300">{copy.highestWeekRate(taka(highestWeek.avg))}</p>
          <p className="mt-1 text-amber-800 dark:text-amber-300">{buyerList ? copy.boughtBy(buyerList) : copy.noBuyersThatWeek}</p>
        </div>
      )}
    </div>
  );
}

function round1(value: number) {
  return Math.round(value * 100) / 100;
}
