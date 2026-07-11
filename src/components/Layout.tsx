import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ROUTES } from '@/lib/routes';
import { STRINGS } from '@/lib/strings';
import { USER_ROLES } from '@/lib/constants';
import { useCurrentUser } from '@/components/UserProvider';
import NotificationBell from '@/components/NotificationBell';
import ProfileMenu from '@/components/ProfileMenu';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';

type NavLink = { href: string; label: string };

export default function Layout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const isAuthPage = router.pathname.startsWith('/auth');

  useEffect(() => {
    const close = () => setOpen(false);
    router.events.on('routeChangeComplete', close);
    return () => router.events.off('routeChangeComplete', close);
  }, [router.events]);

  const links: NavLink[] = [];
  if (user) {
    links.push({ href: ROUTES.dashboard, label: 'Dashboard' });
    links.push({ href: ROUTES.groups, label: 'Groups' });
    links.push({ href: ROUTES.meals, label: 'Meals' });
    links.push({ href: ROUTES.expenses, label: 'Expenses' });
    links.push({ href: ROUTES.payments, label: 'Payments' });
    links.push({ href: ROUTES.comments, label: 'Comments' });
    if (user.role === USER_ROLES.ADMIN) {
      links.push({ href: ROUTES.admin, label: 'Admin' });
    }
  }

  const isActive = (href: string) => router.pathname === href || router.pathname.startsWith(`${href}/`);

  const showAuthLinks = !user && !loading && !isAuthPage;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:h-20">
          <Link
            href={user ? ROUTES.dashboard : ROUTES.home}
            className="flex shrink-0 items-center gap-2 text-lg font-semibold text-slate-900"
            onClick={() => setOpen(false)}
          >
            <Logo className="h-9 w-auto lg:h-10" />
            <span className="hidden xl:inline">{STRINGS.appName}</span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm lg:flex">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-full px-3 py-2 transition-colors ${
                    active
                      ? 'bg-slate-900 font-semibold text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {user ? (
              <>
                <span className="mx-1 h-6 w-px bg-slate-200" />
                <NotificationBell />
                <ProfileMenu />
              </>
            ) : showAuthLinks ? (
              <>
                <Link href={ROUTES.auth.login} className="rounded-full px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  Login
                </Link>
                <Link
                  href={ROUTES.auth.register}
                  className="ml-1 rounded-full bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
                >
                  Register
                </Link>
              </>
            ) : null}
          </nav>

          {(user || showAuthLinks) && (
            <div className="flex items-center gap-1 lg:hidden">
              {user && <NotificationBell />}
              {user && <ProfileMenu />}
              <button
                onClick={() => setOpen((prev) => !prev)}
                aria-label="Toggle menu"
                aria-expanded={open}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
                </svg>
              </button>
            </div>
          )}
        </div>

        {open && (
          <nav className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-100 bg-white px-4 pb-4 pt-3 text-sm lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              {links.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-xl px-3 py-2.5 transition-colors ${
                      active ? 'bg-slate-900 font-semibold text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              {user ? (
                <>
                  <Link
                    href={ROUTES.profile}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(ROUTES.profile) ? 'page' : undefined}
                    className={`rounded-xl px-3 py-2.5 transition-colors ${
                      isActive(ROUTES.profile) ? 'bg-slate-900 font-semibold text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                    className="mt-1 rounded-xl border border-slate-300 px-3 py-2.5 text-left text-slate-700 hover:bg-slate-100"
                  >
                    Log out
                  </button>
                </>
              ) : showAuthLinks ? (
                <>
                  <Link href={ROUTES.auth.login} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-slate-700 hover:bg-slate-100">
                    Login
                  </Link>
                  <Link
                    href={ROUTES.auth.register}
                    onClick={() => setOpen(false)}
                    className="mt-1 rounded-xl bg-slate-900 px-3 py-2.5 text-white"
                  >
                    Register
                  </Link>
                </>
              ) : null}
            </div>
          </nav>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
