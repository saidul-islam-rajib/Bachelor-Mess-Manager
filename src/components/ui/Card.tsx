import type { ReactNode } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold dark:text-slate-100">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageContainer({
  children,
  width = 'wide',
  className = ''
}: {
  children: ReactNode;
  width?: 'narrow' | 'medium' | 'wide';
  className?: string;
}) {
  const widthClass = width === 'narrow' ? 'max-w-2xl' : width === 'medium' ? 'max-w-4xl' : 'max-w-content';
  return <section className={`mx-auto ${widthClass} px-4 py-8 sm:py-10 ${className}`}>{children}</section>;
}

export function PageHeader({
  title,
  description,
  action
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      {typeof title === 'string' && (
        <PageTitle title={title} description={typeof description === 'string' ? description : undefined} />
      )}
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-slate-600 dark:text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone,
  className = ''
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'green' | 'red' | 'amber';
  className?: string;
}) {
  const color =
    tone === 'green'
      ? 'text-green-600 dark:text-green-400'
      : tone === 'red'
        ? 'text-red-600 dark:text-red-400'
        : tone === 'amber'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-slate-900 dark:text-slate-100';

  return (
    <div className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-5 ${className}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-2 text-xl font-semibold sm:text-2xl ${color}`}>{value}</div>
    </div>
  );
}

export function StatGrid({ children, columns = 4 }: { children: ReactNode; columns?: 2 | 3 | 4 | 5 }) {
  const columnClass = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    5: 'sm:grid-cols-2 lg:grid-cols-5'
  }[columns];

  return <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${columnClass}`}>{children}</div>;
}

export function DescriptionItem({
  label,
  value,
  tone
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'green' | 'red';
}) {
  const color =
    tone === 'green' ? 'text-green-600 dark:text-green-400' : tone === 'red' ? 'text-red-600 dark:text-red-400' : '';
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`mt-1 text-base font-semibold ${color || 'dark:text-slate-100'}`}>{value}</dd>
    </div>
  );
}

export function DescriptionGrid({ children, columns = 3 }: { children: ReactNode; columns?: 2 | 3 | 4 }) {
  const columnClass = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[
    columns
  ];
  return <dl className={`grid gap-4 ${columnClass}`}>{children}</dl>;
}

export default Card;
