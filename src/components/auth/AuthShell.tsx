import type { ReactNode } from 'react';
import Logo from '@/components/Logo';
import { appConfig } from '@/config';
import { strings } from '@/lib/i18n';

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function BrandingPanel() {
  const hero = strings.landing.hero;

  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-900 p-10 text-white lg:flex lg:w-[42%] lg:shrink-0 lg:flex-col lg:justify-between">
      <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-brand-400/20 blur-3xl" aria-hidden />

      <div className="relative flex items-center gap-2.5">
        <Logo className="h-9 w-9" alt={appConfig.name} />
        <span className="text-lg font-semibold">{appConfig.name}</span>
      </div>

      <div className="relative mt-10">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight">
          {hero.title} <span className="text-brand-200">{hero.titleAccent}</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-brand-100">{strings.common.appTagline}</p>

        <ul className="mt-8 space-y-3">
          {hero.highlights.map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-white">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-brand-100">
                <CheckIcon />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative mt-10 text-xs text-brand-200">{hero.eyebrow}</p>
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5 lg:flex">
          <BrandingPanel />
          <div className="flex-1 p-6 sm:p-10 lg:flex lg:items-center lg:p-12">
            <div className="w-full">{children}</div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AuthShell;
