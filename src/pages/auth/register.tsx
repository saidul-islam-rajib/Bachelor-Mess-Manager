import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, type FormEvent } from 'react';
import { PasswordField } from '@/components/PasswordField';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { ROUTES } from '@/lib/routes';
import { STRINGS } from '@/lib/strings';
import { PASSWORD_MIN_LENGTH } from '@/lib/password.client';
import { isValidEmail, validateName, validatePhone } from '@/lib/validation';

type Errors = Partial<Record<'name' | 'email' | 'phone' | 'password' | 'confirm', string>>;

export default function RegisterPage() {
  const strings = STRINGS.auth.register;
  const router = useRouter();
  const toast = useToast();
  const { refresh } = useCurrentUser();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  function clearError(field: keyof Errors) {
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }

  // Mirrors the server's rules so mistakes surface before a round trip; the
  // server still re-validates everything, because a client can be bypassed.
  function validate(): Errors {
    const next: Errors = {};

    const nameCheck = validateName(name);
    if (!nameCheck.ok) next.name = nameCheck.error;

    if (!email.trim()) next.email = 'Email is required.';
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address.';

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.ok) next.phone = phoneCheck.error;

    if (!password) next.password = 'Password is required.';
    else if (password.length < PASSWORD_MIN_LENGTH) {
      next.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    }

    if (confirm !== password) next.confirm = 'Passwords do not match.';

    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFormError(data?.error ?? 'Registration failed. Please try again.');
        return;
      }

      // The first account on a fresh database is made admin and signed straight in.
      if (data.signedIn) {
        await refresh();
        toast.success(data.message ?? 'Welcome!');
        await router.push(ROUTES.dashboard);
        return;
      }

      toast.success('Registration submitted.');
      await router.push('/auth/registration-submitted');
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
          <p className="mt-1 text-sm text-slate-500">
            Create your account. An admin approves it before you can sign in.
          </p>

          {formError && (
            <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
            <TextField
              label={strings.name}
              name="name"
              autoComplete="name"
              value={name}
              onChange={(value) => {
                setName(value);
                clearError('name');
              }}
              error={errors.name}
              autoFocus
            />

            <TextField
              label={strings.email}
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(value) => {
                setEmail(value);
                clearError('email');
              }}
              error={errors.email}
            />

            <TextField
              label="Phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+8801XXXXXXXXX"
              optional
              required={false}
              value={phone}
              onChange={(value) => {
                setPhone(value);
                clearError('phone');
              }}
              error={errors.phone}
            />

            <PasswordField
              label={strings.password}
              value={password}
              onChange={(value) => {
                setPassword(value);
                clearError('password');
              }}
              autoComplete="new-password"
              showStrength
              error={errors.password}
              hint={`At least ${PASSWORD_MIN_LENGTH} characters. A short phrase you'll remember beats a cryptic one.`}
            />

            <PasswordField
              label="Confirm password"
              name="confirm-password"
              value={confirm}
              onChange={(value) => {
                setConfirm(value);
                clearError('confirm');
              }}
              autoComplete="new-password"
              error={errors.confirm}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-slate-900 px-6 py-3 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
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
