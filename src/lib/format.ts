import { appConfig } from '@/config';
import { strings } from '@/lib/i18n';

export function formatCurrency(amount: number): string {
  return `${appConfig.currencySymbol}${amount.toFixed(2)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(appConfig.dateLocale).format(value);
}

export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString(appConfig.dateLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: appConfig.timeZone
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(appConfig.dateLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(appConfig.dateLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString(appConfig.dateLocale, {
    month: 'long',
    year: 'numeric',
    timeZone: appConfig.timeZone
  });
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
