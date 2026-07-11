import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ROUTES } from '@/lib/routes';
import { useCurrentUser } from '@/components/UserProvider';
import { useInvitations } from '@/components/InvitationsProvider';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export default function ProfileMenu() {
  const { user, logout } = useCurrentUser();
  const { count } = useInvitations();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

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
    const close = () => setOpen(false);
    router.events.on('routeChangeComplete', close);
    return () => router.events.off('routeChangeComplete', close);
  }, [router.events]);

  if (!user) return null;

  const onProfile = router.pathname === ROUTES.profile;

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Your account"
        aria-expanded={open}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all ${
          onProfile || open
            ? 'bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-2'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        {user.profileImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.profileImage} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          initials(user.name)
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <Link
            href={ROUTES.profile}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {user.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profileImage} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                initials(user.name)
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-slate-900">{user.name}</span>
              <span className="block truncate text-xs text-slate-500">{user.email}</span>
            </span>
          </Link>

          <div className="p-1.5">
            <Link
              href={ROUTES.profile}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
            >
              <span className="flex items-center gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Profile &amp; invitations
              </span>
              {count > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                  {count}
                </span>
              )}
            </Link>

            <span className="my-1 block h-px bg-slate-100" />

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
