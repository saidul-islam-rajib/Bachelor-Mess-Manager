import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Button, Input, Modal, NumberInput, RadioGroup, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';
import { toLetConfig, uploadConfig } from '@/config';
import { api, errorMessage } from '@/lib/api-client';
import { strings } from '@/lib/i18n';
import {
  TOLET_GENDER_PREFERENCE,
  TOLET_GENDER_PREFERENCE_VALUES,
  TOLET_MONTHS,
  TOLET_TENANT_RESTRICTION,
  TOLET_TYPE_VALUES
} from '@/lib/constants';
import { formatBytes } from '@/lib/format';
import { ACCEPTED_IMAGE_MIMES } from '@/lib/uploads.client';
import type { CommunityMessageView } from '@/lib/community';

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(strings.uploads.imageUnreadable));
    reader.readAsDataURL(file);
  });
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4 border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

type FormState = {
  listingType: string;
  title: string;
  text: string;
  rent: string;
  rentNegotiable: boolean;
  location: string;
  latitude: number | null;
  longitude: number | null;
  genderPreference: string;
  tenantRestriction: string;
  availableMonth: string;
  contactName: string;
  contactPhone: string;
  expiryDays: number;
  images: string[];
};

function emptyForm(defaultContactName: string, defaultContactPhone: string): FormState {
  return {
    listingType: TOLET_TYPE_VALUES[0],
    title: '',
    text: '',
    rent: '',
    rentNegotiable: false,
    location: '',
    latitude: null,
    longitude: null,
    genderPreference: TOLET_GENDER_PREFERENCE.ANY,
    tenantRestriction: TOLET_TENANT_RESTRICTION.ANY,
    availableMonth: '',
    contactName: defaultContactName,
    contactPhone: defaultContactPhone,
    expiryDays: toLetConfig.defaultExpiryDays,
    images: []
  };
}

function formFromSource(source: CommunityMessageView, defaultContactName: string, defaultContactPhone: string): FormState {
  return {
    listingType: source.listingType ?? TOLET_TYPE_VALUES[0],
    title: source.title ?? '',
    text: source.text,
    rent: source.rent !== null ? String(source.rent) : '',
    rentNegotiable: source.rentNegotiable,
    location: source.location ?? '',
    latitude: source.latitude,
    longitude: source.longitude,
    genderPreference: source.genderPreference ?? TOLET_GENDER_PREFERENCE.ANY,
    tenantRestriction: source.tenantRestriction ?? TOLET_TENANT_RESTRICTION.ANY,
    availableMonth: source.availableMonth ?? '',
    contactName: source.contactName ?? defaultContactName,
    contactPhone: source.contactPhone ?? defaultContactPhone,
    expiryDays: toLetConfig.defaultExpiryDays,
    images: source.images
  };
}

export function ToLetComposer({
  open,
  onClose,
  listing,
  prefillFrom,
  defaultContactName,
  defaultContactPhone,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  listing?: CommunityMessageView | null;
  prefillFrom?: CommunityMessageView | null;
  defaultContactName: string;
  defaultContactPhone: string;
  onSaved: (listing: CommunityMessageView) => void;
}) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultContactName, defaultContactPhone));
  const [maxImageBytes, setMaxImageBytes] = useState(uploadConfig.maxImageBytes);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const editing = Boolean(listing);
  const reposting = !editing && Boolean(prefillFrom);
  const source = listing ?? prefillFrom ?? null;

  useEffect(() => {
    if (!open) return;

    setForm(
      source
        ? formFromSource(source, defaultContactName, defaultContactPhone)
        : emptyForm(defaultContactName, defaultContactPhone)
    );
  }, [open, source, defaultContactName, defaultContactPhone]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/settings')
      .then((res) => res.json())
      .then((body) => {
        const configured = Number(body?.settings?.maxProfileImageBytes);
        if (!cancelled && Number.isFinite(configured) && configured > 0) setMaxImageBytes(configured);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function shareLocation() {
    if (typeof window === 'undefined' || !window.isSecureContext) {
      toast.error(strings.toLet.location.insecureContext);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error(strings.toLet.location.unsupported);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setForm((current) => ({ ...current, latitude, longitude }));

        api
          .get<{ label: string | null }>('/api/community/messages/reverse-geocode', { query: { lat: latitude, lng: longitude } })
          .then((data) => {
            if (data.label) update('location', data.label);
          })
          .catch(() => undefined)
          .finally(() => setLocating(false));
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) toast.error(strings.toLet.location.permissionDenied);
        else if (error.code === error.POSITION_UNAVAILABLE) toast.error(strings.toLet.location.unavailable);
        else if (error.code === error.TIMEOUT) toast.error(strings.toLet.location.timedOut);
        else toast.error(strings.toLet.location.shareFailed);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function clearSharedLocation() {
    setForm((current) => ({ ...current, latitude: null, longitude: null }));
  }

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const room = toLetConfig.maxImagesPerListing - form.images.length;
    if (room <= 0) {
      toast.error(strings.toLet.tooManyPhotos(toLetConfig.maxImagesPerListing));
      return;
    }

    const accepted: File[] = [];
    for (const file of files.slice(0, room)) {
      if (!ACCEPTED_IMAGE_MIMES.includes(file.type)) {
        toast.error(strings.uploads.imageWrongType);
        continue;
      }
      if (file.size > maxImageBytes) {
        toast.error(strings.uploads.imageTooLarge(formatBytes(maxImageBytes)));
        continue;
      }
      accepted.push(file);
    }
    if (files.length > room) {
      toast.error(strings.toLet.tooManyPhotos(toLetConfig.maxImagesPerListing));
    }

    try {
      const dataUrls = await Promise.all(accepted.map(readAsDataUrl));
      update('images', [...form.images, ...dataUrls]);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  function removeImage(index: number) {
    update(
      'images',
      form.images.filter((_, i) => i !== index)
    );
  }

  async function submit() {
    if (saving) return;
    if (!form.title.trim() || !form.text.trim() || !form.location.trim() || !form.rent.trim()) return;

    setSaving(true);
    try {
      const payload = {
        listingType: form.listingType,
        title: form.title.trim(),
        text: form.text.trim(),
        rent: Number(form.rent),
        rentNegotiable: form.rentNegotiable,
        location: form.location.trim(),
        latitude: form.latitude,
        longitude: form.longitude,
        genderPreference: form.genderPreference,
        tenantRestriction: form.tenantRestriction,
        availableMonth: form.availableMonth || null,
        contactName: form.contactName.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        expiryDays: form.expiryDays,
        images: form.images
      };

      const data =
        editing && listing
          ? await api.patch<{ message: CommunityMessageView }>(`/api/community/messages/${listing.id}`, payload)
          : reposting && prefillFrom
            ? await api.post<{ message: CommunityMessageView }>(`/api/community/messages/${prefillFrom.id}/repost`, payload)
            : await api.post<{ message: CommunityMessageView }>('/api/community/messages', payload);

      onSaved(data.message);
      toast.success(editing ? strings.toLet.updated : reposting ? strings.toLet.reposted : strings.toLet.created);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const typeOptions = TOLET_TYPE_VALUES.map((type) => ({
    value: type,
    label: strings.toLet.types[type as keyof typeof strings.toLet.types]
  }));
  const genderOptions = TOLET_GENDER_PREFERENCE_VALUES.map((pref) => ({
    value: pref,
    label: strings.toLet.genderPreference[pref as keyof typeof strings.toLet.genderPreference]
  }));
  const currentMonthIndex = new Date().getMonth();
  const upcomingMonths = [0, 1, 2].map((offset) => TOLET_MONTHS[(currentMonthIndex + offset) % 12]);
  const selectableMonths =
    form.availableMonth && !upcomingMonths.includes(form.availableMonth as (typeof TOLET_MONTHS)[number])
      ? [form.availableMonth as (typeof TOLET_MONTHS)[number], ...upcomingMonths]
      : upcomingMonths;
  const monthOptions = [
    { value: '', label: strings.toLet.composer.availableNowOption },
    ...selectableMonths.map((month) => ({ value: month, label: strings.toLet.months[month] }))
  ];
  const expiryOptions = toLetConfig.expiryOptionsDays.map((days) => ({
    value: String(days),
    label: strings.toLet.composer.expiryOption(days)
  }));

  const canSubmit = Boolean(form.title.trim() && form.text.trim() && form.location.trim() && form.rent.trim());
  const hasSharedLocation = form.latitude !== null && form.longitude !== null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        editing
          ? strings.toLet.composer.editTitle
          : reposting
            ? strings.toLet.composer.repostTitle
            : strings.toLet.composer.createTitle
      }
      size="lg"
      footer={
        <Button onClick={() => void submit()} disabled={!canSubmit} loading={saving}>
          {saving
            ? strings.toLet.composer.submitting
            : editing
              ? strings.toLet.composer.submitEdit
              : reposting
                ? strings.toLet.composer.submitRepost
                : strings.toLet.composer.submitCreate}
        </Button>
      }
    >
      <div className="space-y-5">
        <Section title={strings.toLet.composer.sectionListing}>
          <RadioGroup
            legend={strings.toLet.composer.typeLabel}
            value={form.listingType}
            onChange={(value) => update('listingType', value)}
            options={typeOptions}
            variant="pills"
          />

          <Input
            label={strings.toLet.composer.titleLabel}
            value={form.title}
            onChange={(value) => update('title', value)}
            placeholder={strings.toLet.composer.titlePlaceholder}
            maxLength={toLetConfig.maxTitleLength}
          />

          <Textarea
            label={strings.toLet.composer.descriptionLabel}
            value={form.text}
            onChange={(value) => update('text', value)}
            placeholder={strings.toLet.composer.descriptionPlaceholder}
            rows={4}
            maxLength={toLetConfig.maxDescriptionLength}
          />
        </Section>

        <Section title={strings.toLet.composer.sectionPricing}>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberInput
              label={strings.toLet.composer.rentLabel}
              value={form.rent}
              onChange={(value) => update('rent', value)}
              min={0}
            />
            <Select
              label={strings.toLet.composer.availableMonthLabel}
              value={form.availableMonth}
              onChange={(value) => update('availableMonth', value)}
              options={monthOptions}
              compact
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.rentNegotiable}
              onChange={(event) => update('rentNegotiable', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            {strings.toLet.composer.negotiableLabel}
          </label>

          <RadioGroup
            legend={strings.toLet.composer.expiryLabel}
            value={String(form.expiryDays)}
            onChange={(value) => update('expiryDays', Number(value))}
            options={expiryOptions}
            variant="pills"
          />
        </Section>

        <Section title={strings.toLet.composer.sectionLocation}>
          <Input
            label={strings.toLet.composer.locationLabel}
            value={form.location}
            onChange={(value) => update('location', value)}
            placeholder={strings.toLet.composer.locationPlaceholder}
            maxLength={toLetConfig.maxLocationLength}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={shareLocation}
              disabled={locating}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              {locating ? strings.toLet.location.sharing : strings.toLet.location.shareAction}
            </button>

            {hasSharedLocation && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                📍 {strings.toLet.location.shared}
                <button
                  type="button"
                  onClick={clearSharedLocation}
                  className="text-emerald-600 hover:text-emerald-900"
                  aria-label={strings.toLet.location.clearAction}
                  title={strings.toLet.location.clearAction}
                >
                  &times;
                </button>
              </span>
            )}
          </div>
        </Section>

        <Section title={strings.toLet.composer.sectionWhoFor}>
          <Select
            label={strings.toLet.composer.genderPreferenceLabel}
            value={form.genderPreference}
            onChange={(value) => update('genderPreference', value)}
            options={genderOptions}
            compact
          />

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.tenantRestriction === TOLET_TENANT_RESTRICTION.FAMILY}
              onChange={(event) =>
                update('tenantRestriction', event.target.checked ? TOLET_TENANT_RESTRICTION.FAMILY : TOLET_TENANT_RESTRICTION.ANY)
              }
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            {strings.toLet.composer.familyOnlyLabel}
          </label>
        </Section>

        <Section title={strings.toLet.composer.sectionContact}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={strings.toLet.composer.contactNameLabel}
              value={form.contactName}
              onChange={(value) => update('contactName', value)}
              hint={strings.toLet.composer.contactNameHint}
            />
            <Input
              type="tel"
              label={strings.toLet.composer.contactPhoneLabel}
              value={form.contactPhone}
              onChange={(value) => update('contactPhone', value)}
              hint={strings.toLet.composer.contactPhoneHint}
            />
          </div>
        </Section>

        <Section title={strings.toLet.composer.sectionPhotos}>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_IMAGE_MIMES.join(',')}
              multiple
              className="hidden"
              onChange={addFiles}
            />

            {form.images.map((src, index) => (
              <div
                key={src}
                className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200"
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  aria-label={strings.community.imageRemove}
                  title={strings.community.imageRemove}
                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white transition-colors hover:bg-red-600"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            {form.images.length < toLetConfig.maxImagesPerListing && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                aria-label={strings.community.addPhotos}
                title={strings.community.addPhotos}
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-brand-400 hover:text-brand-500"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">{strings.toLet.composer.photosHint(toLetConfig.maxImagesPerListing)}</p>
        </Section>
      </div>
    </Modal>
  );
}

export default ToLetComposer;
