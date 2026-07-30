import type { ReactNode } from 'react';
import { strings } from '@/lib/i18n';

export const CONTROL_BASE_CLASSES =
  'w-full rounded-2xl border bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-900 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60';

export function controlClasses(hasError: boolean, className = '') {
  return `${CONTROL_BASE_CLASSES} ${hasError ? 'border-red-400' : 'border-slate-300'} ${className}`.trim();
}

export type FieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
};

export function Field({ id, label, error, hint, optional = false, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium text-slate-700">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-slate-400">{strings.common.optional}</span>}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export default Field;
