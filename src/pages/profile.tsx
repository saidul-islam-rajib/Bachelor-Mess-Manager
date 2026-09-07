import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { ToLetComposer } from '@/components/community/ToLetComposer';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { useInvitations } from '@/components/InvitationsProvider';
import InvitationCard from '@/components/InvitationCard';
import RoleRequestPanel from '@/components/RoleRequestPanel';
import { ProfilePhotoCropModal } from '@/components/ProfilePhotoCropModal';
import { PasswordField } from '@/components/PasswordField';
import { TextField } from '@/components/TextField';
import { Badge, Button, Collapsible, EmptyState, ImageViewer, PageTitle, RadioGroup, StatusBadge, useConfirm } from '@/components/ui';
import MealPlanCard from '@/components/MealPlanCard';
import { SettlementHistoryList } from '@/components/SettlementHistory';
import { useTheme } from '@/components/ThemeProvider';
import { api, errorMessage } from '@/lib/api-client';
import type { SettlementHistoryEntry } from '@/lib/settlement-history';
import { strings } from '@/lib/i18n';
import { PASSWORD_MIN_LENGTH } from '@/lib/password.client';
import { validateName, validatePhone } from '@/lib/validation';
import { ACCEPTED_IMAGE_MIMES, evictCachedUpload } from '@/lib/uploads.client';
import { getExistingPushSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/push.client';
import { formatBytes, formatCurrency } from '@/lib/format';
import { uploadConfig } from '@/config';
import { PERMISSIONS } from '@/lib/permissions';
import { THEME_OPTIONS, TOLET_STATUS } from '@/lib/constants';
import { toLetListingPath } from '@/lib/routes';
import type { CommunityMessageView } from '@/lib/community';

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
      if (!res.ok) throw new Error(data?.error ?? strings.profile.updateFailed);
      toast.success(strings.profile.updated);
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
      <PageTitle title={strings.profile.title} />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">{strings.profile.title}</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">{strings.profile.subtitle}</p>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">{strings.common.loading}</div>
      ) : !user ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          {strings.profile.signInPrompt}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
            <h2 className="text-lg font-semibold dark:text-slate-100">{strings.profile.yourDetails}</h2>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-700">{user.email}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-700">{user.role}</span>
            </div>

            <PhotoSection name={user.name} image={user.profileImage ?? null} onChanged={refresh} />

            <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
              <TextField
                label={strings.common.name}
                value={name}
                onChange={(value) => {
                  setName(value);
                  setErrors((e) => ({ ...e, name: undefined }));
                }}
                autoComplete="name"
                error={errors.name}
              />
              <TextField
                label={strings.common.phone}
                type="tel"
                value={phone}
                onChange={(value) => {
                  setPhone(value);
                  setErrors((e) => ({ ...e, phone: undefined }));
                }}
                autoComplete="tel"
                placeholder={strings.auth.register.phonePlaceholder}
                optional
                required={false}
                error={errors.phone}
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-full bg-brand-600 shadow-sm shadow-brand-600/20 px-6 py-3 text-white hover:bg-brand-700 transition-all active:translate-y-px disabled:opacity-50 sm:w-auto"
              >
                {saving ? strings.common.saving : strings.common.saveChanges}
              </button>
            </form>
          </div>

          <ThemeSection />
          <PushNotificationsSection />
          <DefaultMealPlanSection />
          <PastMealEditingSection />
          <PasswordSection />

          <RoleRequestPanel />
          <SettlementHistorySection />
          <ToLetListingsSection />
          <InvitationsSection />
        </div>
      )}
    </section>
  );
}

function ToLetListingsSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useCurrentUser();
  const [listings, setListings] = useState<CommunityMessageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [repostTarget, setRepostTarget] = useState<CommunityMessageView | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ listings: CommunityMessageView[] }>('/api/community/messages/mine');
      setListings(data.listings);
    } catch {
      return;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmRepost(listing: CommunityMessageView) {
    const accepted = await confirm({
      title: strings.toLet.repostConfirmTitle,
      message: strings.toLet.repostConfirmBody,
      confirmLabel: strings.toLet.repostAction
    });
    if (!accepted) return;
    setRepostTarget(listing);
  }

  function onReposted() {
    setRepostTarget(null);
    setLoading(true);
    void load();
  }

  async function markExpired(listing: CommunityMessageView) {
    setBusyId(listing.id);
    try {
      await api.patch(`/api/community/messages/${listing.id}`, { markExpired: true });
      setListings((current) =>
        current.map((item) =>
          item.id === listing.id
            ? { ...item, listingStatus: TOLET_STATUS.EXPIRED, effectiveListingStatus: TOLET_STATUS.EXPIRED }
            : item
        )
      );
      toast.success(strings.toLet.markedExpired);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(listing: CommunityMessageView) {
    const accepted = await confirm({
      title: strings.toLet.deleteConfirmTitle,
      message: strings.toLet.deleteConfirmBody,
      confirmLabel: strings.common.delete,
      destructive: true
    });
    if (!accepted) return;

    setBusyId(listing.id);
    try {
      await api.delete(`/api/community/messages/${listing.id}`);
      setListings((current) => current.filter((item) => item.id !== listing.id));
      toast.success(strings.toLet.deleted);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Collapsible title={strings.toLet.profile.title} description={strings.toLet.profile.subtitle}>
      {loading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">{strings.common.loading}</p>
      ) : listings.length === 0 ? (
        <EmptyState title={strings.toLet.profile.empty} description={strings.toLet.profile.emptyHint} />
      ) : (
        <ul className="space-y-3">
          {listings.map((listing) => (
            <li key={listing.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 p-3 dark:border-slate-700">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700">
                {listing.images[0] && <img src={listing.images[0]} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={toLetListingPath(listing.id)}
                    className="truncate text-sm font-semibold text-slate-900 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-400"
                  >
                    {listing.title}
                  </Link>
                  <StatusBadge status={listing.effectiveListingStatus ?? TOLET_STATUS.EXPIRED} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {listing.rent !== null && strings.toLet.rentPerMonth(formatCurrency(listing.rent))} · {listing.location}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {listing.effectiveListingStatus === TOLET_STATUS.ACTIVE ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void markExpired(listing)}
                    disabled={busyId === listing.id}
                  >
                    {strings.toLet.markExpiredAction}
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => void confirmRepost(listing)} disabled={busyId === listing.id}>
                    {strings.toLet.repostAction}
                  </Button>
                )}
                <Button size="sm" variant="danger" onClick={() => void remove(listing)} disabled={busyId === listing.id}>
                  {strings.toLet.deleteAction}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ToLetComposer
        open={repostTarget !== null}
        onClose={() => setRepostTarget(null)}
        listing={null}
        prefillFrom={repostTarget}
        defaultContactName={user?.name ?? ''}
        defaultContactPhone={user?.phone ?? ''}
        onSaved={onReposted}
      />
    </Collapsible>
  );
}

function SettlementHistorySection() {
  const [items, setItems] = useState<SettlementHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api.get<{ submissions: SettlementHistoryEntry[] }>('/api/settlements/mine');
        if (!cancelled) setItems(data.submissions);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && !failed && items.length === 0) return null;

  return (
    <Collapsible
      title={strings.settlement.historyTitle}
      description={strings.settlement.historySubtitle}
      badge={!loading && !failed ? <Badge tone="neutral">{String(items.length)}</Badge> : null}
    >
      {loading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">{strings.common.loading}</p>
      ) : failed ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{strings.settlement.historyLoadFailed}</p>
      ) : (
        <SettlementHistoryList items={items} viewerIsSelf />
      )}
    </Collapsible>
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

type OwnGroup = { id: string; name: string };

function useOwnGroup(excludeSupervisorId?: string): { group: OwnGroup | null; loading: boolean } {
  const [group, setGroup] = useState<OwnGroup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/groups');
        const body = await res.json().catch(() => ({}));
        const groups: Array<{ id: string; name: string; supervisor?: { id: string } }> = body.groups ?? [];
        const match = excludeSupervisorId ? groups.find((g) => g.supervisor?.id !== excludeSupervisorId) : groups[0];
        if (!cancelled) setGroup(match ? { id: match.id, name: match.name } : null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [excludeSupervisorId]);

  return { group, loading };
}

const THEME_OPTIONS_LIST = [
  { value: THEME_OPTIONS.SYSTEM, label: strings.profile.themeSystem },
  { value: THEME_OPTIONS.LIGHT, label: strings.profile.themeLight },
  { value: THEME_OPTIONS.DARK, label: strings.profile.themeDark }
];

function ThemeSection() {
  const { user } = useCurrentUser();
  const { theme, setTheme } = useTheme();

  function handleChange(value: string) {
    setTheme(value as typeof theme);
    if (user) {
      void api.patch('/api/profile', { theme: value }).catch(() => undefined);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-5">
      <RadioGroup
        legend={strings.profile.appearance}
        value={theme}
        onChange={handleChange}
        options={THEME_OPTIONS_LIST}
        variant="pills"
      />
    </div>
  );
}

function PushNotificationsSection() {
  const toast = useToast();
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const supportsPush = isPushSupported();
      if (!cancelled) setSupported(supportsPush);
      if (!supportsPush) {
        if (!cancelled) setChecking(false);
        return;
      }

      try {
        const subscription = await getExistingPushSubscription();
        if (!cancelled) setEnabled(subscription !== null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      if (next) {
        await subscribeToPush();
        setEnabled(true);
        toast.success(strings.bazarReminder.alarmEnabled);
      } else {
        await unsubscribeFromPush();
        setEnabled(false);
        toast.success(strings.bazarReminder.alarmDisabled);
      }
    } catch (err) {
      const message = (err as Error).message;
      if (next && message === 'denied') {
        toast.error(strings.bazarReminder.alarmPermissionDenied);
      } else if (next) {
        toast.error(strings.bazarReminder.alarmSubscribeFailed);
      } else {
        toast.error(strings.bazarReminder.alarmUnsubscribeFailed);
      }
    } finally {
      setBusy(false);
    }
  }

  if (checking || !supported) return null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(e) => void toggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900"
        />
        <span>
          <span className="text-sm font-medium">{strings.bazarReminder.alarmTitle}</span>
          <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">
            {strings.bazarReminder.alarmDescription}
          </span>
        </span>
      </label>
    </div>
  );
}

function DefaultMealPlanSection() {
  const { can } = useCurrentUser();
  const { group, loading } = useOwnGroup();

  if (loading || !group || !can(PERMISSIONS.MEAL_PLAN_MANAGE)) return null;

  return <MealPlanCard groupId={group.id} groupName={group.name} onApplied={() => undefined} />;
}

function PastMealEditingSection() {
  const toast = useToast();
  const { user } = useCurrentUser();
  const { group, loading: groupLoading } = useOwnGroup(user?.id);
  const [state, setState] = useState<EditWindowState | null>(null);
  const [windowLoading, setWindowLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const loading = groupLoading || windowLoading;

  useEffect(() => {
    if (groupLoading) return;
    if (!group) {
      setWindowLoading(false);
      return;
    }

    let cancelled = false;
    setWindowLoading(true);
    const groupId = group.id;

    async function loadWindow() {
      try {
        const res = await fetch(`/api/groups/${groupId}/meal-edit-window`);
        const body = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setState(body.window);
      } finally {
        if (!cancelled) setWindowLoading(false);
      }
    }

    loadWindow();
    return () => {
      cancelled = true;
    };
  }, [group, groupLoading]);

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
      if (!res.ok) throw new Error(body?.error ?? strings.profile.editWindowFailed);
      setState(body.window);
      if (next) {
        toast.success(
          body.window?.unlimited
            ? strings.profile.pastMealsUnlocked
            : strings.profile.pastMealsUnlockedFor(body.window?.windowMinutes ?? 5)
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
    <div
      className={`rounded-3xl border p-6 shadow-sm sm:p-8 ${
        state.open
          ? 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold dark:text-slate-100">{strings.profile.editingPastMeals}</h2>
        {state.open && (
          <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold tabular-nums text-amber-700 ring-1 ring-amber-300 dark:bg-slate-800 dark:text-amber-400 dark:ring-amber-500/30">
            {state.unlimited || !countdown ? strings.profile.noTimeLimit : strings.profile.timeLeft(countdown)}
          </span>
        )}
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={state.open}
          disabled={busy}
          onChange={(e) => toggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900"
        />
        <span>
          <span className="text-sm font-medium">{strings.profile.letMeEdit(group.name)}</span>
          <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">
            {state.unlimited
              ? strings.profile.staysOnUntilOff
              : strings.profile.unlocksForMinutes(state.windowMinutes)}{' '}
            {state.requiresApproval
              ? strings.profile.requiresApprovalNote
              : strings.profile.appliesImmediatelyNote}
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);

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

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = '';
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error(strings.uploads.imageWrongType);
      return;
    }
    if (file.size > maxBytes) {
      toast.error(strings.uploads.imageTooLarge(formatBytes(maxBytes)));
      return;
    }

    setPendingFile(file);
  }

  async function saveCropped(dataUrl: string) {
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? strings.profile.photoUploadFailed);

      evictCachedUpload(image);
      toast.success(strings.profile.photoUpdated);
      onChanged();
      setPendingFile(null);
    } catch (err) {
      toast.error((err as Error).message);
      throw err;
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
      evictCachedUpload(image);
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
    <>
      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-6 dark:border-slate-700">
        {image ? (
          <ImageViewer src={image} alt={name}>
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
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-xl font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {initials || '?'}
          </span>
        )}

        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{strings.profile.photo}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{strings.profile.photoHint(formatBytes(maxBytes))}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {busy ? strings.profile.working : image ? strings.profile.changePhoto : strings.profile.uploadPhoto}
            </button>
            {image && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="rounded-full border border-red-200 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                {strings.profile.removePhoto}
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            onChange={selectFile}
            className="hidden"
          />
        </div>
      </div>

      <ProfilePhotoCropModal file={pendingFile} onCancel={() => setPendingFile(null)} onCropped={saveCropped} />
    </>
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
    if (!current) nextErrors.current = strings.profile.enterCurrentPassword;
    if (next.length < PASSWORD_MIN_LENGTH) {
      nextErrors.next = strings.validation.passwordTooShort(PASSWORD_MIN_LENGTH);
    }
    if (confirm !== next) nextErrors.confirm = strings.validation.passwordMismatch;

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
      if (!res.ok) throw new Error(data?.error ?? strings.profile.passwordChangeFailed);

      toast.success(strings.profile.passwordChanged);
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
      title={strings.profile.changePassword}
      description={strings.profile.changePasswordHint}
    >
      <form className="space-y-5" onSubmit={submit} noValidate>
        <PasswordField
          label={strings.profile.currentPassword}
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
          label={strings.profile.newPassword}
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
          label={strings.profile.confirmNewPassword}
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
          {saving ? strings.profile.changing : strings.profile.changePassword}
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
        <p className="text-sm text-slate-400 dark:text-slate-500">{strings.common.loading}</p>
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
