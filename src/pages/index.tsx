import Link from 'next/link';
import { ROUTES } from '@/lib/routes';
import { STRINGS } from '@/lib/strings';
import { useCurrentUser } from '@/components/UserProvider';

export default function Home() {
  const { user, loading } = useCurrentUser();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h1 className="text-2xl font-semibold sm:text-3xl">{STRINGS.home.title}</h1>
          <p className="mt-4 text-slate-600">{STRINGS.home.description}</p>

          {loading ? null : user ? (
            <div className="mt-8">
              <p className="text-slate-600">
                You&apos;re signed in as <span className="font-medium">{user.name}</span> ({user.role}).
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={ROUTES.dashboard}
                  className="rounded-full bg-slate-900 px-6 py-3 text-center text-white hover:bg-slate-700"
                >
                  Go to dashboard
                </Link>
                <Link
                  href={ROUTES.groups}
                  className="rounded-full border border-slate-300 px-6 py-3 text-center text-slate-900 hover:bg-slate-50"
                >
                  View groups
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link href={ROUTES.auth.login} className="rounded-full bg-slate-900 px-6 py-3 text-center text-white hover:bg-slate-700">
                {STRINGS.home.login}
              </Link>
              <Link
                href={ROUTES.auth.register}
                className="rounded-full border border-slate-300 px-6 py-3 text-center text-slate-900 hover:bg-slate-50"
              >
                {STRINGS.home.register}
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
