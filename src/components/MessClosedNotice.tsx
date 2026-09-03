import Link from 'next/link';
import { MESS_ACCESS, type MessAccess } from '@/lib/access';
import { strings } from '@/lib/i18n';
import { ROUTES } from '@/lib/routes';

const copy = strings.messClosed;

function LockIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function MessClosedNotice({ access, onSignOut }: { access: MessAccess; onSignOut: () => void }) {
  const ended = access.state === MESS_ACCESS.MEMBERSHIP_ENDED;
  const title = ended ? copy.endedTitle : copy.closedTitle;
  const body = access.groupName
    ? ended
      ? copy.endedBody(access.groupName)
      : copy.closedBody(access.groupName)
    : ended
      ? copy.endedBodyNoName
      : copy.closedBodyNoName;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <LockIcon />
        </span>

        <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{body}</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{copy.recordsSafe}</p>

        <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {copy.whatNext}
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
            <li>{copy.contactAdmin}</li>
            <li>{copy.profileStillYours}</li>
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link
            href={ROUTES.profile}
            className="inline-flex min-h-[2.5rem] items-center rounded-full bg-brand-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            {copy.openProfile}
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex min-h-[2.5rem] items-center rounded-full border border-slate-200 px-5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            {copy.signOut}
          </button>
        </div>
      </div>
    </div>
  );
}
