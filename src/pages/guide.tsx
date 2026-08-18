import { useEffect, useState, type ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useCurrentUser } from '@/components/UserProvider';
import { commentsAnchorPath, ROUTES } from '@/lib/routes';
import { appConfig } from '@/config';
import { strings } from '@/lib/i18n';
import {
  BalanceFigure,
  ClosingFigure,
  Figure,
  MealEditFigure,
  MealRateFigure,
  MonthFlowFigure,
  RolesFigure,
  SplitFigure
} from '@/components/guide/Figures';
import {
  AccountPreview,
  BazarPreview,
  CommunityPreview,
  DashboardPreview,
  LoginPreview,
  MealsPreview,
  NotificationsPreview,
  PermissionsPreview,
  PhonePreview,
  QuickReplyPreview,
  RegisterPreview,
  TalkingPreview
} from '@/components/landing/Mockups';

const guide = strings.guide;
const permissionLabels = strings.admin.permissions;

type Section = { id: string; title: string };

const SECTIONS: Section[] = [
  { id: 'overview', title: guide.sections.overview.title },
  { id: 'roles', title: guide.sections.roles.title },
  { id: 'permissions', title: guide.sections.permissions.title },
  { id: 'dashboard', title: guide.sections.dashboard.title },
  { id: 'month', title: guide.sections.month.title },
  { id: 'joining', title: guide.sections.joining.title },
  { id: 'account', title: guide.sections.account.title },
  { id: 'meals', title: guide.sections.meals.title },
  { id: 'quick-reply', title: guide.sections.quickReply.title },
  { id: 'talking', title: guide.sections.talking.title },
  { id: 'community', title: guide.sections.community.title },
  { id: 'notifications', title: guide.sections.notifications.title },
  { id: 'rate', title: guide.sections.rate.title },
  { id: 'bazar', title: guide.sections.bazar.title },
  { id: 'bills', title: guide.sections.bills.title },
  { id: 'balances', title: guide.sections.balances.title },
  { id: 'past-meals', title: guide.sections.pastMeals.title },
  { id: 'closing', title: guide.sections.closing.title },
  { id: 'phone', title: guide.sections.phone.title },
  { id: 'faq', title: guide.sections.faq.title }
];

export default function GuidePage() {
  const { user } = useCurrentUser();
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 }
    );

    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Head>
        <title>{guide.pageTitle(appConfig.name)}</title>
        <meta name="description" content={guide.metaDescription(appConfig.name)} />
      </Head>

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-content px-4 py-12 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{guide.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{guide.pageTitle(appConfig.name)}</h1>
          <p className="mt-3 hyphens-auto text-justify text-lg text-slate-600">{guide.intro}</p>

          {!user && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={ROUTES.auth.register}
                className="rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-6 py-3 text-sm font-medium text-white hover:bg-brand-700 transition-all active:translate-y-px"
              >
                {guide.createAccount}
              </Link>
              <Link
                href={ROUTES.auth.login}
                className="rounded-full border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {guide.signIn}
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-content gap-10 px-4 py-10 lg:flex lg:py-14">
        <nav
          aria-label={guide.onThisPage}
          className="scrollbar-thin mb-8 lg:sticky lg:top-24 lg:mb-0 lg:h-fit lg:max-h-[calc(100vh-7rem)] lg:w-60 lg:shrink-0 lg:overflow-y-auto"
        >
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{guide.onThisPage}</p>
          <ul className="mt-2 space-y-0.5">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-current={active === section.id ? 'true' : undefined}
                  className={`block rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    active === section.id
                      ? 'bg-brand-600 font-medium text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1 space-y-14">
          <Section id="overview" title={guide.sections.overview.title}>
            <P>{guide.overview.p1}</P>
            <P>{guide.overview.p2(appConfig.name)}</P>
          </Section>

          <Section id="roles" title={guide.sections.roles.title}>
            <P>{guide.roles.intro}</P>
            <Definitions
              items={[
                { term: guide.roles.member, detail: guide.roles.memberDetail },
                { term: guide.roles.supervisor, detail: guide.roles.supervisorDetail },
                { term: guide.roles.admin, detail: guide.roles.adminDetail }
              ]}
            />
            <Figure title={guide.roles.figureTitle} caption={guide.roles.figureCaption}>
              <RolesFigure />
            </Figure>
          </Section>

          <Section id="permissions" title={guide.sections.permissions.title}>
            <P>
              {guide.permissions.p1Pre}
              <em>{guide.permissions.byDefault}</em>
              {guide.permissions.p1Mid}
              <strong>{guide.permissions.adminPath}</strong>
              {guide.permissions.p1Post}
            </P>
            <P>
              {guide.permissions.p2Pre}
              <strong>{permissionLabels.inherit}</strong>
              {guide.permissions.p2RoleDefaultPost}
              <strong>{permissionLabels.allow}</strong>
              {guide.permissions.p2AllowPost}
              <strong>{permissionLabels.deny}</strong>
              {guide.permissions.p2BlockPost}
            </P>
            <Definitions
              items={[
                { term: guide.permissions.readOnlyMember, detail: guide.permissions.readOnlyMemberDetail },
                { term: guide.permissions.trustedMember, detail: guide.permissions.trustedMemberDetail },
                { term: guide.permissions.supervisorMinusOne, detail: guide.permissions.supervisorMinusOneDetail }
              ]}
            />
            <Callout>
              {guide.permissions.calloutPre}
              <strong>{guide.permissions.customLabel}</strong>
              {guide.permissions.calloutPost}
            </Callout>
            <Figure title={guide.permissions.figureTitle} caption={guide.permissions.figureCaption}>
              <PermissionsPreview />
            </Figure>
          </Section>

          <Section id="dashboard" title={guide.sections.dashboard.title}>
            <P>
              {guide.dashboard.p1Pre}
              <Route href={ROUTES.community}>{strings.nav.community}</Route>
              {guide.dashboard.p1Mid}
              <em>{guide.dashboard.p1PrivateToMess}</em>
              {guide.dashboard.p1Post}
            </P>
            <P>
              {guide.dashboard.p2Pre}
              <Route href={ROUTES.dashboard}>{strings.nav.dashboard}</Route>
              {guide.dashboard.p2Post}
            </P>
            <Definitions
              items={[
                { term: guide.dashboard.memberQuestion, detail: guide.dashboard.memberAnswer },
                { term: guide.dashboard.cookQuestion, detail: guide.dashboard.cookAnswer },
                { term: guide.dashboard.supervisorQuestion, detail: guide.dashboard.supervisorAnswer },
                { term: guide.dashboard.adminQuestion, detail: guide.dashboard.adminAnswer }
              ]}
            />
            <Figure title={guide.dashboard.figureTitle} caption={guide.dashboard.figureCaption}>
              <DashboardPreview />
            </Figure>
            <Callout>{guide.dashboard.callout}</Callout>
          </Section>

          <Section id="month" title={guide.sections.month.title}>
            <P>{guide.month.p1}</P>
            <Figure title={guide.month.figureTitle} caption={guide.month.figureCaption}>
              <MonthFlowFigure />
            </Figure>
          </Section>

          <Section id="joining" title={guide.sections.joining.title}>
            <Steps items={[guide.joining.step1, guide.joining.step2, guide.joining.step3, guide.joining.step4]} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Figure title={guide.joining.registerFigureTitle} caption={guide.joining.registerFigureCaption}>
                <RegisterPreview />
              </Figure>
              <Figure title={guide.joining.loginFigureTitle} caption={guide.joining.loginFigureCaption}>
                <LoginPreview />
              </Figure>
            </div>
          </Section>

          <Section id="account" title={guide.sections.account.title}>
            <P>
              {guide.account.p1Pre}
              <Route href={ROUTES.profile}>{strings.nav.profile}</Route>
              {guide.account.p1Post}
            </P>
            <P>
              <strong>{guide.account.forgottenPassword}</strong>
              {guide.account.p2Pre}
              <em>{guide.account.forgotLinkLabel}</em>
              {guide.account.p2Mid}
            </P>
            <P>{guide.account.p3}</P>
            <Callout>{guide.account.callout}</Callout>
            <Figure title={guide.account.figureTitle} caption={guide.account.figureCaption}>
              <AccountPreview />
            </Figure>
          </Section>

          <Section id="meals" title={guide.sections.meals.title}>
            <P>
              {guide.meals.p1Pre}
              <Route href={ROUTES.meals}>{strings.nav.meals}</Route>
              {guide.meals.p1Mid}
              <A href="#past-meals">{guide.meals.pastMealLinkLabel}</A>
              {guide.meals.p1Post}
            </P>
            <Figure title={guide.meals.figureTitle} caption={guide.meals.figureCaption}>
              <MealsPreview />
            </Figure>
            <P>
              {guide.meals.p2Pre}
              <strong>{guide.meals.mealPlanLabel}</strong>
              {guide.meals.p2Post}
            </P>
            <P>
              {guide.meals.p3Pre}
              <strong>{guide.meals.showWholeMonthLabel}</strong>
              {guide.meals.p3Post}
            </P>
            <Callout>
              {guide.meals.calloutPre}
              <strong>{guide.meals.mealWeightsLabel}</strong>
              {guide.meals.calloutPost}
            </Callout>
          </Section>

          <Section id="quick-reply" title={guide.sections.quickReply.title}>
            <P>
              {guide.quickReply.p1Pre}
              <strong>{guide.quickReply.yesLabel}</strong>
              {guide.quickReply.p1Mid}
              <strong>{guide.quickReply.noLabel}</strong>
              {guide.quickReply.p1Post}
            </P>
            <P>
              {guide.quickReply.p2Pre}
              <em>{guide.quickReply.yourEmphasis}</em>
              {guide.quickReply.p2Mid}
              <strong>{guide.quickReply.chooseMealsLabel}</strong>
              {guide.quickReply.p2Post}
            </P>
            <Callout>
              {guide.quickReply.calloutPre}
              <Route href={ROUTES.dashboard}>{strings.nav.dashboard}</Route>
              {guide.quickReply.calloutMid}
              <Route href={ROUTES.meals}>{strings.nav.meals}</Route>
              {guide.quickReply.calloutPost}
            </Callout>
            <Figure title={guide.quickReply.figureTitle} caption={guide.quickReply.figureCaption}>
              <QuickReplyPreview />
            </Figure>
          </Section>

          <Section id="talking" title={guide.sections.talking.title}>
            <P>
              {guide.talking.p1Pre}
              <Route href={ROUTES.members}>{strings.nav.members}</Route>
              {guide.talking.p1Mid}
              <strong>{guide.talking.messCommentsLabel}</strong>
              {guide.talking.p1Post}
            </P>
            <P>
              {guide.talking.p2Pre}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">@</code>
              {guide.talking.p2Mid}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">@everyone</code>
              {guide.talking.p2Post}
            </P>
            <Callout>{guide.talking.callout}</Callout>
            <Figure title={guide.talking.figureTitle} caption={guide.talking.figureCaption}>
              <TalkingPreview />
            </Figure>
          </Section>

          <Section id="community" title={guide.sections.community.title}>
            <P>
              {guide.community.p1Pre}
              <Route href={commentsAnchorPath()}>{guide.talking.messCommentsLabel}</Route>
              {guide.community.p1Mid}
              <Route href={ROUTES.members}>{strings.nav.members}</Route>
              {guide.community.p1Mid2}
              <Route href={ROUTES.community}>{strings.nav.community}</Route>
              {guide.community.p1Mid3}
              {appConfig.name}
              {guide.community.p1Post}
            </P>
            <P>
              {guide.community.p2Pre}
              <strong>{guide.community.whatsNewLabel}</strong>
              {guide.community.p2Mid}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">@</code>
              {guide.community.p2Post}
            </P>
            <P>{guide.community.p3}</P>
            <Figure title={guide.community.figureTitle} caption={guide.community.figureCaption}>
              <CommunityPreview />
            </Figure>
          </Section>

          <Section id="notifications" title={guide.sections.notifications.title}>
            <P>
              {guide.notifications.p1Pre}
              <Route href={ROUTES.notifications}>{strings.notifications.panelTitle}</Route>
              {guide.notifications.p1Mid}
              <strong>{guide.notifications.markAllReadLabel}</strong>
              {guide.notifications.p1Post}
            </P>
            <P>{guide.notifications.p2}</P>
            <Definitions
              items={[
                { term: guide.notifications.mentionTerm, detail: guide.notifications.mentionDetail },
                { term: guide.notifications.pastMealTerm, detail: guide.notifications.pastMealDetail },
                { term: guide.notifications.decisionTerm, detail: guide.notifications.decisionDetail },
                { term: guide.notifications.invitationTerm, detail: guide.notifications.invitationDetail }
              ]}
            />
            <Callout>{guide.notifications.callout}</Callout>
            <Figure title={guide.notifications.figureTitle} caption={guide.notifications.figureCaption}>
              <NotificationsPreview />
            </Figure>
          </Section>

          <Section id="rate" title={guide.sections.rate.title}>
            <P>{guide.rate.p1}</P>
            <P>{guide.rate.p2}</P>
            <Definitions
              items={[
                { term: guide.rate.chargesYouTerm, detail: guide.rate.chargesYouDetail },
                { term: guide.rate.referenceTerm, detail: guide.rate.referenceDetail }
              ]}
            />
            <Figure title={guide.rate.figureTitle} caption={guide.rate.figureCaption}>
              <MealRateFigure />
            </Figure>
            <P>
              {guide.rate.p3Pre}
              <Route href={ROUTES.meals}>{strings.nav.meals}</Route>
              {guide.rate.p3Mid}
              <strong>{guide.rate.yourMealRateLabel}</strong>
              {guide.rate.p3Post}
            </P>
            <P>
              {guide.rate.p4Pre}
              <Route href={ROUTES.dashboard}>{strings.nav.dashboard}</Route>
              {guide.rate.p4Mid}
              <strong>{guide.rate.todaysRateLabel}</strong>
              {guide.rate.p4Mid2}
              <strong>{guide.rate.thisMonthLabel}</strong>
              {guide.rate.p4Post}
            </P>
            <Callout>{guide.rate.callout}</Callout>
          </Section>

          <Section id="bazar" title={guide.sections.bazar.title}>
            <P>
              {guide.bazar.p1Pre}
              <Route href={ROUTES.expenses}>{strings.nav.bazar}</Route>
              {guide.bazar.p1Post}
            </P>
            <P>{guide.bazar.p2}</P>
            <P>
              {guide.bazar.p3Pre}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">@name</code>
              {guide.bazar.p3Mid}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">@everyone</code>
              {guide.bazar.p3Post}
            </P>
            <Figure title={guide.bazar.figureTitle} caption={guide.bazar.figureCaption}>
              <BazarPreview />
            </Figure>
          </Section>

          <Section id="bills" title={guide.sections.bills.title}>
            <P>
              {guide.bills.p1Pre}
              <Route href={ROUTES.bills}>{strings.nav.bills}</Route>
              {guide.bills.p1Post}
            </P>
            <P>{guide.bills.p2}</P>
            <P>{guide.bills.p3}</P>
            <Definitions
              items={[
                { term: guide.bills.splitEquallyTerm, detail: guide.bills.splitEquallyDetail },
                { term: guide.bills.selectedMembersTerm, detail: guide.bills.selectedMembersDetail }
              ]}
            />
            <Figure title={guide.bills.figureTitle} caption={guide.bills.figureCaption}>
              <SplitFigure />
            </Figure>
          </Section>

          <Section id="balances" title={guide.sections.balances.title}>
            <P>
              {guide.balances.p1Pre}
              <Route href={ROUTES.payments}>{strings.nav.payments}</Route>
              {guide.balances.p1Post}
            </P>
            <Figure title={guide.balances.figureTitle} caption={guide.balances.figureCaption}>
              <BalanceFigure />
            </Figure>
            <P>{guide.balances.p2}</P>
            <Definitions
              items={[
                { term: guide.balances.settledTerm, detail: guide.balances.settledDetail },
                { term: guide.balances.partlyPaidTerm, detail: guide.balances.partlyPaidDetail },
                { term: guide.balances.unpaidTerm, detail: guide.balances.unpaidDetail },
                { term: guide.balances.refundDueTerm, detail: guide.balances.refundDueDetail }
              ]}
            />
            <Callout>{guide.balances.callout}</Callout>
          </Section>

          <Section id="past-meals" title={guide.sections.pastMeals.title}>
            <P>{guide.pastMeals.p1}</P>
            <P>
              {guide.pastMeals.p2Pre}
              <strong>{guide.pastMeals.editMyPastMealsLabel}</strong>
              {guide.pastMeals.p2Post}
            </P>
            <P>
              {guide.pastMeals.p3Pre}
              <strong>{guide.pastMeals.requestLabel}</strong>
              {guide.pastMeals.p3Post}
            </P>
            <P>
              {guide.pastMeals.p4Pre}
              <strong>{guide.pastMeals.supervisorLabel}</strong>
              {guide.pastMeals.p4Post}
            </P>
            <Figure title={guide.pastMeals.figureTitle} caption={guide.pastMeals.figureCaption}>
              <MealEditFigure />
            </Figure>
          </Section>

          <Section id="closing" title={guide.sections.closing.title}>
            <P>
              {guide.closing.p1Pre}
              <strong>{guide.closing.closesLabel}</strong>
              {guide.closing.p1Post}
            </P>
            <P>
              {guide.closing.p2Pre}
              <strong>{guide.closing.broughtForwardLabel}</strong>
              {guide.closing.p2Post}
            </P>
            <P>{guide.closing.p3}</P>
            <Figure title={guide.closing.figureTitle} caption={guide.closing.figureCaption}>
              <ClosingFigure />
            </Figure>
          </Section>

          <Section id="phone" title={guide.sections.phone.title}>
            <P>{guide.phone.p1(appConfig.name)}</P>
            <P>{guide.phone.p2}</P>
            <Figure title={guide.phone.figureTitle} caption={guide.phone.figureCaption}>
              <PhonePreview />
            </Figure>
            <Definitions
              items={[
                { term: guide.phone.androidTerm, detail: guide.phone.androidDetail },
                { term: guide.phone.iphoneTerm, detail: guide.phone.iphoneDetail },
                { term: guide.phone.desktopTerm, detail: guide.phone.desktopDetail }
              ]}
            />
            <Callout>{guide.phone.callout}</Callout>
          </Section>

          <Section id="faq" title={guide.sections.faq.title}>
            <Definitions
              items={[
                { term: guide.faq.commentsTabTerm, detail: guide.faq.commentsTabDetail },
                { term: guide.faq.forgotPasswordTerm, detail: guide.faq.forgotPasswordDetail },
                { term: guide.faq.fiveDaysTerm, detail: guide.faq.fiveDaysDetail },
                { term: guide.faq.midnightTerm, detail: guide.faq.midnightDetail },
                { term: guide.faq.photoUploadTerm, detail: guide.faq.photoUploadDetail },
                { term: guide.faq.vanishedPageTerm, detail: guide.faq.vanishedPageDetail },
                { term: guide.faq.groceriesBackTerm, detail: guide.faq.groceriesBackDetail },
                { term: guide.faq.awayTwoWeeksTerm, detail: guide.faq.awayTwoWeeksDetail },
                { term: guide.faq.joinedHalfwayTerm, detail: guide.faq.joinedHalfwayDetail },
                { term: guide.faq.supervisorChangeTerm, detail: guide.faq.supervisorChangeDetail },
                { term: guide.faq.leftOwingTerm, detail: guide.faq.leftOwingDetail },
                { term: guide.faq.messShutDownTerm, detail: guide.faq.messShutDownDetail }
              ]}
            />
          </Section>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold">{guide.stillStuckTitle}</h2>
            <p className="mt-2 text-slate-600">{guide.stillStuckBody}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={user ? ROUTES.dashboard : ROUTES.auth.register}
                className="rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-all active:translate-y-px"
              >
                {user ? guide.backToDashboard : guide.getStarted}
              </Link>
              <Link
                href={ROUTES.home}
                className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {guide.home}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="hyphens-auto text-justify text-base leading-relaxed text-slate-600">{children}</p>;
}

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="font-medium text-slate-900 underline underline-offset-2 hover:text-slate-600">
      {children}
    </a>
  );
}

function Route({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-slate-900 underline underline-offset-2 hover:text-slate-600">
      {children}
    </Link>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="hyphens-auto rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-justify text-sm leading-relaxed text-slate-700">
      {children}
    </div>
  );
}

function Definitions({ items }: { items: { term: string; detail: string }[] }) {
  return (
    <dl className="space-y-4">
      {items.map((item) => (
        <div key={item.term} className="border-l-2 border-slate-200 pl-4">
          <dt className="font-semibold text-slate-900">{item.term}</dt>
          <dd className="mt-1 hyphens-auto text-justify leading-relaxed text-slate-600">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-4">
      {items.map((item, index) => (
        <li key={item} className="flex gap-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
            {index + 1}
          </span>
          <span className="hyphens-auto pt-0.5 text-justify leading-relaxed text-slate-600">{item}</span>
        </li>
      ))}
    </ol>
  );
}
