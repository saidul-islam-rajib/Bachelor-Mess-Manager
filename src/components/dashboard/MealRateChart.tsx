import { useMemo, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { formatCurrency, formatDayKey } from '@/lib/format';

export type MealRateChartDay = {
  date: string;
  rate: number;
  meals: number;
};

const VIEW_WIDTH = 300;
const VIEW_HEIGHT = 100;
const PAD_Y = 10;

const taka = formatCurrency;

export default function MealRateChart({ days }: { days: MealRateChartDay[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const points = useMemo(() => [...days].sort((a, b) => a.date.localeCompare(b.date)), [days]);

  const { path, areaPath, coords, min, max } = useMemo(() => {
    if (points.length === 0) {
      return { path: '', areaPath: '', coords: [] as { x: number; y: number }[], min: 0, max: 0 };
    }

    const rates = points.map((p) => p.rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const span = max - min;

    const coords = points.map((point, index) => {
      const x = points.length === 1 ? VIEW_WIDTH / 2 : (index / (points.length - 1)) * VIEW_WIDTH;
      const y =
        span === 0
          ? VIEW_HEIGHT / 2
          : PAD_Y + (1 - (point.rate - min) / span) * (VIEW_HEIGHT - PAD_Y * 2);
      return { x, y };
    });

    const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const areaPath =
      coords.length > 0
        ? `${path} L ${coords[coords.length - 1].x.toFixed(1)} ${VIEW_HEIGHT} L ${coords[0].x.toFixed(1)} ${VIEW_HEIGHT} Z`
        : '';

    return { path, areaPath, coords, min, max };
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

  if (points.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
        No priced days yet this month
      </div>
    );
  }

  const active = activeIndex !== null ? points[activeIndex] : null;
  const activeCoord = activeIndex !== null ? coords[activeIndex] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-28 w-full cursor-crosshair touch-manipulation"
        onPointerDown={handlePointerDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setActiveIndex(null)}
        role="img"
        aria-label={`Meal rate by day, ranging from ${taka(min)} to ${taka(max)}`}
      >
        <defs>
          <linearGradient id="mealRateFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </linearGradient>
        </defs>

        {areaPath && <path d={areaPath} fill="url(#mealRateFill)" stroke="none" />}
        <path d={path} fill="none" stroke="#4f46e5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {coords.map((c, index) => (
          <circle key={points[index].date} cx={c.x} cy={c.y} r={index === activeIndex ? 3.2 : 1.6} fill="#4f46e5" />
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

      {active && activeCoord && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg"
          style={{
            left: `${(activeCoord.x / VIEW_WIDTH) * 100}%`,
            top: `${Math.max(0, (activeCoord.y / VIEW_HEIGHT) * 100 - 6)}%`
          }}
        >
          {formatDayKey(active.date, 'dayMonth')} · {taka(active.rate)}
        </div>
      )}

      <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
        <span>{formatDayKey(points[0].date, 'dayMonth')}</span>
        <span>{formatDayKey(points[points.length - 1].date, 'dayMonth')}</span>
      </div>
    </div>
  );
}
