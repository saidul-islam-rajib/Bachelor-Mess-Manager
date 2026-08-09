import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { TextField } from '@/components/TextField';
import { XssWarningModal } from '@/components/XssWarningModal';
import { Alert, Button, PageTitle } from '@/components/ui';
import { api, errorMessage } from '@/lib/api-client';
import { strings } from '@/lib/i18n';
import { ROUTES } from '@/lib/routes';
import { isValidEmail } from '@/lib/validation';
import { findXssField } from '@/lib/xss';

type SentState = { email: string; link: string | null; mailConfigured: boolean };

export default function ForgotPasswordPage() {
  const copy = strings.auth.forgotPassword;

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<SentState | null>(null);
  const [xssField, setXssField] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const offendingField = findXssField({ email });
    if (offendingField) {
      setXssField(offendingField);
      return;
    }

    if (!email.trim()) {
      setFieldError(strings.validation.emailRequired);
      return;
    }
    if (!isValidEmail(email)) {
      setFieldError(strings.validation.emailInvalid);
      return;
    }

    setFieldError('');
    setFormError('');
    setLoading(true);

    try {
      const data = await api.post<{ link: string | null; mailConfigured: boolean }>('/api/auth/forgot-password', {
        email
      });
      setSent({ email: email.trim(), link: data.link ?? null, mailConfigured: data.mailConfigured });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-slate-50 text-slate-900">
      <PageTitle title={copy.title} />
      <XssWarningModal open={Boolean(xssField)} field={xssField} onClose={() => setXssField(null)} />
      <section className="mx-auto max-w-md px-4 py-12 sm:py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          {sent ? (
            <>
              <h1 className="text-2xl font-semibold">{copy.sentTitle}</h1>
              <p className="mt-2 text-sm text-slate-600">{copy.sentBody(sent.email)}</p>
              <p className="mt-3 text-xs text-slate-500">{copy.sentHint}</p>

              {sent.link && (
                <Alert tone="warning" className="mt-5">
                  <span className="block">{copy.devLinkNotice}</span>
                  <a href={sent.link} className="mt-2 block break-all font-medium text-brand-700 underline">
                    {sent.link}
                  </a>
                </Alert>
              )}

              <Button
                variant="secondary"
                fullWidth
                size="lg"
                className="mt-6"
                onClick={() => {
                  setSent(null);
                  setEmail('');
                }}
              >
                {copy.resend}
              </Button>

              <p className="mt-6 text-center text-sm">
                <Link href={ROUTES.auth.login} className="font-medium text-brand-700 hover:underline">
                  {copy.backToLogin}
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold">{copy.title}</h1>
              <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>

              {formError && (
                <Alert tone="danger" className="mt-6">
                  {formError}
                </Alert>
              )}

              <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
                <TextField
                  label={copy.email}
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(value) => {
                    setEmail(value);
                    if (fieldError) setFieldError('');
                  }}
                  error={fieldError}
                  autoFocus
                />

                <Button type="submit" size="lg" fullWidth loading={loading}>
                  {loading ? copy.submitting : copy.submit}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm">
                <Link href={ROUTES.auth.login} className="font-medium text-brand-700 hover:underline">
                  {copy.backToLogin}
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
