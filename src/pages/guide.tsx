import { useEffect, useState, type ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useCurrentUser } from '@/components/UserProvider';
import { ROUTES } from '@/lib/routes';
import { appConfig } from '@/config';
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

type Section = { id: string; title: string };

const SECTIONS: Section[] = [
  { id: 'overview', title: 'What this is' },
  { id: 'roles', title: 'Who does what' },
  { id: 'month', title: 'A month in the mess' },
  { id: 'joining', title: 'Getting in' },
  { id: 'meals', title: 'Meals and meal plans' },
  { id: 'quick-reply', title: 'Answering meals in one tap' },
  { id: 'community', title: 'The community room' },
  { id: 'rate', title: 'How the meal rate works' },
  { id: 'bazar', title: 'Bazar and comments' },
  { id: 'bills', title: 'Bills and fixed costs' },
  { id: 'balances', title: 'Balances and payments' },
  { id: 'past-meals', title: 'Changing a past meal' },
  { id: 'closing', title: 'Closing a month' },
  { id: 'faq', title: 'Common questions' }
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
        <title>{`How ${appConfig.name} works`}</title>
        <meta
          name="description"
          content={`A plain-English guide to running a mess on ${appConfig.name}: meals, bazar, bills, dues, payments and closing a month.`}
        />
      </Head>

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Guide</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">How {appConfig.name} works</h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-600">
            Everything a mess needs to agree on — who ate what, who bought the groceries, who paid the rent, and who
            owes whom at the end of the month. This page explains all of it, in order.
          </p>

          {!user && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={ROUTES.auth.register}
                className="rounded-full bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-700"
              >
                Create an account
              </Link>
              <Link
                href={ROUTES.auth.login}
                className="rounded-full border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl gap-10 px-4 py-10 lg:flex lg:py-14">
        <nav aria-label="On this page" className="mb-8 lg:sticky lg:top-24 lg:mb-0 lg:h-fit lg:w-60 lg:shrink-0">
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">On this page</p>
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
          <Section id="overview" title="What this is">
            <P>
              A mess is a group of people who cook and eat together and split what it costs. The arguments always come
              from the same place: nobody can remember who ate how many meals, who paid for the chicken on the 9th, or
              whether last month&apos;s electricity was ever settled.
            </P>
            <P>
              {appConfig.name} keeps one shared record of all of it. Members log their own meals. Whoever does the
              shopping records the bazar. The supervisor records the bills and the cash people hand over. The maths is
              done for everybody, the same way, every month — and it always adds up to the paisa.
            </P>
          </Section>

          <Section id="roles" title="Who does what">
            <P>There are three kinds of account, and they see different things.</P>
            <Definitions
              items={[
                {
                  term: 'Member',
                  detail:
                    'Logs their own meals, records bazar they bought, comments on entries, and sees exactly what they owe. A member belongs to one mess at a time.'
                },
                {
                  term: 'Supervisor',
                  detail:
                    'Everything a member can do, plus: invites and removes people, records bills, takes payments, decides the cost types and how the meal rate is worked out, approves past-meal changes, and closes the month.'
                },
                {
                  term: 'Admin',
                  detail:
                    'Runs the site itself — approves registrations, manages roles, sets how long a past-meal unlock lasts, and can look at any mess.'
                }
              ]}
            />
            <Figure
              title="One admin, a supervisor per mess, members underneath"
              caption="A supervisor only ever controls their own mess. Nobody can see or change another mess's numbers."
            >
              <RolesFigure />
            </Figure>
          </Section>

          <Section id="month" title="A month in the mess">
            <P>
              Every month follows the same five beats. Nothing here needs a spreadsheet or a group chat argument — each
              step is a page in the app.
            </P>
            <Figure
              title="The rhythm of a month"
              caption="Meals and bazar go in as they happen. Bills and payments go in when they land. Closing at the end freezes the month and carries anything unpaid forward."
            >
              <MonthFlowFigure />
            </Figure>
          </Section>

          <Section id="joining" title="Getting in">
            <Steps
              items={[
                'Register with your name and email. Depending on how the site is set up, your account is either usable straight away or waits for an admin to approve it.',
                'A supervisor invites you to their mess. The invitation shows up in your notification bell and in your email.',
                'Accept it, and you are a member from that moment. Your joining date matters — it is what the app uses to work out how much of the month you were actually there for.',
                'Want to run your own mess instead? Ask for the supervisor role from your profile, then create a group.'
              ]}
            />
          </Section>

          <Section id="meals" title="Meals and meal plans">
            <P>
              Each member logs their own meals on the <Route href={ROUTES.meals}>Meals</Route> page: how many
              breakfasts, lunches and dinners they had on each day. Today and any upcoming day are always open to edit.
              Days that have already passed are locked — see <A href="#past-meals">changing a past meal</A>.
            </P>
            <P>
              If you eat roughly the same way every week, set a <strong>meal plan</strong> instead of typing the same
              numbers daily. Say &quot;lunch and dinner on weekdays, nothing on Fridays&quot; once, and the app fills
              your days in for you. You can always override any single day by hand.
            </P>
            <Callout>
              Not every meal costs the same to make. A supervisor can set <strong>meal weights</strong> — commonly
              breakfast 0.5, lunch 1, dinner 1 — so a light breakfast counts as half a meal when the cost is divided.
            </Callout>
          </Section>

          <Section id="quick-reply" title="Answering meals in one tap">
            <P>
              Nobody wants to open an app to say &quot;yes, I am eating tomorrow&quot;. So the mess asks you instead.
              Once a day you get a message with two buttons — <strong>Yes, count me in</strong> and{' '}
              <strong>No meals</strong>. Tap one from your phone and your meals for that day are recorded. There is no
              sign-in, no typing, and no app to open.
            </P>
            <P>
              Yes fills in <em>your</em> usual meals for that weekday, taken from your meal plan, so someone who never
              eats breakfast is never charged for one. Tap <strong>Choose meals</strong> instead if today is different
              from usual. Changed your mind? Tap again — the link keeps working until the day starts.
            </P>
            <Callout>
              The same question waits for you on the <Route href={ROUTES.dashboard}>Dashboard</Route> and in your
              notifications, so you can answer wherever you happen to be. Supervisors can send the ask to everyone from
              the <Route href={ROUTES.meals}>Meals</Route> page.
            </Callout>
          </Section>

          <Section id="community" title="The community room">
            <P>
              Your mess has its own <Route href={ROUTES.comments}>Comments</Route> thread. The{' '}
              <Route href={ROUTES.community}>Community</Route> room is the other one: everybody on {appConfig.name},
              in a single place. You are in it automatically from the moment your account is approved — there is
              nothing to join.
            </P>
            <P>
              Use it to ask a question no one mess can answer, to welcome the people who just signed up, and to catch
              the pinned <strong>What&apos;s new</strong> cards whenever a feature lands. Type{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">@</code> to pull someone into a message —
              they get a notification, exactly like in a mess thread.
            </P>
          </Section>

          <Section id="rate" title="How the meal rate works">
            <P>
              The meal rate is what one meal cost to put on the table. It comes only from <strong>bazar</strong> —
              groceries and cooking supplies. Rent and wifi are not part of it, because someone who ate nothing this
              month still lives in the flat.
            </P>
            <P>Supervisors choose between two ways of working it out.</P>
            <Definitions
              items={[
                {
                  term: 'One rate for the month',
                  detail:
                    'All the bazar for the month divided by all the meals eaten in the month. Simple to explain, and it evens out a cheap week against an expensive one.'
                },
                {
                  term: 'A rate for each day',
                  detail:
                    'Each day is priced on that day’s own bazar. Fairer when the mess eats very differently from day to day — a biryani Friday costs the people who were there for it, not the ones who were away.'
                }
              ]}
            />
            <Figure
              title="Two ways to price a meal"
              caption="Whichever mode you pick, every taka of bazar ends up charged to somebody. Bazar bought on a day nobody ate is spread across the month's meals rather than quietly disappearing."
            >
              <MealRateFigure />
            </Figure>
          </Section>

          <Section id="bazar" title="Bazar and comments">
            <P>
              Bazar is the daily shopping. Whoever went to the market records it on the{' '}
              <Route href={ROUTES.expenses}>Bazar</Route> page — the date, the items and what each cost, and who paid.
            </P>
            <P>
              Recording who paid is the important part. That person has put their own money in, so it is credited
              against what they owe. Buy ৳595 of groceries and your bill for the month drops by ৳595.
            </P>
            <P>
              Anyone in the mess can comment on a bazar entry to query a price or add context, and can mention someone
              with <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">@name</code> to pull them into it, or{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">@everyone</code> to notify the whole mess. The
              mentioned people get a notification. Every edit to an entry is kept in its history, so a changed amount is
              never silent.
            </P>
          </Section>

          <Section id="bills" title="Bills and fixed costs">
            <P>
              Bills are everything that is not day-to-day food: rent, electricity, water, waste, the cook, wifi, a gas
              cylinder. Supervisors record them on the <Route href={ROUTES.bills}>Bills</Route> page.
            </P>
            <P>
              The list of cost types belongs to the mess, not to the app. A supervisor can add whatever their house
              actually pays for and remove what it does not. A type already used by a real bill is hidden from the
              dropdown rather than deleted, so old bills keep the label they were filed under.
            </P>
            <P>A bill is split one of two ways:</P>
            <Definitions
              items={[
                { term: 'Split equally', detail: 'Divided evenly across everyone currently in the mess.' },
                {
                  term: 'Selected members',
                  detail:
                    'You choose who pays and how much. This is how you handle a shared room paying more rent, or a bill only some people are on.'
                }
              ]}
            />
            <Figure
              title="Splitting a bill"
              caption="The split is worked out once and saved with the bill. Somebody joining in the middle of the month never changes a bill that was already agreed."
            >
              <SplitFigure />
            </Figure>
          </Section>

          <Section id="balances" title="Balances and payments">
            <P>
              The <Route href={ROUTES.payments}>Payments</Route> page is where the month adds up. Every member gets one
              row, and the row reads left to right as a sentence: this is what you owe, this is what you have already
              put in, this is what is left.
            </P>
            <Figure
              title="One member's row"
              caption="Due = brought forward + meal share + bills share − groceries they bought − cash they paid. A negative due means the mess owes them money back."
            >
              <BalanceFigure />
            </Figure>
            <P>Four statuses can appear against a row:</P>
            <Definitions
              items={[
                { term: 'Settled', detail: 'Nothing owed either way.' },
                { term: 'Partly paid', detail: 'They have put something in, but not all of it.' },
                { term: 'Unpaid', detail: 'Nothing has come in yet.' },
                { term: 'Refund due', detail: 'They put in more than their share — the mess owes them.' }
              ]}
            />
            <Callout>
              The member column totals always tie back to what the mess actually spent. Meal shares add up to the bazar
              total, bill shares add up to the bills total — exactly, to the paisa. If they did not, the maths would be
              wrong, and there would be no way to tell whose row was short.
            </Callout>
          </Section>

          <Section id="past-meals" title="Changing a past meal">
            <P>
              Past days are locked by default, and for good reason: changing an old meal changes the rate for everyone,
              not just for you. But people do genuinely forget to log a day, so there is a way to fix it honestly.
            </P>
            <P>
              A member ticks <strong>Edit my past meals</strong> on the meals page. That unlocks past days for a short
              window — five minutes by default, though an admin can set anything from a few minutes to no limit at all.
              When the window runs out it locks itself again; you do not have to remember to close it.
            </P>
            <P>
              Anything you change in that window is a <strong>request</strong>, not a change. The meal table keeps its
              old numbers until your supervisor approves it. Approve or decline, either way you are told.
            </P>
            <P>
              When a <strong>supervisor</strong> edits a past day — theirs or anyone else&apos;s — it applies straight
              away, because they are the one accountable for the numbers. In exchange, every member of the mess is
              notified in the app and by email, saying exactly what changed and on which day.
            </P>
            <Figure
              title="Two routes, one principle"
              caption="Nobody's meal history changes without either an approval or an announcement. The rate can never move behind people's backs."
            >
              <MealEditFigure />
            </Figure>
          </Section>

          <Section id="closing" title="Closing a month">
            <P>
              When everyone has settled up, the supervisor <strong>closes</strong> the month. Closing snapshots every
              member&apos;s figures so a later edit to an old expense cannot quietly rewrite a month people have
              already paid on.
            </P>
            <P>
              Whatever is still unpaid does not vanish — it opens the next month as that person&apos;s{' '}
              <strong>brought forward</strong> balance, right at the front of their row. Supervisors can turn this off
              per mess if they would rather settle each month strictly on its own.
            </P>
            <P>
              A close can be dated any day of the month, and can cover the whole mess or just the people you pick. That
              is what makes a mid-month departure clean: settle the person leaving on the 12th, mark that they are
              going, and everybody else&apos;s month carries on untouched.
            </P>
            <Figure
              title="Closing and carrying forward"
              caption="A closed month can be reopened if something was genuinely wrong — everyone in the mess is told when that happens."
            >
              <ClosingFigure />
            </Figure>
          </Section>

          <Section id="faq" title="Common questions">
            <Definitions
              items={[
                {
                  term: 'I bought the groceries. Do I get that money back?',
                  detail:
                    'It is credited against what you owe, straight away. If it comes to more than your share, your due goes negative and shows as a refund the mess owes you.'
                },
                {
                  term: 'I was away for two weeks. Am I still charged?',
                  detail:
                    'Not for meals — you are only charged for meals you actually logged. Bills are a separate question: rent and wifi are usually split across everyone regardless, because the flat is still yours. Your supervisor can use a custom split if your mess agrees otherwise.'
                },
                {
                  term: 'Someone joined halfway through the month. Is that fair?',
                  detail:
                    'Their meal share only covers days they ate. Bills recorded before they joined keep the split they were saved with, so they are not charged for a bill that was already agreed without them.'
                },
                {
                  term: 'Can the supervisor change my meals without telling me?',
                  detail:
                    'No. Any change to a past day sends a notification to every member of the mess, in the app and by email, naming the day and what changed.'
                },
                {
                  term: 'Somebody left owing money. Where does it go?',
                  detail:
                    'Close the month for them on the day they leave. Their outstanding balance is frozen on the record with their name against it rather than being absorbed by everyone else.'
                },
                {
                  term: 'What happens to a mess that shuts down?',
                  detail:
                    'The supervisor closes the group. It disappears from the everyday group list and stops accepting new entries, but its history stays intact and can be brought back into view any time.'
                }
              ]}
            />
          </Section>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold">Still stuck?</h2>
            <p className="mt-2 text-slate-600">
              Your supervisor is the fastest route for anything about your own mess — meals, dues and bills are all
              theirs to fix. For account trouble, contact an admin.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={user ? ROUTES.dashboard : ROUTES.auth.register}
                className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                {user ? 'Back to dashboard' : 'Get started'}
              </Link>
              <Link
                href={ROUTES.home}
                className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Home
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
  return <p className="text-base leading-relaxed text-slate-600">{children}</p>;
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-relaxed text-slate-700">
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
          <dd className="mt-1 leading-relaxed text-slate-600">{item.detail}</dd>
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
          <span className="pt-0.5 leading-relaxed text-slate-600">{item}</span>
        </li>
      ))}
    </ol>
  );
}
