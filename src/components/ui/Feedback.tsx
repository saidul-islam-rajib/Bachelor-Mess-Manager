import type { ReactNode } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { strings } from '@/lib/i18n';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const BADGE_TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-slate-900 text-white'
};

const ALERT_TONES: Record<Tone, string> = {
  neutral: 'border-slate-200 bg-white text-slate-700',
  success: 'border-green-200 bg-green-50 text-green-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-slate-200 bg-slate-50 text-slate-700'
};

export function Badge({
  children,
  tone = 'neutral',
  className = ''
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  PAID: 'success',
  APPROVED: 'success',
  ACCEPTED: 'success',
  ACTIVE: 'success',
  PARTIAL: 'warning',
  PENDING: 'warning',
  REJECTED: 'danger',
  INACTIVE: 'neutral'
};

export function StatusBadge({ status }: { status: string }) {
  const label = strings.status[status as keyof typeof strings.status] ?? status;
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{label}</Badge>;
}

export function Alert({
  children,
  tone = 'info',
  title,
  className = ''
}: {
  children: ReactNode;
  tone?: Tone;
  title?: ReactNode;
  className?: string;
}) {
  return (
    <div role="alert" className={`rounded-2xl border px-4 py-3 text-sm ${ALERT_TONES[tone]} ${className}`}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? 'mt-1' : ''}>{children}</div>
    </div>
  );
}

export function Loader({ label = strings.common.loading }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-slate-600">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function LoadingCard({ label }: { label?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <Loader label={label} />
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

export function EmptyState({
  title = strings.emptyState.noData,
  description,
  action,
  className = ''
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center ${className}`}>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ProgressBar({ percent, className = '' }: { percent: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${clamped}%` }} />
    </div>
  );
}
