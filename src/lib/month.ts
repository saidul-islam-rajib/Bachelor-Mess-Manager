import { appConfig, dateConfig, uiConfig } from '@/config';

const MS_PER_DAY = 86_400_000;
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

let dayKeyFormatter: Intl.DateTimeFormat | null = null;

function zonedDayFormatter(): Intl.DateTimeFormat {
  dayKeyFormatter ??= new Intl.DateTimeFormat(dateConfig.dayKeyLocale, {
    timeZone: appConfig.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return dayKeyFormatter;
}

let timeOfDayFormatter: Intl.DateTimeFormat | null = null;

function zonedTimeOfDayFormatter(): Intl.DateTimeFormat {
  timeOfDayFormatter ??= new Intl.DateTimeFormat('en-US', {
    timeZone: appConfig.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  return timeOfDayFormatter;
}

export function isTimeOfDay(value: unknown): value is string {
  return typeof value === 'string' && TIME_OF_DAY_PATTERN.test(value);
}

export function parseTimeToMinutes(value: string): number | null {
  const match = TIME_OF_DAY_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function zonedMinutesSinceMidnight(instant: Date = new Date()): number {
  const parts = zonedTimeOfDayFormatter().formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  return value('hour') * 60 + value('minute');
}

export function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && DAY_KEY_PATTERN.test(value);
}

export function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && MONTH_KEY_PATTERN.test(value);
}

export function zonedDayKey(instant: Date = new Date()): string {
  const parts = zonedDayFormatter().formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function todayKey(): string {
  return zonedDayKey();
}

export function currentMonthKey(): string {
  return todayKey().slice(0, 7);
}

export function parseMonth(monthKey?: string) {
  const key = isMonthKey(monthKey) ? monthKey : currentMonthKey();
  const [year, month] = key.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const nextStart = new Date(Date.UTC(year, month, 1));
  return { key, year, month, start, nextStart };
}

export function daysInMonth(monthKey?: string): string[] {
  const { year, month, start, nextStart } = parseMonth(monthKey);
  const count = Math.round((nextStart.getTime() - start.getTime()) / MS_PER_DAY);
  const days: string[] = [];
  for (let d = 1; d <= count; d++) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

export function previousMonthKey(monthKey?: string): string {
  const { year, month } = parseMonth(monthKey);
  return monthKeyOf(new Date(Date.UTC(year, month - 2, 1)));
}

export function nextMonthKey(monthKey?: string): string {
  const { year, month } = parseMonth(monthKey);
  return monthKeyOf(new Date(Date.UTC(year, month, 1)));
}

function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function dayToUtcDate(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00.000Z`);
}

export function utcDateToDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shiftDayKey(dayKey: string, days: number): string {
  return utcDateToDay(new Date(dayToUtcDate(dayKey).getTime() + days * MS_PER_DAY));
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function monthOptions(
  back: number = uiConfig.monthsBack,
  forward: number = uiConfig.monthsForward
): { key: string; label: string }[] {
  const [year, month] = currentMonthKey().split('-').map(Number);
  const options: { key: string; label: string }[] = [];

  for (let offset = -back; offset <= forward; offset++) {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    options.push({
      key: monthKeyOf(date),
      label: date.toLocaleString(appConfig.dateLocale, {
        month: 'long',
        year: 'numeric',
        timeZone: dateConfig.dayKeyTimeZone
      })
    });
  }

  return options.reverse();
}
