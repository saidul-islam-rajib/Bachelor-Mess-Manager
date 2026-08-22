import { useId, useState } from 'react';
import { strings } from '@/lib/i18n';
import { passwordStrength } from '@/lib/validation';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: 'current-password' | 'new-password';
  showStrength?: boolean;
  error?: string;
  hint?: string;
  required?: boolean;
  autoFocus?: boolean;
  name?: string;
};

const METER_COLORS = ['bg-slate-200', 'bg-red-500', 'bg-amber-500', 'bg-lime-500', 'bg-green-600'];
const LABEL_COLORS = [
  'text-slate-400 dark:text-slate-500',
  'text-red-600 dark:text-red-400',
  'text-amber-600 dark:text-amber-400',
  'text-lime-700 dark:text-lime-400',
  'text-green-700 dark:text-green-400'
];

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete = 'current-password',
  showStrength = false,
  error,
  hint,
  required = true,
  autoFocus = false,
  name = 'password'
}: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const strength = showStrength ? passwordStrength(value) : null;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full rounded-2xl border bg-slate-50 px-4 py-3 pr-16 outline-none transition focus:border-brand-500 focus:bg-white dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-800 ${
            error ? 'border-red-400 dark:border-red-500/60' : 'border-slate-300 dark:border-slate-600'
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? strings.auth.hidePassword : strings.auth.showPassword}
          className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          {visible ? strings.common.hide : strings.common.show}
        </button>
      </div>

      {strength && value.length > 0 && (
        <div className="mt-2">
          <div className="flex gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  step <= strength.score ? METER_COLORS[strength.score] : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
          <p className={`mt-1 text-xs font-medium ${LABEL_COLORS[strength.score]}`}>
            {strings.auth.passwordStrength.label}: {strength.label}
          </p>
        </div>
      )}

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

export default PasswordField;
