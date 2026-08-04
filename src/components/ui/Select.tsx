import { useId, type ReactNode } from 'react';
import { Field, controlClasses } from '@/components/ui/Field';

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  disabled?: boolean;
  containerClassName?: string;
  compact?: boolean;
};

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  hint,
  optional = false,
  disabled = false,
  containerClassName,
  compact = false
}: SelectProps) {
  const id = useId();

  if (compact) {
    return (
      <label className={containerClassName}>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="app-select mt-1"
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional} className={containerClassName}>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={controlClasses(Boolean(error))}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export type CheckboxProps = {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
  className?: string;
};

export function Checkbox({ label, checked, onChange, disabled = false, hint, className = '' }: CheckboxProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-center gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-sm">{label}</span>
      </label>
      {hint && <p className="ml-7 mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export type RadioOption = { value: string; label: string; hint?: string; disabled?: boolean };

export type RadioGroupProps = {
  legend: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly RadioOption[];
  hint?: string;
  className?: string;
  variant?: 'list' | 'pills';
};

export function RadioGroup({
  legend,
  value,
  onChange,
  options,
  hint,
  className = '',
  variant = 'list'
}: RadioGroupProps) {
  const name = useId();

  return (
    <fieldset className={className}>
      <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">{legend}</legend>

      {variant === 'pills' ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled}
              aria-pressed={value === option.value}
              onClick={() => onChange(option.value)}
              className={`rounded-full px-4 py-2 text-sm transition disabled:opacity-50 ${
                value === option.value
                  ? 'bg-brand-600 font-medium text-white'
                  : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {options.map((option) => (
            <label key={option.value} className="flex items-start gap-3">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                className="mt-0.5 h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>
                <span className="block text-sm">{option.label}</span>
                {option.hint && <span className="block text-xs text-slate-500">{option.hint}</span>}
              </span>
            </label>
          ))}
        </div>
      )}

      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </fieldset>
  );
}

export default Select;
