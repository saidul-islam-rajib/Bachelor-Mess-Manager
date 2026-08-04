import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Collapsible, LinkButton } from '@/components/ui';
import { LandingIcon, type LandingIconName } from '@/components/landing/Icons';
import Reveal from '@/components/landing/Reveal';
import {
  BalancesPreview,
  BazarPreview,
  DashboardPreview,
  MealRateDiagram,
  MealsPreview
} from '@/components/landing/Mockups';
import { useCurrentUser } from '@/components/UserProvider';
import { appConfig } from '@/config';
import { strings } from '@/lib/i18n';
import { ROUTES, safeNextPath, withNextParam } from '@/lib/routes';

const landing = strings.landing;

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-3 text-slate-600">{subtitle}</p>}
    </div>
  );
}

function Hero() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const next = safeNextPath(router.query.next);
  const loginHref = withNextParam(ROUTES.auth.login, next);

  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 via-white/85 to-white"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[46rem] -translate-x-1/2 rounded-full bg-slate-300/30 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-content gap-10 px-4 py-12 sm:gap-12 sm:py-24 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            {landing.hero.eyebrow}
          </span>

          <h1 className="mt-6 text-[2rem] font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]">
            {landing.hero.title} <span className="text-slate-400">{landing.hero.titleAccent}</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            {landing.hero.subtitle}
          </p>

          {user ? (
            <div className="mt-9">
              <p className="text-sm text-slate-600">{landing.hero.signedInAs(user.name)}</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <LinkButton href={ROUTES.dashboard} size="lg">
                  {landing.hero.dashboard}
                </LinkButton>
                <LinkButton href={ROUTES.members} size="lg" variant="secondary">
                  {landing.hero.groups}
                </LinkButton>
                <LinkButton href={ROUTES.guide} size="lg" variant="secondary">
                  Read the guide
                </LinkButton>
              </div>
            </div>
          ) : next ? (
            <div className="mt-9">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
                <p className="text-sm font-semibold text-amber-900">{landing.hero.gatedTitle}</p>
                <p className="mt-1 text-sm leading-relaxed text-amber-800">{landing.hero.gatedBody}</p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <LinkButton href={loginHref} size="lg">
                    {landing.hero.gatedAction}
                  </LinkButton>
                  <LinkButton href={ROUTES.auth.register} size="lg" variant="secondary" className="bg-white">
                    {landing.hero.primary}
                  </LinkButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-9">
              <div className="flex flex-col gap-3 sm:flex-row">
                <LinkButton href={ROUTES.auth.register} size="lg" className="shadow-lg shadow-slate-900/15">
                  {landing.hero.primary}
                </LinkButton>
                <LinkButton href={loginHref} size="lg" variant="secondary" className="bg-white">
                  {landing.hero.secondary}
                </LinkButton>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                {landing.hero.note}{' '}
                <Link href={ROUTES.guide} className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
                  See how it works
                </Link>
                .
              </p>
            </div>
          )}

          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2.5 border-t border-slate-200 pt-6 sm:mt-10 sm:gap-x-6 sm:gap-y-3">
            {landing.hero.highlights.map((highlight) => (
              <li key={highlight} className="flex items-center gap-2 text-sm text-slate-600">
                <LandingIcon name="check" className="h-4 w-4 text-slate-400" />
                {highlight}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-4 rounded-[2.5rem] bg-gradient-to-tr from-slate-300/40 via-white to-slate-200/50 blur-2xl"
          />
          <div className="relative">
            <DashboardPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-content px-4 py-12 sm:py-20">
        <Reveal>
          <SectionHeader title={landing.problem.title} subtitle={landing.problem.subtitle} />
        </Reveal>
        <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-5 md:grid-cols-3">
          {landing.problem.items.map((item, index) => (
            <Reveal key={item.title} delayMs={index * 90}>
              <div className="h-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-content px-4 py-12 sm:py-20">
        <Reveal>
          <SectionHeader title={landing.features.title} subtitle={landing.features.subtitle} />
        </Reveal>
        <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {landing.features.items.map((item, index) => (
            <Reveal key={item.title} delayMs={(index % 3) * 90} className="h-full">
              <div className="group h-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg sm:p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white transition-transform group-hover:scale-105">
                  <LandingIcon name={item.icon as LandingIconName} />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScreenRow({
  tag,
  title,
  body,
  preview,
  reversed = false
}: {
  tag: string;
  title: string;
  body: string;
  preview: React.ReactNode;
  reversed?: boolean;
}) {
  return (
    <div className="grid items-center gap-6 sm:gap-10 lg:grid-cols-2 lg:gap-16">
      <Reveal className={reversed ? 'lg:order-2' : undefined}>
        <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
          {tag}
        </span>
        <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{body}</p>
      </Reveal>
      <Reveal delayMs={120} className={reversed ? 'lg:order-1' : undefined}>
        {preview}
      </Reveal>
    </div>
  );
}

function Screens() {
  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-content px-4 py-12 sm:py-20">
        <Reveal>
          <SectionHeader title={landing.screens.title} subtitle={landing.screens.subtitle} />
        </Reveal>
        <div className="mt-10 space-y-12 sm:mt-12 sm:space-y-20">
          <ScreenRow
            tag={landing.screens.meals.tag}
            title={landing.screens.meals.title}
            body={landing.screens.meals.body}
            preview={<MealsPreview />}
          />
          <ScreenRow
            tag={landing.screens.bazar.tag}
            title={landing.screens.bazar.title}
            body={landing.screens.bazar.body}
            preview={<BazarPreview />}
            reversed
          />
          <ScreenRow
            tag={landing.screens.balances.tag}
            title={landing.screens.balances.title}
            body={landing.screens.balances.body}
            preview={<BalancesPreview />}
          />
        </div>
      </div>
    </section>
  );
}

function Maths() {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-20">
        <Reveal>
          <SectionHeader title={landing.math.title} subtitle={landing.math.subtitle} />
        </Reveal>
        <Reveal delayMs={80}>
          <div className="mt-10">
            <MealRateDiagram />
            <p className="mt-4 text-center text-sm text-slate-500">{landing.math.rateCaption}</p>
          </div>
        </Reveal>
        <Reveal delayMs={140}>
          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center sm:p-8">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {landing.math.balanceTitle}
            </h3>
            <p className="mt-3 text-base font-medium leading-relaxed text-slate-900 sm:text-lg">
              {strings.payments.balanceFormula}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-content px-4 py-12 sm:py-20">
        <Reveal>
          <SectionHeader title={landing.steps.title} />
        </Reveal>
        <ol className="mt-8 grid gap-4 sm:mt-10 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {landing.steps.items.map((item, index) => (
            <li key={item.title} className="h-full">
              <Reveal delayMs={index * 90} className="h-full">
                <div className="h-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <span className="text-3xl font-semibold tabular-nums text-slate-200">{`0${index + 1}`}</span>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function RoleGuide() {
  const [active, setActive] = useState(0);
  const current = landing.roleGuide.items[active];

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-content px-4 py-12 sm:py-20">
        <Reveal>
          <SectionHeader title={landing.roleGuide.title} subtitle={landing.roleGuide.subtitle} />
        </Reveal>

        <Reveal delayMs={80}>
          <div
            role="tablist"
            aria-label={landing.roleGuide.title}
            className="mx-auto mt-8 flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 sm:mt-10"
          >
            {landing.roleGuide.items.map((item, index) => (
              <button
                key={item.role}
                type="button"
                role="tab"
                id={`role-tab-${item.role}`}
                aria-selected={active === index}
                aria-controls={`role-panel-${item.role}`}
                onClick={() => setActive(index)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                  active === index ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {strings.roles[item.role as keyof typeof strings.roles]}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delayMs={140}>
          <div
            key={current.role}
            role="tabpanel"
            id={`role-panel-${current.role}`}
            aria-labelledby={`role-tab-${current.role}`}
            className="mx-auto mt-8 max-w-3xl motion-safe:animate-fade-up"
          >
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-lg font-medium text-slate-900">{current.tagline}</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                  <LandingIcon name="history" className="h-3.5 w-3.5" />
                  {current.minutes}
                </span>
              </div>

              <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {landing.roleGuide.dailyLabel}
              </h3>
              <ul className="mt-3 space-y-2.5">
                {current.does.map((task) => (
                  <li key={task} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                    <LandingIcon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <span>{task}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {landing.roleGuide.limitLabel}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{current.cannot}</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-20">
        <Reveal>
          <SectionHeader title={landing.faq.title} subtitle={landing.faq.subtitle} />
        </Reveal>

        <div className="mt-8 space-y-3 sm:mt-10">
          {landing.faq.items.map((item, index) => (
            <Reveal key={item.question} delayMs={index * 60}>
              <Collapsible title={item.question}>
                <p className="text-sm leading-relaxed text-slate-600">{item.answer}</p>
              </Collapsible>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-8 text-center">
            <LinkButton href={ROUTES.guide} variant="secondary" size="lg">
              {landing.faq.more}
            </LinkButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-content px-4 py-12 sm:py-20">
        <Reveal>
          <SectionHeader title={landing.trust.title} />
        </Reveal>
        <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-5 md:grid-cols-3">
          {landing.trust.items.map((item, index) => (
            <Reveal key={item.title} delayMs={index * 90} className="h-full">
              <div className="h-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-700">
                  <LandingIcon name={item.icon as LandingIconName} />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const loginHref = withNextParam(ROUTES.auth.login, safeNextPath(router.query.next));

  return (
    <section className="relative overflow-hidden bg-slate-900">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:26px_26px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-slate-500/20 blur-3xl"
      />

      <div className="relative mx-auto max-w-3xl px-4 py-14 text-center sm:py-24">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{landing.cta.title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-slate-300 sm:text-lg">{landing.cta.subtitle}</p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          {user ? (
            <LinkButton href={ROUTES.dashboard} size="lg" variant="inverse">
              {landing.hero.dashboard}
            </LinkButton>
          ) : (
            <>
              <LinkButton href={ROUTES.auth.register} size="lg" variant="inverse">
                {landing.cta.primary}
              </LinkButton>
              <LinkButton href={loginHref} size="lg" variant="inverseSecondary">
                {landing.cta.secondary}
              </LinkButton>
            </>
          )}
        </div>

        {!user && <p className="mt-6 text-xs text-slate-400">{landing.hero.note}</p>}
      </div>
    </section>
  );
}

export default function Home() {
  const title = landing.meta.title(appConfig.name);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={landing.meta.description} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={landing.meta.description} />
        <meta property="og:image" content="/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="/og-image.png" />
      </Head>

      <Hero />
      <Problem />
      <Features />
      <Screens />
      <Maths />
      <RoleGuide />
      <Steps />
      <Trust />
      <Faq />
      <FinalCta />
    </>
  );
}
