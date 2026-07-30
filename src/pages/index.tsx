import Head from 'next/head';
import { LinkButton } from '@/components/ui';
import { LandingIcon, type LandingIconName } from '@/components/landing/Icons';
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
import { ROUTES } from '@/lib/routes';

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

  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-gradient-to-b from-slate-200/70 to-transparent blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            {landing.hero.eyebrow}
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            {landing.hero.title}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">{landing.hero.subtitle}</p>

          {user ? (
            <div className="mt-8">
              <p className="text-sm text-slate-600">{landing.hero.signedInAs(user.name)}</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <LinkButton href={ROUTES.dashboard} size="lg">
                  {landing.hero.dashboard}
                </LinkButton>
                <LinkButton href={ROUTES.groups} size="lg" variant="secondary">
                  {landing.hero.groups}
                </LinkButton>
              </div>
            </div>
          ) : (
            <div className="mt-8">
              <div className="flex flex-col gap-3 sm:flex-row">
                <LinkButton href={ROUTES.auth.register} size="lg">
                  {landing.hero.primary}
                </LinkButton>
                <LinkButton href={ROUTES.auth.login} size="lg" variant="secondary">
                  {landing.hero.secondary}
                </LinkButton>
              </div>
              <p className="mt-4 text-xs text-slate-500">{landing.hero.note}</p>
            </div>
          )}
        </div>

        <div className="relative">
          <DashboardPreview />
          <span className="absolute -left-3 top-8 hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-lg xl:inline-block">
            {landing.hero.chipRate}
          </span>
          <span className="absolute -right-4 bottom-10 hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-lg xl:inline-block">
            {landing.hero.chipSplit}
          </span>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <SectionHeader title={landing.problem.title} subtitle={landing.problem.subtitle} />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {landing.problem.items.map((item, index) => (
            <div key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <SectionHeader title={landing.features.title} subtitle={landing.features.subtitle} />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {landing.features.items.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <LandingIcon name={item.icon as LandingIconName} />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
            </div>
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
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={reversed ? 'lg:order-2' : undefined}>
        <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
          {tag}
        </span>
        <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{body}</p>
      </div>
      <div className={reversed ? 'lg:order-1' : undefined}>{preview}</div>
    </div>
  );
}

function Screens() {
  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <SectionHeader title={landing.screens.title} subtitle={landing.screens.subtitle} />
        <div className="mt-12 space-y-16 sm:space-y-20">
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
      <div className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
        <SectionHeader title={landing.math.title} subtitle={landing.math.subtitle} />
        <div className="mt-10">
          <MealRateDiagram />
          <p className="mt-4 text-center text-sm text-slate-500">{landing.math.rateCaption}</p>
        </div>
        <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center sm:p-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{landing.math.balanceTitle}</h3>
          <p className="mt-3 text-base font-medium leading-relaxed text-slate-900 sm:text-lg">
            {strings.payments.balanceFormula}
          </p>
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <SectionHeader title={landing.steps.title} />
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {landing.steps.items.map((item, index) => (
            <li key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="text-3xl font-semibold tabular-nums text-slate-200">{`0${index + 1}`}</span>
              <h3 className="mt-2 text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Roles() {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <SectionHeader title={landing.roles.title} />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {landing.roles.items.map((item) => (
            <div key={item.role} className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-base font-semibold text-slate-900">
                {strings.roles[item.role as keyof typeof strings.roles]}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <SectionHeader title={landing.trust.title} />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {landing.trust.items.map((item) => (
            <div key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-700">
                <LandingIcon name={item.icon as LandingIconName} />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const { user } = useCurrentUser();

  return (
    <section className="bg-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{landing.cta.title}</h2>
        <p className="mt-3 text-slate-300">{landing.cta.subtitle}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {user ? (
            <LinkButton href={ROUTES.dashboard} size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
              {landing.hero.dashboard}
            </LinkButton>
          ) : (
            <>
              <LinkButton
                href={ROUTES.auth.register}
                size="lg"
                className="bg-white text-slate-900 hover:bg-slate-100"
              >
                {landing.cta.primary}
              </LinkButton>
              <LinkButton
                href={ROUTES.auth.login}
                size="lg"
                variant="secondary"
                className="border-slate-600 text-slate-100 hover:bg-slate-800"
              >
                {landing.cta.secondary}
              </LinkButton>
            </>
          )}
        </div>
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
        <meta property="og:image" content="/logo.png" />
        <meta name="twitter:card" content="summary" />
      </Head>

      <Hero />
      <Problem />
      <Features />
      <Screens />
      <Maths />
      <Steps />
      <Roles />
      <Trust />
      <FinalCta />
    </>
  );
}
