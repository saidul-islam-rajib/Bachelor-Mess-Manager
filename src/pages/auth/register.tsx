import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Input } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';
import { XssWarningModal } from '@/components/XssWarningModal';
import { ROUTES } from '@/lib/routes';
import { api, errorMessage } from '@/lib/api-client';
import { strings } from '@/lib/i18n';
import { isValidEmail, validateName, validatePhone } from '@/lib/validation';
import { findXssField } from '@/lib/xss';

type Errors = Partial<Record<'name' | 'email' | 'phone', string>>;

type RegisterResponse = {
  message: string;
  emailSent: boolean;
  setupLink?: string;
};

export default function RegisterPage() {
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<RegisterResponse | null>(null);
  const [xssField, setXssField] = useState<string | null>(null);

  function clearError(field: keyof Errors) {
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }

  function validate(): Errors {
    const next: Errors = {};

    const nameCheck = validateName(name);
    if (!nameCheck.ok) next.name = nameCheck.error;

    if (!email.trim()) next.email = strings.validation.emailRequired;
    else if (!isValidEmail(email)) next.email = strings.validation.emailInvalid;

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.ok) next.phone = phoneCheck.error;

    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const offendingField = findXssField({ name, email, phone });
    if (offendingField) {
      setXssField(offendingField);
      return;
    }

    const nextErrors = validate();
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const data = await api.post<RegisterResponse>('/api/auth/register', { name, email, phone });
      setDone(data);
      toast.success(strings.success.registrationSubmitted);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <section className="mx-auto max-w-md px-4 py-12 sm:py-16">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
            <h1 className="text-2xl font-semibold">{strings.auth.register.title}</h1>
            <Alert tone={done.emailSent ? 'success' : 'warning'} className="mt-6">
              {done.message}
            </Alert>

            {done.setupLink && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-medium text-amber-800">Development link</p>
                <Link href={done.setupLink} className="mt-1 block break-all text-xs text-amber-900 underline">
                  {done.setupLink}
                </Link>
              </div>
            )}

            <p className="mt-6 text-center text-sm text-slate-600">
              <Link href={ROUTES.auth.login} className="font-medium text-slate-900 hover:underline">
                {strings.auth.register.loginLink}
              </Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <XssWarningModal open={Boolean(xssField)} field={xssField} onClose={() => setXssField(null)} />
      <section className="mx-auto max-w-md px-4 py-12 sm:py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h1 className="text-2xl font-semibold">{strings.auth.register.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{strings.auth.checkEmail}</p>

          {formError && (
            <Alert tone="danger" className="mt-6">
              {formError}
            </Alert>
          )}

          <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
            <Input
              label={strings.auth.register.name}
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

            <Input
              label={strings.auth.register.email}
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

            <Input
              label={strings.auth.register.phone}
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder={strings.auth.register.phonePlaceholder}
              optional
              required={false}
              value={phone}
              onChange={(value) => {
                setPhone(value);
                clearError('phone');
              }}
              error={errors.phone}
            />

            <Button type="submit" loading={loading} fullWidth size="lg">
              {loading ? strings.auth.register.submitting : strings.auth.register.submit}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            {strings.auth.register.loginPrompt}{' '}
            <Link href={ROUTES.auth.login} className="font-medium text-slate-900 hover:underline">
              {strings.auth.register.loginLink}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
