export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function parseMonth(monthKey?: string) {
  const key = /^\d{4}-\d{2}$/.test(monthKey || '') ? (monthKey as string) : currentMonthKey();
  const [year, month] = key.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const nextStart = new Date(Date.UTC(year, month, 1));
  return { key, year, month, start, nextStart };
}

export function daysInMonth(monthKey?: string): string[] {
  const { year, month, start, nextStart } = parseMonth(monthKey);
  const count = Math.round((nextStart.getTime() - start.getTime()) / 86400000);
  const days: string[] = [];
  for (let d = 1; d <= count; d++) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

export function dayToUtcDate(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00.000Z`);
}

export function utcDateToDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function monthOptions(back = 11, forward = 1): { key: string; label: string }[] {
  const now = new Date();
  const opts: { key: string; label: string }[] = [];
  for (let i = -back; i <= forward; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    opts.push({ key, label });
  }
  return opts.reverse();
}
