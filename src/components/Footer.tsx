import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { useToast } from '@/components/ToastProvider';
import { appConfig, authorConfig } from '@/config';
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

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => setSettings(data.settings))
      .catch(() => setSettings(null));
  }, []);

  const year = new Date().getFullYear();
  const companyName = settings?.companyName ?? appConfig.name;
  const copyrightOwner = settings?.copyrightOwner ?? appConfig.name;
  const showNewsletter = settings?.newsletterEnabled !== false;

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubscribing(true);
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not subscribe.');
      toast.success(data.message ?? 'Subscribed!');
      setEmail('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <a
              href={authorConfig.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <Logo className="h-10 w-auto" />
              <span className="text-lg font-semibold">{companyName}</span>
            </a>
            {settings?.tagline && <p className="mt-3 max-w-xs text-sm text-slate-500">{settings.tagline}</p>}
            <Link
              href={ROUTES.guide}
              className="mt-3 inline-block text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
            >
              How it works →
            </Link>
          </div>

          <div className="text-sm text-slate-600">
            <h3 className="font-semibold text-slate-900">Contact</h3>
            <ul className="mt-3 space-y-1">
              {settings?.address && <li>{settings.address}</li>}
              {settings?.contactEmail && (
                <li>
                  <a href={`mailto:${settings.contactEmail}`} className="hover:underline">
                    {settings.contactEmail}
                  </a>
                </li>
              )}
              {settings?.contactPhone && <li>{settings.contactPhone}</li>}
              {!settings?.address && !settings?.contactEmail && !settings?.contactPhone && (
                <li className="text-slate-400">Contact details coming soon.</li>
              )}
            </ul>
            {(settings?.facebookUrl || settings?.twitterUrl) && (
              <div className="mt-3 flex gap-4">
                {settings?.facebookUrl && (
                  <a href={settings.facebookUrl} target="_blank" rel="noreferrer" className="hover:underline">
                    Facebook
                  </a>
                )}
                {settings?.twitterUrl && (
                  <a href={settings.twitterUrl} target="_blank" rel="noreferrer" className="hover:underline">
                    Twitter / X
                  </a>
                )}
              </div>
            )}
          </div>

          {showNewsletter && (
            <div>
              <h3 className="font-semibold text-slate-900">Newsletter</h3>
              <p className="mt-3 text-sm text-slate-500">Get updates from {companyName}.</p>
              <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={subscribe}>
                <input
                  id="newsletter-email"
                  name="newsletterEmail"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  aria-label="Email for newsletter"
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={subscribing}
                  className="rounded-full bg-slate-900 px-5 py-2.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {subscribing ? '...' : 'Subscribe'}
                </button>
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
            {strings.footer.builtBy(authorConfig.name)} ·{' '}
            <a href={`mailto:${authorConfig.email}`} className="hover:underline">
              {authorConfig.email}
            </a>{' '}
            · {strings.footer.licensed(authorConfig.license)}
          </p>
        </div>
      </div>
    </footer>
  );
}
