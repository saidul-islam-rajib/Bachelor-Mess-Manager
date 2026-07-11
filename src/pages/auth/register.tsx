import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, type FormEvent } from 'react';
import { ROUTES } from '@/lib/routes';
import { STRINGS } from '@/lib/strings';
import { useToast } from '@/components/ToastProvider';

export default function RegisterPage() {
  const strings = STRINGS.auth.register;
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setLoading(false);
      toast.error(data?.error ?? 'Registration failed.');
      return;
    }

    // Account starts PENDING; send the user to a dedicated confirmation page.
    toast.success('Registration submitted.');
    router.push('/auth/registration-submitted');
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-md px-4 py-12 sm:py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h1 className="text-2xl font-semibold">{strings.title}</h1>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700">{strings.name}</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                type="text"
                required
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">{strings.email}</label>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">{strings.password}</label>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                required
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-slate-900 px-6 py-3 text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Creating account...' : strings.submit}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-600">
            {strings.loginLink}{' '}
            <Link href={ROUTES.auth.login} className="font-medium text-slate-900 hover:underline">
              {strings.login}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
