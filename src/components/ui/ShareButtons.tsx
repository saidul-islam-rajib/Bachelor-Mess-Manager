import { useEffect, useRef, useState, type ReactNode } from 'react';
import { strings } from '@/lib/i18n';

export type ShareButtonsProps = {
  url: string;
  title: string;
  className?: string;
};

function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`;
}

function MenuIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-slate-400 dark:text-slate-500"
    >
      {children}
    </svg>
  );
}

export function ShareButtons({ url, title, className = '' }: ShareButtonsProps) {
  const [open, setOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event: MouseEvent) {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (copyState === 'idle') return undefined;
    const timer = setTimeout(() => setCopyState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [copyState]);

  async function share() {
    const shareUrl = absoluteUrl(url);

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
      } catch {
        return;
      }
      return;
    }

    setOpen((current) => !current);
  }

  async function copyLink() {
    const shareUrl = absoluteUrl(url);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  const shareUrl = absoluteUrl(url);
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${title} ${shareUrl}`)}`;

  return (
    <div ref={wrapper} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => void share()}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <MenuIcon>
          <path d="M12 3v13" />
          <path d="m7 8 5-5 5 5" />
          <path d="M5 21h14" />
        </MenuIcon>
        {strings.share.action}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <a
            href={facebookHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <MenuIcon>
              <path d="M17 2h-3a5 5 0 0 0-5 5v3H6v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </MenuIcon>
            {strings.share.facebook}
          </a>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <MenuIcon>
              <path d="M21 11.5a8.5 8.5 0 0 1-12.36 7.58L4 20l1.02-4.5A8.5 8.5 0 1 1 21 11.5Z" />
              <path d="M8.5 10.5c0 3 2.5 5.5 5.5 5.5" />
            </MenuIcon>
            {strings.share.whatsapp}
          </a>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <MenuIcon>
              <path d="M9 12a3 3 0 0 0 3 3h1a3 3 0 0 0 0-6h-1" />
              <path d="M15 12a3 3 0 0 0-3-3h-1a3 3 0 0 0 0 6h1" />
            </MenuIcon>
            {copyState === 'copied'
              ? strings.share.linkCopied
              : copyState === 'failed'
                ? strings.share.linkCopyFailed
                : strings.share.copyLink}
          </button>
        </div>
      )}
    </div>
  );
}

export default ShareButtons;
