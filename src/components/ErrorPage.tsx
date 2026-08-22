import type { ReactNode } from 'react';
import { LinkButton, PageContainer, PageTitle } from '@/components/ui';
import { useCurrentUser } from '@/components/UserProvider';
import { ROUTES } from '@/lib/routes';
import { strings } from '@/lib/i18n';

export default function ErrorPage({
  code,
  title,
  body,
  action
}: {
  code: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  const { user } = useCurrentUser();
  const pageStrings = strings.errors.page;

  return (
    <PageContainer width="narrow">
      <PageTitle title={title} />
      <div className="mt-6 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center shadow-sm sm:mt-12 sm:p-12">
        <p className="text-6xl font-semibold tracking-tight text-brand-600 sm:text-7xl">{code}</p>
        <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-slate-600 dark:text-slate-400">{body}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {action}
          {user ? (
            <LinkButton href={ROUTES.dashboard} size="lg">
              {pageStrings.goDashboard}
            </LinkButton>
          ) : (
            <LinkButton href={ROUTES.home} size="lg">
              {pageStrings.goHome}
            </LinkButton>
          )}
          <LinkButton href={ROUTES.guide} variant="secondary" size="lg">
            {pageStrings.goGuide}
          </LinkButton>
        </div>
      </div>
    </PageContainer>
  );
}
