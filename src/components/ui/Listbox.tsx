import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { strings } from '@/lib/i18n';

export type ListboxOption = { value: string; label: string; disabled?: boolean };

export type ListboxProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly ListboxOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export type ListboxControlProps = {
  id?: string;
  labelledBy?: string;
  describedBy?: string;
  invalid?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: readonly ListboxOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
};

export function ListboxControl({
  id,
  labelledBy,
  describedBy,
  invalid = false,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className = '',
  buttonClassName = ''
}: ListboxControlProps) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const listId = `${baseId}-list`;

  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    const node = list.current?.children[activeIndex] as HTMLElement | undefined;
    node?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function step(delta: number) {
    if (options.length === 0) return;
    let next = activeIndex;
    for (let i = 0; i < options.length; i += 1) {
      next = (next + delta + options.length) % options.length;
      if (!options[next].disabled) break;
    }
    setActiveIndex(next);
  }

  function pick(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'Tab':
        setOpen(false);
        break;
      case 'ArrowDown':
        event.preventDefault();
        step(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        step(-1);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        pick(activeIndex);
        break;
      default:
        break;
    }
  }

  return (
    <div ref={wrapper} className={`relative ${className}`}>
      <button
        ref={trigger}
        id={baseId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={labelledBy ? `${labelledBy} ${baseId}-value` : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
        className={`flex min-h-[2.75rem] w-full items-center justify-between gap-2 rounded-2xl border bg-white px-4 py-2.5 text-left text-slate-900 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 ${
          invalid ? 'border-red-400 dark:border-red-500/60' : 'border-slate-300 dark:border-slate-600'
        } ${buttonClassName}`}
      >
        <span id={`${baseId}-value`} className="min-w-0 flex-1 truncate">
          {selected ? selected.label : (placeholder ?? '')}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 text-slate-500 transition-transform duration-200 dark:text-slate-400 ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy}
          tabIndex={-1}
          className="absolute left-0 right-0 z-30 mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800"
        >
          {options.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">{placeholder ?? strings.common.none}</li>
          )}
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(index)}
                className={`flex min-h-[2.75rem] cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-sm ${
                  option.disabled ? 'cursor-not-allowed text-slate-300 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'
                } ${index === activeIndex && !option.disabled ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300' : ''} ${
                  isSelected ? 'font-semibold text-brand-700 dark:text-brand-400' : ''
                }`}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {isSelected && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="shrink-0"
                  >
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Listbox({ label, className = '', ...rest }: ListboxProps) {
  const id = useId();

  return (
    <div className={className}>
      <span id={`${id}-label`} className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <ListboxControl id={id} labelledBy={`${id}-label`} className="mt-1" {...rest} />
    </div>
  );
}

export default Listbox;
