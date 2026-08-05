import type { ReactNode } from 'react';

export type LandingIconName =
  | 'meals'
  | 'bazar'
  | 'bills'
  | 'payments'
  | 'groups'
  | 'comments'
  | 'shield'
  | 'history'
  | 'lock'
  | 'check';

const PATHS: Record<LandingIconName, ReactNode> = {
  meals: (
    <>
      <path d="M3.5 4v5a3 3 0 0 0 3 3v8" />
      <path d="M6.5 4v5" />
      <path d="M9.5 4v5" />
      <path d="M20.5 4c-1.8 1.2-2.6 3.2-2.6 5.5 0 1.7.6 2.8 1.6 3.3V20" />
    </>
  ),
  bazar: (
    <>
      <path d="M4.5 8h15l-1.1 11.2a1.8 1.8 0 0 1-1.8 1.6H7.4a1.8 1.8 0 0 1-1.8-1.6Z" />
      <path d="M9 8V6.2A3 3 0 0 1 12 3.2a3 3 0 0 1 3 3V8" />
      <path d="M9.5 12.5h5" />
    </>
  ),
  bills: (
    <>
      <path d="M6 3.2 7.7 4.6 9.4 3.2 11.1 4.6 12.8 3.2 14.5 4.6 16.2 3.2 18 4.6V20l-1.8-1.4-1.7 1.4-1.7-1.4-1.7 1.4-1.7-1.4L7.7 20 6 18.6Z" />
      <path d="M9 8.5h6" />
      <path d="M9 12h6" />
      <path d="M9 15.5h3.5" />
    </>
  ),
  payments: (
    <>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
      <path d="M3.5 10.5h17" />
      <path d="M7 14.5h3" />
    </>
  ),
  groups: (
    <>
      <path d="M9 11a3.4 3.4 0 1 0 0-6.8A3.4 3.4 0 0 0 9 11Z" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16.2 4.6a3.4 3.4 0 0 1 0 6.6" />
      <path d="M17.6 13.6A6.2 6.2 0 0 1 21.2 20" />
    </>
  ),
  comments: (
    <>
      <path d="M20.5 12.5c0 4-3.8 7.2-8.5 7.2a9.8 9.8 0 0 1-2.9-.4L4 21l1.3-3.7a6.8 6.8 0 0 1-1.8-4.8c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2Z" />
      <path d="M13.8 11a1.9 1.9 0 1 0-1.4 3.2c1.6 0 2.6-1.2 2.6-3a3.1 3.1 0 1 0-2.1 2.9" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 5.8v5.6c0 4 2.9 7.6 7 8.6 4.1-1 7-4.6 7-8.6V5.8Z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </>
  ),
  history: (
    <>
      <path d="M3.8 12a8.2 8.2 0 1 0 2.6-6" />
      <path d="M3.4 3.8v4.6h4.6" />
      <path d="M12 7.8V12l3 1.8" />
    </>
  ),
  lock: (
    <>
      <path d="M5.5 11.2a1.7 1.7 0 0 1 1.7-1.7h9.6a1.7 1.7 0 0 1 1.7 1.7v7.4a1.7 1.7 0 0 1-1.7 1.7H7.2a1.7 1.7 0 0 1-1.7-1.7Z" />
      <path d="M8.4 9.5V7.4a3.6 3.6 0 0 1 7.2 0v2.1" />
      <path d="M12 14v2.4" />
    </>
  ),
  check: (
    <>
      <path d="M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8Z" />
      <path d="m8.2 12.1 2.6 2.6 5-5.4" />
    </>
  )
};

export function LandingIcon({ name, className = 'h-6 w-6' }: { name: LandingIconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

export default LandingIcon;
