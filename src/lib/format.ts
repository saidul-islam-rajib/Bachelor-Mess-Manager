import { appConfig, dateConfig } from '@/config';
import { strings } from '@/lib/i18n';

const DAY_STYLES = {
  full: { day: 'numeric', month: 'short', year: 'numeric' },
  dayMonth: { day: 'numeric', month: 'short' },
  weekdayDayMonth: { weekday: 'short', day: 'numeric', month: 'short' },
  weekdayDay: { weekday: 'short', day: 'numeric' },
  weekdayLong: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  monthYear: { month: 'long', year: 'numeric' }
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DayStyle = keyof typeof DAY_STYLES;

const INSTANT_STYLES = {
  date: { day: 'numeric', month: 'short', year: 'numeric' },
  dateTime: { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  dayMonthTime: { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' },
  dayMonth: { day: 'numeric', month: 'short' },
  time: { hour: '2-digit', minute: '2-digit' }
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export type InstantStyle = keyof typeof INSTANT_STYLES;

export function formatCurrency(amount: number): string {
  return `${appConfig.currencySymbol}${amount.toFixed(2)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(appConfig.dateLocale).format(value);
}

export function formatDayKey(day: string, style: DayStyle = 'full'): string {
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString(appConfig.dateLocale, {
    ...DAY_STYLES[style],
    timeZone: dateConfig.dayKeyTimeZone
  });
}

export function formatDay(day: string): string {
  return formatDayKey(day, 'full');
}

export function formatInstant(iso: string | Date, style: InstantStyle = 'dateTime'): string {
  return new Date(iso).toLocaleString(appConfig.dateLocale, {
    ...INSTANT_STYLES[style],
    timeZone: appConfig.timeZone
  });
}

export function formatDateTime(iso: string): string {
  return formatInstant(iso, 'dateTime');
}

export function formatDate(iso: string): string {
  return formatInstant(iso, 'date');
}

export function formatMonthLabel(monthKey: string): string {
  return formatDayKey(`${monthKey}-01`, 'monthYear');
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;
const BYTES_PER_UNIT = 1024;

export function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes);
  let unit = 0;

  while (value >= BYTES_PER_UNIT && unit < BYTE_UNITS.length - 1) {
    value /= BYTES_PER_UNIT;
    unit += 1;
  }

  const rounded = value >= 10 || Number.isInteger(value) ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${BYTE_UNITS[unit]}`;
}

const DAYS_IN_MONTH = 30;
const MONTHS_IN_YEAR = 12;

export function formatStayDuration(days: number): string {
  if (days < DAYS_IN_MONTH + 1) return strings.units.days(days);

  const months = Math.floor(days / DAYS_IN_MONTH);
  if (months < MONTHS_IN_YEAR) return strings.units.months(months);

  const years = Math.floor(months / MONTHS_IN_YEAR);
  const remainingMonths = months % MONTHS_IN_YEAR;
  return remainingMonths === 0 ? strings.units.years(years) : strings.units.yearsMonths(years, remainingMonths);
}

export function shortName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';

  const last = parts[parts.length - 1];
  if (parts.length === 1) return last;

  const initials = parts
    .slice(0, -1)
    .map((part) => part[0].toUpperCase())
    .join('.');

  return `${initials} ${last}`;
}

export function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

export function percentOf(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function roleLabel(role: string): string {
  return strings.roles[role as keyof typeof strings.roles] ?? role;
}

export function statusLabel(status: string): string {
  return strings.status[status as keyof typeof strings.status] ?? status;
}
