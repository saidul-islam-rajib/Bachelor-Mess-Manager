import { LinkButton, PageTitle } from '@/components/ui';
import { ROUTES } from '@/lib/routes';

const TITLE = 'Registration submitted';

export default function RegistrationSubmittedPage() {
  return (
    <div className="bg-slate-50 text-slate-900">
      <PageTitle title={TITLE} />
      <section className="mx-auto max-w-lg px-4 py-16 sm:py-24">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <div
            aria-hidden="true"
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700"
          >
            ✓
          </div>
          <h1 className="mt-6 text-2xl font-semibold">{TITLE}</h1>
          <p className="mt-3 text-slate-600">
            Your account has been created and is <span className="font-medium">awaiting admin approval</span>. You&apos;ll
            be able to sign in as soon as an admin reviews and approves it.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <LinkButton href={ROUTES.auth.login} size="lg">
              Go to login
            </LinkButton>
            <LinkButton href={ROUTES.home} variant="secondary" size="lg">
              Back to home
            </LinkButton>
          </div>
        </div>
      </section>
    </div>
  );
}
