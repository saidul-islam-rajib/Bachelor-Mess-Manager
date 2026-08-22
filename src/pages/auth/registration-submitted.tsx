import { LinkButton, PageTitle } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { strings } from '@/lib/i18n';

const TITLE = strings.auth.submitted.title;

export default function RegistrationSubmittedPage() {
  return (
    <div className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <PageTitle title={TITLE} />
      <section className="mx-auto max-w-lg px-4 py-16 sm:py-24">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center shadow-sm sm:p-12">
          <div
            aria-hidden="true"
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15 text-3xl text-green-700 dark:text-green-400"
          >
            ✓
          </div>
          <h1 className="mt-6 text-2xl font-semibold">{TITLE}</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            {strings.auth.submitted.bodyPre} <span className="font-medium">{strings.auth.submitted.awaitingApproval}</span>.{' '}
            {strings.auth.submitted.bodyPost}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <LinkButton href={ROUTES.auth.login} size="lg">
              {strings.auth.submitted.goToLogin}
            </LinkButton>
            <LinkButton href={ROUTES.home} variant="secondary" size="lg">
              {strings.auth.submitted.backToHome}
            </LinkButton>
          </div>
        </div>
      </section>
    </div>
  );
}
