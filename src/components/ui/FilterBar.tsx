import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { uiConfig } from '@/config';
import { strings } from '@/lib/i18n';

export function useDebouncedValue<T>(value: T, delayMs: number = uiConfig.searchDebounceMs): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function SearchInput({
  value,
  onChange,
  placeholder = strings.common.search,
  className = ''
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 pl-10 text-sm outline-none transition focus:border-brand-500 focus:bg-white"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function FilterBar({
  children,
  onClear,
  activeCount = 0
}: {
  children: ReactNode;
  onClear?: () => void;
  activeCount?: number;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      {onClear && activeCount > 0 && (
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-500">
            {activeCount} {activeCount === 1 ? strings.common.filter : strings.common.filters}
          </span>
          <Button size="sm" variant="ghost" onClick={onClear}>
            {strings.common.clearFilters}
          </Button>
        </div>
      )}
    </div>
  );
}

export default FilterBar;
