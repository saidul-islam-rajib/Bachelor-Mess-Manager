import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, type FormEvent } from 'react';
import { AuthShell } from '@/components/auth/AuthShell';
import { PasswordField } from '@/components/PasswordField';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { XssWarningModal } from '@/components/XssWarningModal';
import { Button, PageTitle } from '@/components/ui';
import { strings as i18n } from '@/lib/i18n';
import { ROUTES, safeNextPath } from '@/lib/routes';
import { STRINGS } from '@/lib/strings';
import { isValidEmail } from '@/lib/validation';
import { findXssField } from '@/lib/xss';

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
  const [xssField, setXssField] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const offendingField = findXssField({ email, password });
    if (offendingField) {
      setXssField(offendingField);
      return;
    }

    const nextErrors: typeof errors = {};
    if (!email.trim()) nextErrors.email = i18n.validation.emailRequired;
    else if (!isValidEmail(email)) nextErrors.email = i18n.validation.emailInvalid;
    if (!password) nextErrors.password = i18n.validation.passwordRequired;

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
        const message = data?.error ?? i18n.auth.login.signInFailed;
        setFormError(message);
        setPassword('');
        return;
      }

      await refresh();
      toast.success(i18n.success.welcomeBack(data.user?.name ?? ''));
      await router.push(safeNextPath(router.query.next) ?? ROUTES.dashboard);
    } catch {
      setFormError(i18n.errors.network);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <PageTitle title={strings.title} />
      <XssWarningModal open={Boolean(xssField)} field={xssField} onClose={() => setXssField(null)} />

      <h1 className="text-2xl font-semibold sm:text-3xl">{strings.title}</h1>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{i18n.auth.login.subtitle}</p>

      {formError && (
        <div role="alert" className="mt-6 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
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

        <div className="-mt-2 text-right">
          <Link
            href={ROUTES.auth.forgotPassword}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            {i18n.auth.login.forgotLink}
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={loading}>
          {loading ? i18n.auth.login.submitting : strings.submit}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        {strings.registerLink}{' '}
        <Link href={ROUTES.auth.register} className="font-medium text-brand-700 hover:underline">
          {strings.register}
        </Link>
      </p>
    </AuthShell>
  );
}
