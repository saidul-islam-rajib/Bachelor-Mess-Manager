import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Field, controlClasses } from '@/components/ui/Field';
import { strings } from '@/lib/i18n';
import { passwordStrength } from '@/lib/validation';

type SharedProps = {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  containerClassName?: string;
};

export type InputProps = SharedProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'id'> & {
    value: string;
    onChange: (value: string) => void;
  };

export function Input({
  label,
  error,
  hint,
  optional = false,
  containerClassName,
  value,
  onChange,
  className = '',
  ...rest
}: InputProps) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional} className={containerClassName}>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={controlClasses(Boolean(error), className)}
        {...rest}
      />
    </Field>
  );
}

export type NumberInputProps = Omit<InputProps, 'type'>;

export function NumberInput(props: NumberInputProps) {
  return <Input type="number" inputMode="decimal" {...props} />;
}

export type TextareaProps = SharedProps & {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
};

export function Textarea({
  label,
  error,
  hint,
  optional = false,
  containerClassName,
  value,
  onChange,
  rows = 3,
  className = '',
  ...rest
}: TextareaProps) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional} className={containerClassName}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={controlClasses(Boolean(error), className)}
        {...rest}
      />
    </Field>
  );
}

const METER_COLORS = ['bg-slate-200', 'bg-red-500', 'bg-amber-500', 'bg-lime-500', 'bg-green-600'];
const LABEL_COLORS = [
  'text-slate-400 dark:text-slate-500',
  'text-red-600 dark:text-red-400',
  'text-amber-600 dark:text-amber-400',
  'text-lime-700 dark:text-lime-400',
  'text-green-700 dark:text-green-400'
];

export type PasswordInputProps = SharedProps & {
  value: string;
  onChange: (value: string) => void;
  autoComplete?: 'current-password' | 'new-password';
  showStrength?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  name?: string;
};

export function PasswordInput({
  label,
  error,
  hint,
  containerClassName,
  value,
  onChange,
  autoComplete = 'current-password',
  showStrength = false,
  required = true,
  autoFocus = false,
  name = 'password'
}: PasswordInputProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const strength = showStrength && value.length > 0 ? passwordStrength(value) : null;

  return (
    <Field id={id} label={label} error={error} hint={hint} className={containerClassName}>
      <div className="relative">
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
          className={controlClasses(Boolean(error), 'pr-16')}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? strings.auth.hidePassword : strings.auth.showPassword}
          className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          {visible ? strings.common.hide : strings.common.show}
        </button>
      </div>

      {strength && (
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
    </Field>
  );
}

export default Input;
