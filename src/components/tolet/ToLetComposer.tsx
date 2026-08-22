import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button, Input, Modal, NumberInput, RadioGroup, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';
import { toLetConfig, uploadConfig } from '@/config';
import { api, errorMessage } from '@/lib/api-client';
import { strings } from '@/lib/i18n';
import { TOLET_GENDER_PREFERENCE, TOLET_GENDER_PREFERENCE_VALUES, TOLET_TYPE_VALUES } from '@/lib/constants';
import { formatBytes } from '@/lib/format';
import { ACCEPTED_IMAGE_MIMES } from '@/lib/uploads.client';
import type { ToLetListingView } from '@/lib/tolet';

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(strings.uploads.imageUnreadable));
    reader.readAsDataURL(file);
  });
}

type FormState = {
  type: string;
  title: string;
  description: string;
  rent: string;
  rentNegotiable: boolean;
  location: string;
  genderPreference: string;
  availableFrom: string;
  contactName: string;
  contactPhone: string;
  expiryDays: number;
  images: string[];
};

function emptyForm(defaultContactName: string, defaultContactPhone: string): FormState {
  return {
    type: TOLET_TYPE_VALUES[0],
    title: '',
    description: '',
    rent: '',
    rentNegotiable: false,
    location: '',
    genderPreference: TOLET_GENDER_PREFERENCE.ANY,
    availableFrom: '',
    contactName: defaultContactName,
    contactPhone: defaultContactPhone,
    expiryDays: toLetConfig.defaultExpiryDays,
    images: []
  };
}

export function ToLetComposer({
  open,
  onClose,
  listing,
  defaultContactName,
  defaultContactPhone,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  listing?: ToLetListingView | null;
  defaultContactName: string;
  defaultContactPhone: string;
  onSaved: (listing: ToLetListingView) => void;
}) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultContactName, defaultContactPhone));
  const [maxImageBytes, setMaxImageBytes] = useState(uploadConfig.maxImageBytes);
  const [saving, setSaving] = useState(false);

  const editing = Boolean(listing);

  useEffect(() => {
    if (!open) return;

    setForm(
      listing
        ? {
            type: listing.type,
            title: listing.title,
            description: listing.description,
            rent: String(listing.rent),
            rentNegotiable: listing.rentNegotiable,
            location: listing.location,
            genderPreference: listing.genderPreference,
            availableFrom: listing.availableFrom ? listing.availableFrom.slice(0, 10) : '',
            contactName: listing.contactName ?? defaultContactName,
            contactPhone: listing.contactPhone ?? defaultContactPhone,
            expiryDays: toLetConfig.defaultExpiryDays,
            images: listing.images
          }
        : emptyForm(defaultContactName, defaultContactPhone)
    );
  }, [open, listing, defaultContactName, defaultContactPhone]);

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
    if (!form.title.trim() || !form.description.trim() || !form.location.trim() || !form.rent.trim()) return;

    setSaving(true);
    try {
      const payload = {
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim(),
        rent: Number(form.rent),
        rentNegotiable: form.rentNegotiable,
        location: form.location.trim(),
        genderPreference: form.genderPreference,
        availableFrom: form.availableFrom || null,
        contactName: form.contactName.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        expiryDays: form.expiryDays,
        images: form.images
      };

      const data =
        editing && listing
          ? await api.patch<{ listing: ToLetListingView }>(`/api/tolet/${listing.id}`, payload)
          : await api.post<{ listing: ToLetListingView }>('/api/tolet', payload);

      onSaved(data.listing);
      toast.success(editing ? strings.toLet.updated : strings.toLet.created);
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
  const expiryOptions = toLetConfig.expiryOptionsDays.map((days) => ({
    value: String(days),
    label: strings.toLet.composer.expiryOption(days)
  }));

  const canSubmit = Boolean(form.title.trim() && form.description.trim() && form.location.trim() && form.rent.trim());

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? strings.toLet.composer.editTitle : strings.toLet.composer.createTitle}
      size="lg"
      footer={
        <Button onClick={() => void submit()} disabled={!canSubmit} loading={saving}>
          {saving
            ? strings.toLet.composer.submitting
            : editing
              ? strings.toLet.composer.submitEdit
              : strings.toLet.composer.submitCreate}
        </Button>
      }
    >
      <div className="space-y-5">
        <RadioGroup
          legend={strings.toLet.composer.typeLabel}
          value={form.type}
          onChange={(value) => update('type', value)}
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
          value={form.description}
          onChange={(value) => update('description', value)}
          placeholder={strings.toLet.composer.descriptionPlaceholder}
          rows={4}
          maxLength={toLetConfig.maxDescriptionLength}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberInput
            label={strings.toLet.composer.rentLabel}
            value={form.rent}
            onChange={(value) => update('rent', value)}
            min={0}
          />
          <Select
            label={strings.toLet.composer.genderPreferenceLabel}
            value={form.genderPreference}
            onChange={(value) => update('genderPreference', value)}
            options={genderOptions}
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

        <Input
          label={strings.toLet.composer.locationLabel}
          value={form.location}
          onChange={(value) => update('location', value)}
          placeholder={strings.toLet.composer.locationPlaceholder}
          maxLength={toLetConfig.maxLocationLength}
        />

        <Input
          type="date"
          label={strings.toLet.composer.availableFromLabel}
          value={form.availableFrom}
          onChange={(value) => update('availableFrom', value)}
          hint={strings.toLet.composer.availableFromHint}
          optional
        />

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

        <RadioGroup
          legend={strings.toLet.composer.expiryLabel}
          value={String(form.expiryDays)}
          onChange={(value) => update('expiryDays', Number(value))}
          options={expiryOptions}
          variant="pills"
        />

        <div>
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
        </div>
      </div>
    </Modal>
  );
}

export default ToLetComposer;
