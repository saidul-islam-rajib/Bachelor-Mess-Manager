import { useId, useState, type ReactNode } from 'react';

export type CollapsibleProps = {
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  id?: string;
  className?: string;
};

export function Collapsible({
  title,
  description,
  badge,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  id,
  className = ''
}: CollapsibleProps) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const headingId = `${baseId}-heading`;
  const panelId = `${baseId}-panel`;

  const controlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const expanded = controlled ? open : internalOpen;

  const [everOpened, setEverOpened] = useState(expanded);
  if (expanded && !everOpened) setEverOpened(true);

  function toggle() {
    const next = !expanded;
    if (!controlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  return (
    <section id={id} className={`rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <h2 id={headingId}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex w-full items-center gap-3 rounded-3xl px-5 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:px-6"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold text-slate-900">{title}</span>
            {description && <span className="mt-0.5 block text-sm text-slate-500">{description}</span>}
          </span>
          {badge}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`shrink-0 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </h2>

      <div
        id={panelId}
        role="region"
        aria-labelledby={headingId}
        className={expanded ? 'border-t border-slate-100 px-5 pb-5 pt-5 sm:px-6' : 'hidden'}
      >
        {everOpened && children}
      </div>
    </section>
  );
}

export default Collapsible;
