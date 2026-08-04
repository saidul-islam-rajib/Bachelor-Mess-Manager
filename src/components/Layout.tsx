import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ROUTES } from '@/lib/routes';
import { STRINGS } from '@/lib/strings';
import { strings } from '@/lib/i18n';
import { USER_ROLES } from '@/lib/constants';
import { useCurrentUser } from '@/components/UserProvider';
import { useCommunity } from '@/components/CommunityProvider';
import NotificationBell from '@/components/NotificationBell';
import ProfileMenu from '@/components/ProfileMenu';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import InstallAppBanner from '@/components/InstallAppBanner';
import UpdateBanner from '@/components/UpdateBanner';

type NavLink = { href: string; label: string; badge?: number };

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, loading, logout, stopImpersonating } = useCurrentUser();
  const { unreadCount: communityUnread } = useCommunity();
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
    links.push({ href: ROUTES.dashboard, label: strings.nav.dashboard });
    links.push({ href: ROUTES.meals, label: strings.nav.meals });
    links.push({ href: ROUTES.expenses, label: strings.nav.bazar });
    links.push({ href: ROUTES.bills, label: strings.nav.bills });
    links.push({ href: ROUTES.payments, label: strings.nav.payments });
    links.push({ href: ROUTES.members, label: strings.nav.members });
    links.push({ href: ROUTES.comments, label: strings.nav.comments });
    links.push({ href: ROUTES.community, label: strings.nav.community, badge: communityUnread });
    if (user.role === USER_ROLES.ADMIN) {
      links.push({ href: ROUTES.admin, label: strings.nav.admin });
    }
    links.push({ href: ROUTES.guide, label: strings.nav.guide });
  }

  const isActive = (href: string) => router.pathname === href || router.pathname.startsWith(`${href}/`);

  const showAuthLinks = !user && !loading && !isAuthPage;

  const impersonating = user?.impersonatedBy;

  return (
    <div className="safe-x flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <UpdateBanner />
      <InstallAppBanner />
      <header className="safe-top sticky top-0 z-40 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur">
        {impersonating && (
          <div className="bg-amber-500 text-amber-950">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-sm">
              <p className="font-medium">
                {strings.admin.impersonation.banner(user.name)}
                <span className="ml-2 hidden font-normal text-amber-900 sm:inline">
                  {strings.admin.impersonation.bannerBack(impersonating.email)}
                </span>
              </p>
              <button
                onClick={stopImpersonating}
                className="rounded-full bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-900"
              >
                {strings.admin.impersonation.stop}
              </button>
            </div>
          </div>
        )}
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
                  className={`inline-flex items-center rounded-full px-3 py-2 transition-colors ${
                    active
                      ? 'bg-brand-600 font-semibold text-white'
                      : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'
                  }`}
                >
                  {link.label}
                  <NavBadge count={link.badge ?? 0} />
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
                  {strings.nav.login}
                </Link>
                <Link
                  href={ROUTES.auth.register}
                  className="ml-1 rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-4 py-2 text-white hover:bg-brand-700 transition-all active:translate-y-px"
                >
                  {strings.nav.register}
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
                aria-label={strings.nav.toggleMenu}
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
                    className={`flex items-center rounded-xl px-3 py-2.5 transition-colors ${
                      active ? 'bg-brand-600 font-semibold text-white' : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700'
                    }`}
                  >
                    {link.label}
                    <NavBadge count={link.badge ?? 0} />
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
                      isActive(ROUTES.profile) ? 'bg-brand-600 font-semibold text-white' : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700'
                    }`}
                  >
                    {strings.nav.profile}
                  </Link>
                  <button
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                    className="mt-1 rounded-xl border border-slate-300 px-3 py-2.5 text-left text-slate-700 hover:bg-slate-100"
                  >
                    {strings.nav.logout}
                  </button>
                </>
              ) : showAuthLinks ? (
                <>
                  <Link href={ROUTES.auth.login} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-slate-700 hover:bg-slate-100">
                    {strings.nav.login}
                  </Link>
                  <Link
                    href={ROUTES.auth.register}
                    onClick={() => setOpen(false)}
                    className="mt-1 rounded-xl bg-brand-600 px-3 py-2.5 text-white"
                  >
                    {strings.nav.register}
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
