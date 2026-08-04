import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, LoadingCard, PasswordInput } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { ROUTES } from '@/lib/routes';
import { api, errorMessage } from '@/lib/api-client';
import { strings } from '@/lib/i18n';
import { PASSWORD_MIN_LENGTH } from '@/lib/password.client';

type TokenCheck = { valid: true; name: string; email: string } | { valid: false; error: string };

export default function SetPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const { refresh } = useCurrentUser();

  const token = Array.isArray(router.query.token) ? router.query.token[0] : router.query.token;

  const [check, setCheck] = useState<TokenCheck | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const verify = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.get<{ name: string; email: string }>('/api/auth/set-password', {
        query: { token }
      });
      setCheck({ valid: true, name: data.name, email: data.email });
    } catch (error) {
      setCheck({ valid: false, error: errorMessage(error) });
    }
  }, [token]);

  useEffect(() => {
    if (router.isReady) verify();
  }, [router.isReady, verify]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const nextErrors: typeof errors = {};
    if (!password) nextErrors.password = strings.validation.passwordRequired;
    else if (password.length < PASSWORD_MIN_LENGTH) {
      nextErrors.password = strings.validation.passwordTooShort(PASSWORD_MIN_LENGTH);
    }
    if (confirm !== password) nextErrors.confirm = strings.validation.passwordMismatch;

    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const data = await api.post<{ signedIn: boolean; message: string }>('/api/auth/set-password', {
        token,
        password
      });

      toast.success(data.message);

      if (data.signedIn) {
        await refresh();
        await router.push(ROUTES.dashboard);
      } else {
        await router.push('/auth/registration-submitted');
      }
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-md px-4 py-12 sm:py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          {!router.isReady || (token && !check) ? (
            <LoadingCard label={strings.auth.setPassword.checking} />
          ) : !token || (check && !check.valid) ? (
            <>
              <h1 className="text-2xl font-semibold">{strings.auth.setPassword.invalidTitle}</h1>
              <Alert tone="danger" className="mt-6">
                {check && !check.valid ? check.error : strings.validation.required('Token')}
              </Alert>
              <p className="mt-6 text-center text-sm">
                <Link href={ROUTES.auth.login} className="font-medium text-brand-700 hover:underline">
                  {strings.auth.setPassword.requestNew}
                </Link>
              </p>
            </>
          ) : check && check.valid ? (
            <>
              <h1 className="text-2xl font-semibold">{strings.auth.setPassword.title}</h1>
              <p className="mt-1 text-sm text-slate-500">{strings.auth.setPassword.subtitle(check.name)}</p>
              <p className="mt-1 text-xs text-slate-400">{check.email}</p>

              {formError && (
                <Alert tone="danger" className="mt-6">
                  {formError}
                </Alert>
              )}

              <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
                <PasswordInput
                  label={strings.auth.register.password}
                  value={password}
                  onChange={(value) => {
                    setPassword(value);
                    setErrors((current) => ({ ...current, password: undefined }));
                  }}
                  autoComplete="new-password"
                  showStrength
                  error={errors.password}
                  hint={strings.validation.passwordHint(PASSWORD_MIN_LENGTH)}
                  autoFocus
                />

                <PasswordInput
                  label={strings.auth.register.confirmPassword}
                  name="confirm-password"
                  value={confirm}
                  onChange={(value) => {
                    setConfirm(value);
                    setErrors((current) => ({ ...current, confirm: undefined }));
                  }}
                  autoComplete="new-password"
                  error={errors.confirm}
                />

                <Button type="submit" loading={saving} fullWidth size="lg">
                  {saving ? strings.auth.setPassword.submitting : strings.auth.setPassword.submit}
                </Button>
              </form>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
