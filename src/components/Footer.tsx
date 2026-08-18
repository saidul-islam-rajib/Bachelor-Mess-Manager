import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { appConfig, authorConfig, cacheConfig } from '@/config';
import { cached } from '@/lib/cache';
import { strings } from '@/lib/i18n';
import { ROUTES } from '@/lib/routes';

type Settings = {
  companyName: string;
  tagline?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  copyrightOwner: string;
  facebookUrl?: string | null;
  twitterUrl?: string | null;
  newsletterEnabled: boolean;
};

export default function Footer() {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [email, setEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    let active = true;

    cached('site-settings', cacheConfig.siteSettingsMs, () =>
      fetch('/api/settings')
        .then((res) => res.json())
        .then((data) => data.settings as Settings)
    )
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch(() => {
        if (active) setSettings(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const year = new Date().getFullYear();
  const { user } = useCurrentUser();
  const companyName = settings?.companyName ?? appConfig.name;
  const copyrightOwner = settings?.copyrightOwner ?? appConfig.name;
  const showNewsletter = settings?.newsletterEnabled !== false;

  useEffect(() => {
    if (!user) {
      setSubscribed(false);
      return;
    }

    let active = true;
    fetch('/api/newsletter')
      .then((res) => res.json())
      .then((data) => {
        if (active) setSubscribed(Boolean(data?.subscribed));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (subscribing) return;

    const unsubscribing = Boolean(user) && subscribed;
    setSubscribing(true);
    try {
      const res = await fetch('/api/newsletter', {
        method: unsubscribing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: unsubscribing ? undefined : JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? strings.footer.subscribeFailed);

      setSubscribed(Boolean(data?.subscribed));
      toast.success(data.message ?? strings.footer.subscribed);
      if (!user) setEmail('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <footer className="safe-bottom border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-content px-4 py-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <a
              href={authorConfig.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <Logo className="h-10 w-auto" />
              <span className="text-lg font-semibold">{companyName}</span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              {settings?.tagline || appConfig.tagline}
            </p>
          </div>

          <nav aria-label={strings.footer.ariaLabel} className="text-sm text-slate-600 lg:col-span-2">
            <h3 className="font-semibold text-slate-900">{strings.footer.explore}</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href={ROUTES.guide} className="inline-block py-1 transition-colors hover:text-slate-900 hover:underline">
                  {strings.footer.howItWorks}
                </Link>
              </li>
              <li>
                <Link href={ROUTES.home} className="inline-block py-1 transition-colors hover:text-slate-900 hover:underline">
                  {strings.footer.home}
                </Link>
              </li>
              {user ? (
                <li>
                  <Link href={ROUTES.dashboard} className="inline-block py-1 transition-colors hover:text-slate-900 hover:underline">
                    {strings.nav.dashboard}
                  </Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link href={ROUTES.auth.login} className="inline-block py-1 transition-colors hover:text-slate-900 hover:underline">
                      {strings.footer.signIn}
                    </Link>
                  </li>
                  <li>
                    <Link href={ROUTES.auth.register} className="inline-block py-1 transition-colors hover:text-slate-900 hover:underline">
                      {strings.footer.createAccount}
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>

          <div className="text-sm text-slate-600 lg:col-span-3">
            <h3 className="font-semibold text-slate-900">{strings.footer.contact}</h3>
            <ul className="mt-3 space-y-2">
              {settings?.address && <li>{settings.address}</li>}
              {settings?.contactEmail && (
                <li>
                  <a href={`mailto:${settings.contactEmail}`} className="inline-block py-1 hover:underline">
                    {settings.contactEmail}
                  </a>
                </li>
              )}
              {settings?.contactPhone && <li>{settings.contactPhone}</li>}
              {!settings?.address && !settings?.contactEmail && !settings?.contactPhone && (
                <li className="text-slate-400">{strings.footer.contactComingSoon}</li>
              )}
            </ul>
            {(settings?.facebookUrl || settings?.twitterUrl) && (
              <div className="mt-4 flex gap-4">
                {settings?.facebookUrl && (
                  <a href={settings.facebookUrl} target="_blank" rel="noreferrer" className="inline-block py-1 hover:text-slate-900 hover:underline">
                    {strings.footer.facebook}
                  </a>
                )}
                {settings?.twitterUrl && (
                  <a href={settings.twitterUrl} target="_blank" rel="noreferrer" className="inline-block py-1 hover:text-slate-900 hover:underline">
                    {strings.footer.twitter}
                  </a>
                )}
              </div>
            )}
          </div>

          {showNewsletter && (
            <div className="lg:col-span-3">
              <h3 className="font-semibold text-slate-900">{strings.footer.newsletter}</h3>
              <p className="mt-3 text-sm text-slate-500">
                {user && subscribed
                  ? strings.footer.subscribedAs(user.email)
                  : user
                    ? strings.footer.willUseAccountEmail(user.email)
                    : strings.footer.newsletterFrom(companyName)}
              </p>
              <form className="mt-3 flex flex-col gap-2" onSubmit={submit}>
                {!user && (
                  <input
                    id="newsletter-email"
                    name="newsletterEmail"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="email"
                    aria-label={strings.footer.emailLabel}
                    required
                    placeholder={strings.footer.emailPlaceholder}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:bg-white"
                  />
                )}
                <Button type="submit" loading={subscribing} variant={subscribed ? 'secondary' : 'primary'}>
                  {subscribing
                    ? subscribed
                      ? strings.footer.unsubscribing
                      : strings.footer.subscribing
                    : subscribed
                      ? strings.footer.unsubscribe
                      : strings.footer.subscribe}
                </Button>
              </form>
            </div>
          )}
        </div>

        <div className="mt-8 space-y-1 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">
          <p>
            &copy; {authorConfig.copyrightStartYear === year ? year : `${authorConfig.copyrightStartYear}-${year}`}{' '}
            <a href={authorConfig.url} target="_blank" rel="noreferrer" className="font-medium text-slate-600 hover:underline">
              {copyrightOwner}
            </a>
            . {strings.footer.rights}
          </p>
          <p className="text-xs text-slate-400">
            {strings.footer.builtByLabel}{' '}
            <a
              href={authorConfig.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-slate-500 hover:text-brand-700 hover:underline"
            >
              {authorConfig.name}
            </a>{' '}
            · {strings.footer.licensed(authorConfig.license)}
          </p>
        </div>
      </div>
    </footer>
  );
}
