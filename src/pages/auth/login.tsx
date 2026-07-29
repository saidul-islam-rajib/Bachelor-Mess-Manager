import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, type FormEvent } from 'react';
import { PasswordField } from '@/components/PasswordField';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { ROUTES } from '@/lib/routes';
import { STRINGS } from '@/lib/strings';
import { isValidEmail } from '@/lib/validation';

/** Only ever redirect to a path on this site — never to an attacker's URL. */
function safeNext(next: unknown): string | null {
  if (typeof next !== 'string') return null;
  if (!next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

export default function LoginPage() {
  const strings = STRINGS.auth.login;
  const router = useRouter();
  const toast = useToast();
  const { refresh } = useCurrentUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const nextErrors: typeof errors = {};
    if (!email.trim()) nextErrors.email = 'Email is required.';
    else if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address.';
    if (!password) nextErrors.password = 'Password is required.';

    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data?.error ?? 'Sign in failed. Please try again.';
        setFormError(message);
        setPassword('');
        return;
      }

      // Refresh the shared user context so the nav/role update without a reload.
      await refresh();
      toast.success(`Welcome back, ${data.user?.name ?? ''}`.trim() + '.');
      await router.push(safeNext(router.query.next) ?? ROUTES.dashboard);
    } catch {
      setFormError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-md px-4 py-12 sm:py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h1 className="text-2xl font-semibold">{strings.title}</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage your mess.</p>

          {formError && (
            <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
            <TextField
              label={strings.email}
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(value) => {
                setEmail(value);
                if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
              }}
              error={errors.email}
              autoFocus
            />

            <PasswordField
              label={strings.password}
              value={password}
              onChange={(value) => {
                setPassword(value);
                if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
              }}
              autoComplete="current-password"
              error={errors.password}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-slate-900 px-6 py-3 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Signing in...' : strings.submit}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            {strings.registerLink}{' '}
            <Link href={ROUTES.auth.register} className="font-medium text-slate-900 hover:underline">
              {strings.register}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
