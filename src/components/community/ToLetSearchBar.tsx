import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Listbox, NumberInput, useDebouncedValue } from '@/components/ui';
import { api } from '@/lib/api-client';
import { strings } from '@/lib/i18n';
import { TOLET_TYPE_VALUES } from '@/lib/constants';

export type ToLetSearchState = { q: string; type: string; minRent: string; maxRent: string };

export const EMPTY_TOLET_SEARCH: ToLetSearchState = { q: '', type: '', minRent: '', maxRent: '' };

export function isToLetSearchActive(value: ToLetSearchState): boolean {
  return Boolean(value.q || value.type || value.minRent || value.maxRent);
}

const TYPE_OPTIONS = [
  { value: '', label: strings.toLet.search.typeAll },
  ...TOLET_TYPE_VALUES.map((type) => ({ value: type, label: strings.toLet.types[type as keyof typeof strings.toLet.types] }))
];

export function ToLetSearchBar({ value, onChange }: { value: ToLetSearchState; onChange: (next: ToLetSearchState) => void }) {
  const [inputValue, setInputValue] = useState(value.q);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debouncedInput = useDebouncedValue(inputValue);

  useEffect(() => setInputValue(value.q), [value.q]);

  useEffect(() => {
    const term = debouncedInput.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    api
      .get<{ suggestions: string[] }>('/api/community/messages/suggestions', { query: { q: term } })
      .then((data) => {
        if (!cancelled) setSuggestions(data.suggestions);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [debouncedInput]);

  useEffect(() => {
    if (!suggestionsOpen) return undefined;

    function onPointerDown(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setSuggestionsOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [suggestionsOpen]);

  function submitQuery(q: string) {
    setInputValue(q);
    setSuggestionsOpen(false);
    setActiveIndex(-1);
    onChange({ ...value, q });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!suggestionsOpen || suggestions.length === 0) {
      if (event.key === 'Enter') submitQuery(inputValue);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      submitQuery(activeIndex >= 0 ? suggestions[activeIndex] : inputValue);
    } else if (event.key === 'Escape') {
      setSuggestionsOpen(false);
    }
  }

  const activeFilterCount = [value.type, value.minRent, value.maxRent].filter(Boolean).length;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex items-center gap-2">
        <div ref={wrapperRef} className="relative min-w-0 flex-1">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              setSuggestionsOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setSuggestionsOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={strings.toLet.search.placeholder}
            aria-label={strings.toLet.search.placeholder}
            className="w-full rounded-full border border-transparent bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand-500 focus:bg-white"
          />

          {suggestionsOpen && suggestions.length > 0 && (
            <ul
              role="listbox"
              className="absolute left-0 right-0 z-30 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-xl"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    submitQuery(suggestion);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`cursor-pointer px-4 py-2 text-sm ${
                    index === activeIndex ? 'bg-brand-50 text-brand-800' : 'text-slate-700'
                  }`}
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen((current) => !current)}
          aria-expanded={filtersOpen}
          className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-sm font-medium transition-colors ${
            filtersOpen || activeFilterCount > 0
              ? 'border-brand-200 bg-brand-50 text-brand-700'
              : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          <span className="hidden sm:inline">{strings.toLet.search.filtersAction}</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {filtersOpen && (
        <div className="mt-2 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
          <Listbox
            className="w-36"
            label={strings.toLet.search.typeLabel}
            value={value.type}
            onChange={(type) => onChange({ ...value, type })}
            options={TYPE_OPTIONS}
          />
          <NumberInput
            label={strings.toLet.search.minRentLabel}
            value={value.minRent}
            onChange={(minRent) => onChange({ ...value, minRent })}
            containerClassName="w-24"
            min={0}
          />
          <NumberInput
            label={strings.toLet.search.maxRentLabel}
            value={value.maxRent}
            onChange={(maxRent) => onChange({ ...value, maxRent })}
            containerClassName="w-24"
            min={0}
          />
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...value, type: '', minRent: '', maxRent: '' })}
              className="rounded-full px-3 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              {strings.common.clearFilters}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ToLetSearchBar;
