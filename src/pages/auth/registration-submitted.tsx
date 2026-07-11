import Link from 'next/link';
import { ROUTES } from '@/lib/routes';

export default function RegistrationSubmittedPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-lg px-4 py-16 sm:py-24">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
            ✓
          </div>
          <h1 className="mt-6 text-2xl font-semibold">Registration submitted</h1>
          <p className="mt-3 text-slate-600">
            Your account has been created and is <span className="font-medium">awaiting admin approval</span>. You&apos;ll
            be able to sign in as soon as an admin reviews and approves it.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={ROUTES.auth.login}
              className="rounded-full bg-slate-900 px-6 py-3 text-white hover:bg-slate-700"
            >
              Go to login
            </Link>
            <Link
              href={ROUTES.home}
              className="rounded-full border border-slate-300 px-6 py-3 text-slate-900 hover:bg-slate-50"
            >
              Back to home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
