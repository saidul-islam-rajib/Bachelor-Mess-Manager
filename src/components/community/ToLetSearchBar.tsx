import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/router';
import { Listbox, NumberInput, useDebouncedValue } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { TOLET_TYPE_VALUES } from '@/lib/constants';
import { toLetListingPath } from '@/lib/routes';
import type { CommunityMessageView } from '@/lib/community';

export type ToLetSearchState = { q: string; type: string; minRent: string; maxRent: string };

export const EMPTY_TOLET_SEARCH: ToLetSearchState = { q: '', type: '', minRent: '', maxRent: '' };

export function isToLetSearchActive(value: ToLetSearchState): boolean {
  return Boolean(value.q || value.type || value.minRent || value.maxRent);
}

const TYPE_OPTIONS = [
  { value: '', label: strings.toLet.search.typeAll },
  ...TOLET_TYPE_VALUES.map((type) => ({ value: type, label: strings.toLet.types[type as keyof typeof strings.toLet.types] }))
];

const PREVIEW_LIMIT = 5;

export function ToLetSearchBar({
  value,
  onChange,
  previewItems
}: {
  value: ToLetSearchState;
  onChange: (next: ToLetSearchState) => void;
  previewItems: CommunityMessageView[];
}) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState(value.q);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debouncedInput = useDebouncedValue(inputValue);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  useEffect(() => setInputValue(value.q), [value.q]);

  useEffect(() => {
    latest.current.onChange({ ...latest.current.value, q: debouncedInput });
  }, [debouncedInput]);

  useEffect(() => {
    if (!previewOpen) return undefined;

    function onPointerDown(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setPreviewOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [previewOpen]);

  const preview = previewItems.slice(0, PREVIEW_LIMIT);
  const showPreview = previewOpen && inputValue.trim().length >= 2 && preview.length > 0;

  function goToActive() {
    const target = activeIndex >= 0 ? preview[activeIndex] : preview[0];
    if (target) {
      setPreviewOpen(false);
      void router.push(toLetListingPath(target.id));
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showPreview) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, preview.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      goToActive();
    } else if (event.key === 'Escape') {
      setPreviewOpen(false);
    }
  }

  const activeFilterCount = [value.type, value.minRent, value.maxRent].filter(Boolean).length;

  return (
    <div className="p-2">
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
              setPreviewOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setPreviewOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={strings.toLet.search.placeholder}
            aria-label={strings.toLet.search.placeholder}
            className="w-full rounded-full border border-transparent bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand-500 focus:bg-white"
          />

          {showPreview && (
            <ul
              role="listbox"
              className="absolute left-0 right-0 z-30 mt-1.5 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-xl"
            >
              {preview.map((item, index) => (
                <li key={item.id} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setPreviewOpen(false);
                      void router.push(toLetListingPath(item.id));
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                      index === activeIndex ? 'bg-brand-50' : ''
                    }`}
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {item.images[0] && <img src={item.images[0]} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {item.location}
                        {item.rent !== null && ` · ${strings.toLet.rentPerMonth(formatCurrency(item.rent))}`}
                      </p>
                    </div>
                  </button>
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
