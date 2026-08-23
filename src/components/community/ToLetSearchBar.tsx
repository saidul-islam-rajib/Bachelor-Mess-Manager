import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/router';
import { Avatar, useDebouncedValue } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { toLetListingPath } from '@/lib/routes';
import type { CommunityMessageView } from '@/lib/community';

export type ToLetSearchState = { q: string; type: string; minRent: string; maxRent: string };

export const EMPTY_TOLET_SEARCH: ToLetSearchState = { q: '', type: '', minRent: '', maxRent: '' };

export function isToLetSearchActive(value: ToLetSearchState): boolean {
  return Boolean(value.q || value.type || value.minRent || value.maxRent);
}

const PREVIEW_LIMIT = 5;

export function ToLetSearchBar({
  value,
  onChange,
  previewItems,
  userName,
  userImage,
  onOpenComposer,
  onOpenToLet,
  onOpenImport
}: {
  value: ToLetSearchState;
  onChange: (next: ToLetSearchState) => void;
  previewItems: CommunityMessageView[];
  userName?: string;
  userImage?: string | null;
  onOpenComposer?: () => void;
  onOpenToLet?: () => void;
  onOpenImport?: () => void;
}) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState(value.q);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
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
  const showComposerIcons = Boolean(onOpenComposer && onOpenToLet);

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

  return (
    <div className="flex items-center gap-2 p-2">
      {userName !== undefined && <Avatar name={userName} image={userImage ?? null} size="md" />}

      <div ref={wrapperRef} className="relative min-w-0 flex-1">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
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
          className="w-full rounded-full border border-transparent bg-slate-50 dark:bg-slate-900 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand-500 focus:bg-white dark:focus:bg-slate-800"
        />

        {showPreview && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 z-30 mt-1.5 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-xl"
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
                    index === activeIndex ? 'bg-brand-50 dark:bg-brand-500/10' : ''
                  }`}
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700">
                    {item.images[0] && <img src={item.images[0]} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{item.title}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
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

      {showComposerIcons && (
        <>
          <button
            type="button"
            onClick={onOpenComposer}
            aria-label={strings.community.addPhotos}
            title={strings.community.addPhotos}
            className="shrink-0 rounded-full p-2.5 text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="10" r="2" />
              <path d="m21 15-4.5-4.5a2 2 0 0 0-2.83 0L5 19" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onOpenToLet}
            aria-label={strings.toLet.postAction}
            title={strings.toLet.postAction}
            className="shrink-0 rounded-full p-2.5 text-brand-600 transition-colors hover:bg-brand-50 dark:hover:bg-brand-500/10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l9-7 9 7" />
              <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
            </svg>
          </button>
        </>
      )}

      {onOpenImport && (
        <button
          type="button"
          onClick={onOpenImport}
          aria-label={strings.toLet.import.action}
          title={strings.toLet.import.action}
          className="shrink-0 rounded-full p-2.5 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 19h14" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default ToLetSearchBar;
