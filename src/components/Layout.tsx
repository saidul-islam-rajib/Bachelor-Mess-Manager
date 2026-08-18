import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ROUTES } from '@/lib/routes';
import { STRINGS } from '@/lib/strings';
import { strings } from '@/lib/i18n';
import { USER_ROLES } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { useCurrentUser } from '@/components/UserProvider';
import { useCommunity } from '@/components/CommunityProvider';
import NotificationBell from '@/components/NotificationBell';
import ProfileMenu from '@/components/ProfileMenu';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import InstallAppBanner from '@/components/InstallAppBanner';
import UpdateBanner from '@/components/UpdateBanner';

type NavLink = { href: string; label: string; badge?: number };

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function MobileNavHeading({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 first:mt-0">{children}</p>
  );
}

function MobileNavLink({
  link,
  active,
  onNavigate
}: {
  link: NavLink;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center rounded-xl px-3 py-2.5 transition-colors ${FOCUS_RING} ${
        active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700'
      }`}
    >
      {link.label}
      <NavBadge count={link.badge ?? 0} />
    </Link>
  );
}

function DesktopNavLink({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-2 transition-colors xl:px-3 ${FOCUS_RING} ${
        active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'
      }`}
    >
      {link.label}
      <NavBadge count={link.badge ?? 0} />
    </Link>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, loading, can, logout, stopImpersonating } = useCurrentUser();
  const { unreadCount: communityUnread } = useCommunity();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const headerRef = useRef<HTMLElement>(null);

  const isAuthPage = router.pathname.startsWith('/auth');

  useEffect(() => {
    const close = () => setOpen(false);
    router.events.on('routeChangeComplete', close);
    return () => router.events.off('routeChangeComplete', close);
  }, [router.events]);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    function onPointerDown(event: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const messLinks: NavLink[] = [];
  const appLinks: NavLink[] = [];

  if (user) {
    messLinks.push({ href: ROUTES.dashboard, label: strings.nav.dashboard });
    if (can(PERMISSIONS.MEAL_VIEW)) messLinks.push({ href: ROUTES.meals, label: strings.nav.meals });
    if (can(PERMISSIONS.EXPENSE_VIEW)) messLinks.push({ href: ROUTES.expenses, label: strings.nav.bazar });
    if (can(PERMISSIONS.BILL_VIEW)) messLinks.push({ href: ROUTES.bills, label: strings.nav.bills });
    if (can(PERMISSIONS.PAYMENT_VIEW)) messLinks.push({ href: ROUTES.payments, label: strings.nav.payments });
    if (can(PERMISSIONS.MEMBERSHIP_VIEW)) messLinks.push({ href: ROUTES.members, label: strings.nav.members });
  }

  appLinks.push({ href: ROUTES.community, label: strings.nav.community, badge: communityUnread });
  if (user?.role === USER_ROLES.ADMIN) {
    appLinks.push({ href: ROUTES.admin, label: strings.nav.admin });
  }
  appLinks.push({ href: ROUTES.guide, label: strings.nav.guide });

  const isActive = (href: string) => router.pathname === href || router.pathname.startsWith(`${href}/`);

  const showAuthLinks = !user && !loading && !isAuthPage;

  const impersonating = user?.impersonatedBy;

  return (
    <div className="safe-x flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        {strings.common.skipToContent}
      </a>
      <UpdateBanner />
      <InstallAppBanner />
      <header ref={headerRef} className="safe-top sticky top-0 z-40 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur">
        {impersonating && (
          <div className="bg-amber-500 text-amber-950">
            <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-sm">
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
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-4 lg:h-20">
          <Link
            href={user ? ROUTES.dashboard : ROUTES.home}
            className={`flex shrink-0 items-center gap-2 rounded-xl text-lg font-semibold text-slate-900 ${FOCUS_RING}`}
            onClick={() => setOpen(false)}
          >
            <Logo className="h-9 w-auto lg:h-10" />
            <span className="hidden xl:inline">{STRINGS.appName}</span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm lg:flex">
            {messLinks.map((link) => (
              <DesktopNavLink key={link.href} link={link} active={isActive(link.href)} />
            ))}
            {messLinks.length > 0 && appLinks.length > 0 && <span className="mx-1 h-6 w-px bg-slate-200" />}
            {appLinks.map((link) => (
              <DesktopNavLink key={link.href} link={link} active={isActive(link.href)} />
            ))}
            {user ? (
              <>
                <span className="mx-1 h-6 w-px bg-slate-200" />
                <NotificationBell />
                <ProfileMenu />
              </>
            ) : showAuthLinks ? (
              <>
                {appLinks.length > 0 && <span className="mx-1 h-6 w-px bg-slate-200" />}
                <Link
                  href={ROUTES.auth.login}
                  className={`rounded-full px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${FOCUS_RING}`}
                >
                  {strings.nav.login}
                </Link>
                <Link
                  href={ROUTES.auth.register}
                  className={`ml-1 rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-4 py-2 text-white transition-all hover:bg-brand-700 active:translate-y-px ${FOCUS_RING}`}
                >
                  {strings.nav.register}
                </Link>
              </>
            ) : null}
          </nav>

          {(user || showAuthLinks || appLinks.length > 0 || messLinks.length > 0) && (
            <div className="flex items-center gap-1 lg:hidden">
              {user && <NotificationBell />}
              {user && <ProfileMenu />}
              <button
                onClick={() => setOpen((prev) => !prev)}
                aria-label={strings.nav.toggleMenu}
                aria-expanded={open}
                aria-controls="mobile-nav"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 ${FOCUS_RING}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
                </svg>
              </button>
            </div>
          )}
        </div>

        {open && (
          <nav
            id="mobile-nav"
            className="safe-bottom max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-slate-100 bg-white px-4 pb-6 pt-3 text-sm lg:hidden"
          >
            <div className="mx-auto flex max-w-content flex-col gap-1">
              {messLinks.length > 0 && <MobileNavHeading>{strings.nav.sectionMess}</MobileNavHeading>}
              {messLinks.map((link) => (
                <MobileNavLink
                  key={link.href}
                  link={link}
                  active={isActive(link.href)}
                  onNavigate={() => setOpen(false)}
                />
              ))}

              {appLinks.length > 0 && <MobileNavHeading>{STRINGS.appName}</MobileNavHeading>}
              {appLinks.map((link) => (
                <MobileNavLink
                  key={link.href}
                  link={link}
                  active={isActive(link.href)}
                  onNavigate={() => setOpen(false)}
                />
              ))}

              {(user || showAuthLinks) && (appLinks.length > 0 || messLinks.length > 0) && (
                <div className="my-2 border-t border-slate-100" />
              )}

              {user ? (
                <>
                  <Link
                    href={ROUTES.profile}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(ROUTES.profile) ? 'page' : undefined}
                    className={`rounded-xl px-3 py-2.5 transition-colors ${FOCUS_RING} ${
                      isActive(ROUTES.profile) ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700'
                    }`}
                  >
                    {strings.nav.profile}
                  </Link>
                  <button
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                    className={`mt-1 rounded-xl border border-slate-300 px-3 py-2.5 text-left text-slate-700 hover:bg-slate-100 ${FOCUS_RING}`}
                  >
                    {strings.nav.logout}
                  </button>
                </>
              ) : showAuthLinks ? (
                <>
                  <Link
                    href={ROUTES.auth.login}
                    onClick={() => setOpen(false)}
                    className={`rounded-xl px-3 py-2.5 text-slate-700 hover:bg-slate-100 ${FOCUS_RING}`}
                  >
                    {strings.nav.login}
                  </Link>
                  <Link
                    href={ROUTES.auth.register}
                    onClick={() => setOpen(false)}
                    className={`mt-1 rounded-xl bg-brand-600 px-3 py-2.5 text-white ${FOCUS_RING}`}
                  >
                    {strings.nav.register}
                  </Link>
                </>
              ) : null}
            </div>
          </nav>
        )}
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <Footer />
    </div>
  );
}
