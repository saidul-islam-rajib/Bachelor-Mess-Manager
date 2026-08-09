import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { useInvitations } from '@/components/InvitationsProvider';
import InvitationCard from '@/components/InvitationCard';
import RoleRequestPanel from '@/components/RoleRequestPanel';
import { PasswordField } from '@/components/PasswordField';
import { TextField } from '@/components/TextField';
import { Badge, Collapsible, EmptyState, ImageViewer, PageTitle } from '@/components/ui';
import { strings } from '@/lib/i18n';
import { PASSWORD_MIN_LENGTH } from '@/lib/password.client';
import { validateName, validatePhone } from '@/lib/validation';
import { ACCEPTED_IMAGE_MIMES } from '@/lib/uploads.client';
import { formatBytes } from '@/lib/format';
import { uploadConfig } from '@/config';

const ACCEPTED_IMAGE_TYPES = ACCEPTED_IMAGE_MIMES;

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
    <section className="mx-auto max-w-content px-4 py-8 sm:py-10">
      <PageTitle title="Profile" />
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
                className="w-full rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-6 py-3 text-white hover:bg-brand-700 transition-all active:translate-y-px disabled:opacity-50 sm:w-auto"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          </div>

          <PastMealEditingSection />
          <PasswordSection />

          <RoleRequestPanel />
          <InvitationsSection />
        </div>
      )}
    </section>
  );
}

type EditWindowState = {
  open: boolean;
  unlimited: boolean;
  expiresAt: string | null;
  secondsRemaining: number | null;
  windowMinutes: number;
  requiresApproval: boolean;
};

function PastMealEditingSection() {
  const toast = useToast();
  const { user } = useCurrentUser();
  const [group, setGroup] = useState<{ id: string; name: string } | null>(null);
  const [state, setState] = useState<EditWindowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const groupsRes = await fetch('/api/groups');
        const groupsBody = await groupsRes.json().catch(() => ({}));
        const first = (groupsBody.groups ?? []).find(
          (candidate: { supervisor?: { id: string } }) => candidate.supervisor?.id !== user?.id
        );
        if (!first) {
          if (!cancelled) setLoading(false);
          return;
        }

        const windowRes = await fetch(`/api/groups/${first.id}/meal-edit-window`);
        const windowBody = await windowRes.json().catch(() => ({}));
        if (cancelled) return;

        setGroup({ id: first.id, name: first.name });
        if (windowRes.ok) setState(windowBody.window);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!state?.open || !state.expiresAt) return;

    const expiry = new Date(state.expiresAt).getTime();
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
      setState((prev) => (prev ? { ...prev, secondsRemaining: remaining, open: remaining > 0 } : prev));
      if (remaining <= 0) window.clearInterval(timer);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [state?.open, state?.expiresAt]);

  async function toggle(next: boolean) {
    if (!group) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/meal-edit-window`, { method: next ? 'POST' : 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not change the edit window.');
      setState(body.window);
      if (next) {
        toast.success(
          body.window?.unlimited
            ? 'Past meals unlocked.'
            : `Past meals unlocked for ${body.window?.windowMinutes ?? 5} minutes.`
        );
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !group || !state) return null;

  const remaining = state.secondsRemaining;
  const countdown =
    remaining === null ? null : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

  return (
    <div className={`rounded-3xl border p-6 shadow-sm sm:p-8 ${state.open ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">Editing past meals</h2>
        {state.open && (
          <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold tabular-nums text-amber-700 ring-1 ring-amber-300">
            {state.unlimited || !countdown ? 'No time limit' : `${countdown} left`}
          </span>
        )}
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={state.open}
          disabled={busy}
          onChange={(e) => toggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
        />
        <span>
          <span className="text-sm font-medium">Let me edit my past meals in {group.name}</span>
          <span className="mt-1 block text-sm text-slate-600">
            {state.unlimited
              ? 'Stays on until you turn it off.'
              : `Unlocks days that have already passed for ${state.windowMinutes} minutes, then locks itself again.`}
            {state.requiresApproval
              ? ' Anything you change goes to your supervisor for approval before it counts.'
              : ' Changes apply straight away and the whole mess is notified.'}
          </span>
        </span>
      </label>
    </div>
  );
}

function PhotoSection({ name, image, onChanged }: { name: string; image: string | null; onChanged: () => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [maxBytes, setMaxBytes] = useState(uploadConfig.maxImageBytes);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/settings')
      .then((res) => res.json())
      .then((body) => {
        const configured = Number(body?.settings?.maxProfileImageBytes);
        if (!cancelled && Number.isFinite(configured) && configured > 0) setMaxBytes(configured);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = '';
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error(strings.profile.imageWrongType);
      return;
    }
    if (file.size > maxBytes) {
      toast.error(strings.profile.imageTooLarge(formatBytes(maxBytes)));
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error(strings.profile.imageUnreadable));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? strings.profile.photoUploadFailed);

      toast.success(strings.profile.photoUpdated);
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
      if (!res.ok) throw new Error(data?.error ?? strings.profile.photoRemoveFailed);
      toast.success(strings.profile.photoRemoved);
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
        <ImageViewer src={image} alt={name} title="Profile photo">
          {(open) => (
            <button
              type="button"
              onClick={open}
              aria-label={strings.common.viewImage}
              title={strings.common.viewImage}
              className="group relative h-20 w-20 shrink-0 cursor-zoom-in overflow-hidden rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <img src={image} alt="" className="h-full w-full rounded-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                  <path d="M11 8v6M8 11h6" />
                </svg>
              </span>
            </button>
          )}
        </ImageViewer>
      ) : (
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-xl font-medium text-slate-600">
          {initials || '?'}
        </span>
      )}

      <div>
        <p className="text-sm font-medium text-slate-700">{strings.profile.photo}</p>
        <p className="text-xs text-slate-500">{strings.profile.photoHint(formatBytes(maxBytes))}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? strings.profile.working : image ? strings.profile.changePhoto : strings.profile.uploadPhoto}
          </button>
          {image && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-full border border-red-200 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {strings.profile.removePhoto}
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
    <Collapsible
      title="Change password"
      description="Changing your password signs you out everywhere else. This browser stays signed in."
    >
      <form className="space-y-5" onSubmit={submit} noValidate>
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
          className="w-full rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-6 py-3 text-white hover:bg-brand-700 transition-all active:translate-y-px disabled:opacity-50 sm:w-auto"
        >
          {saving ? 'Changing...' : 'Change password'}
        </button>
      </form>
    </Collapsible>
  );
}

function InvitationsSection() {
  const { invitations, count, loading } = useInvitations();
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched && count > 0) setOpen(true);
  }, [count, touched]);

  function toggle(next: boolean) {
    setTouched(true);
    setOpen(next);
  }

  return (
    <Collapsible
      title={strings.invitations.title}
      description={strings.invitations.subtitle}
      open={open}
      onOpenChange={toggle}
      badge={count > 0 ? <Badge tone="danger">{strings.invitations.pendingBadge(count)}</Badge> : null}
    >
      {loading ? (
        <p className="text-sm text-slate-400">{strings.common.loading}</p>
      ) : count === 0 ? (
        <EmptyState title={strings.invitations.none} description={strings.invitations.noneHint} />
      ) : (
        <ul className="space-y-3">
          {invitations.map((invitation) => (
            <li key={invitation.id}>
              <InvitationCard invitation={invitation} />
            </li>
          ))}
        </ul>
      )}
    </Collapsible>
  );
}
