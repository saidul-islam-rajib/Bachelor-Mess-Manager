import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { useInvitations } from '@/components/InvitationsProvider';
import InvitationCard from '@/components/InvitationCard';
import RoleRequestPanel from '@/components/RoleRequestPanel';
import { PasswordField } from '@/components/PasswordField';
import { TextField } from '@/components/TextField';
import { PASSWORD_MIN_LENGTH } from '@/lib/password.client';
import { validateName, validatePhone } from '@/lib/validation';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export default function ProfilePage() {
  const toast = useToast();
  const { user, loading, refresh } = useCurrentUser();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone ?? '');
    }
  }, [user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nameCheck = validateName(name);
    const phoneCheck = validatePhone(phone);
    const nextErrors = {
      name: nameCheck.ok ? undefined : nameCheck.error,
      phone: phoneCheck.ok ? undefined : phoneCheck.error
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.phone) return;

    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not update profile.');
      toast.success('Profile updated.');
      if (data.user?.phone !== undefined) setPhone(data.user.phone ?? '');
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Profile</h1>
        <p className="mt-1 text-slate-600">Your details and anything waiting for you.</p>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">Loading...</div>
      ) : !user ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
          Please sign in to view your profile.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold">Your details</h2>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">{user.email}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{user.role}</span>
            </div>

            <PhotoSection name={user.name} image={user.profileImage ?? null} onChanged={refresh} />

            <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
              <TextField
                label="Name"
                value={name}
                onChange={(value) => {
                  setName(value);
                  setErrors((e) => ({ ...e, name: undefined }));
                }}
                autoComplete="name"
                error={errors.name}
              />
              <TextField
                label="Phone"
                type="tel"
                value={phone}
                onChange={(value) => {
                  setPhone(value);
                  setErrors((e) => ({ ...e, phone: undefined }));
                }}
                autoComplete="tel"
                placeholder="+8801XXXXXXXXX"
                optional
                required={false}
                error={errors.phone}
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-full bg-slate-900 px-6 py-3 text-white hover:bg-slate-700 disabled:opacity-50 sm:w-auto"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          </div>

          <PasswordSection />

          <RoleRequestPanel />
          <InvitationsSection />
        </div>
      )}
    </section>
  );
}

function PhotoSection({ name, image, onChanged }: { name: string; image: string | null; onChanged: () => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = '';
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Choose a PNG, JPEG, WebP, or GIF image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('That image is larger than 2 MB. Please pick a smaller one.');
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read that file.'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not upload that image.');

      toast.success('Photo updated.');
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeImage: true })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not remove the photo.');
      toast.success('Photo removed.');
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-6">
      {image ? (

        <img src={image} alt="" className="h-20 w-20 rounded-full object-cover" />
      ) : (
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-xl font-medium text-slate-600">
          {initials || '?'}
        </span>
      )}

      <div>
        <p className="text-sm font-medium text-slate-700">Profile photo</p>
        <p className="text-xs text-slate-500">PNG, JPEG, WebP, or GIF. Up to 2 MB.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? 'Working...' : image ? 'Change photo' : 'Upload photo'}
          </button>
          {image && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-full border border-red-200 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          onChange={upload}
          className="hidden"
        />
      </div>
    </div>
  );
}

function PasswordSection() {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: typeof errors = {};
    if (!current) nextErrors.current = 'Enter your current password.';
    if (next.length < PASSWORD_MIN_LENGTH) {
      nextErrors.next = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    }
    if (confirm !== next) nextErrors.confirm = 'Passwords do not match.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, password: next })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not change your password.');

      toast.success('Password changed. Other devices have been signed out.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-semibold">Change password</h2>
      <p className="mt-1 text-sm text-slate-500">
        Changing your password signs you out everywhere else. This browser stays signed in.
      </p>

      <form className="mt-6 space-y-5" onSubmit={submit} noValidate>
        <PasswordField
          label="Current password"
          name="current-password"
          value={current}
          onChange={(value) => {
            setCurrent(value);
            setErrors((e) => ({ ...e, current: undefined }));
          }}
          autoComplete="current-password"
          error={errors.current}
        />
        <PasswordField
          label="New password"
          name="new-password"
          value={next}
          onChange={(value) => {
            setNext(value);
            setErrors((e) => ({ ...e, next: undefined }));
          }}
          autoComplete="new-password"
          showStrength
          error={errors.next}
        />
        <PasswordField
          label="Confirm new password"
          name="confirm-password"
          value={confirm}
          onChange={(value) => {
            setConfirm(value);
            setErrors((e) => ({ ...e, confirm: undefined }));
          }}
          autoComplete="new-password"
          error={errors.confirm}
        />
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-slate-900 px-6 py-3 text-white hover:bg-slate-700 disabled:opacity-50 sm:w-auto"
        >
          {saving ? 'Changing...' : 'Change password'}
        </button>
      </form>
    </div>
  );
}

function InvitationsSection() {
  const { invitations, count, loading } = useInvitations();
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched && count > 0) setOpen(true);
  }, [count, touched]);

  function toggle() {
    setTouched(true);
    setOpen((v) => !v);
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">Invitations</span>
              {count > 0 && (
                <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 ring-1 ring-inset ring-red-600/20">
                  {count} pending
                </span>
              )}
            </span>
            <span className="mt-1 block text-sm font-normal text-slate-500">
              Messes that have invited you to join.
            </span>
          </span>
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 text-lg leading-none text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            {open ? '−' : '+'}
          </span>
        </button>
      </h2>

      {open && (
        <div className="mt-5 border-t border-slate-100 pt-5">
          {loading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : count === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-600">No pending invitations</p>
              <p className="mt-1 text-xs text-slate-400">
                When a supervisor invites you to a mess, it shows up here and in the bell at the top.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {invitations.map((invitation) => (
                <li key={invitation.id}>
                  <InvitationCard invitation={invitation} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
