import { useId } from 'react';
import { strings } from '@/lib/i18n';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  autoFocus?: boolean;
  name?: string;
  optional?: boolean;
};

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  placeholder,
  error,
  hint,
  required = true,
  autoFocus = false,
  name,
  optional = false
}: Props) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{strings.common.optional}</span>}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-2 w-full rounded-2xl border bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-800 ${
          error ? 'border-red-400 dark:border-red-500/60' : 'border-slate-300 dark:border-slate-600'
        }`}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export default TextField;
