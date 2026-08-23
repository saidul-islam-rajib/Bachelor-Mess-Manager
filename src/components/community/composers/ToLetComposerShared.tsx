import { Button, Input } from '@/components/ui';
import { toLetConfig } from '@/config';
import { strings } from '@/lib/i18n';
import { ACCEPTED_IMAGE_MIMES } from '@/lib/uploads.client';
import type { ToLetFormApi } from '@/components/community/useToLetForm';

export function ToLetLocationField({ form }: { form: ToLetFormApi }) {
  return (
    <div className="relative">
      <Input
        label={strings.toLet.composer.locationLabel}
        value={form.form.location}
        onChange={form.updateLocation}
        placeholder={strings.toLet.composer.locationPlaceholder}
        maxLength={toLetConfig.maxLocationLength}
        autoComplete="off"
      />

      {(form.searchingLocation || form.locationSuggestions.length > 0) && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm shadow-lg">
          {form.searchingLocation && (
            <li className="px-3.5 py-2 text-slate-400 dark:text-slate-500">{strings.toLet.location.searching}</li>
          )}
          {!form.searchingLocation &&
            form.locationSuggestions.map((suggestion) => (
              <li key={`${suggestion.lat},${suggestion.lng}`}>
                <button
                  type="button"
                  onClick={() => form.selectLocationSuggestion(suggestion)}
                  className="block w-full truncate px-3.5 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  {suggestion.label}
                </button>
              </li>
            ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={form.shareLocation}
          disabled={form.locating}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          {form.locating ? strings.toLet.location.sharing : strings.toLet.location.shareAction}
        </button>

        {form.hasSharedLocation && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            📍 {strings.toLet.location.shared}
            <button
              type="button"
              onClick={form.clearSharedLocation}
              className="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200"
              aria-label={strings.toLet.location.clearAction}
              title={strings.toLet.location.clearAction}
            >
              &times;
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

export function ToLetContactFields({ form }: { form: ToLetFormApi }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={strings.toLet.composer.contactNameLabel}
          value={form.form.contactName}
          onChange={(value) => form.update('contactName', value)}
          hint={strings.toLet.composer.contactNameHint}
        />
        <Input
          type="tel"
          label={strings.toLet.composer.contactPhoneLabel}
          value={form.form.contactPhone}
          onChange={(value) => form.update('contactPhone', value)}
          hint={strings.toLet.composer.contactPhoneHint}
        />
      </div>

      <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={form.form.whatsappSameAsPhone}
          onChange={(event) => form.update('whatsappSameAsPhone', event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
        />
        {strings.toLet.composer.whatsappSameLabel}
      </label>

      {!form.form.whatsappSameAsPhone && (
        <Input
          type="tel"
          label={strings.toLet.composer.whatsappLabel}
          value={form.form.contactWhatsapp}
          onChange={(value) => form.update('contactWhatsapp', value)}
          hint={strings.toLet.composer.whatsappHint}
        />
      )}

      <Input
        label={strings.toLet.composer.facebookLinkLabel}
        value={form.form.contactFacebook}
        onChange={(value) => form.update('contactFacebook', value)}
        hint={strings.toLet.composer.facebookLinkHint}
      />

      {form.form.hasContact2 ? (
        <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-600 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {strings.toLet.composer.contact2Title}
            </span>
            <button
              type="button"
              onClick={form.removeContact2}
              className="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400"
            >
              {strings.toLet.composer.removeContactAction}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={strings.toLet.composer.contactNameLabel}
              value={form.form.contact2Name}
              onChange={(value) => form.update('contact2Name', value)}
            />
            <Input
              type="tel"
              label={strings.toLet.composer.contactPhoneLabel}
              value={form.form.contact2Phone}
              onChange={(value) => form.update('contact2Phone', value)}
            />
          </div>

          <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={form.form.contact2WhatsappSameAsPhone}
              onChange={(event) => form.update('contact2WhatsappSameAsPhone', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
            />
            {strings.toLet.composer.whatsappSameLabel}
          </label>

          {!form.form.contact2WhatsappSameAsPhone && (
            <Input
              type="tel"
              label={strings.toLet.composer.whatsappLabel}
              value={form.form.contact2Whatsapp}
              onChange={(value) => form.update('contact2Whatsapp', value)}
            />
          )}

          <Input
            label={strings.toLet.composer.facebookLinkLabel}
            value={form.form.contact2Facebook}
            onChange={(value) => form.update('contact2Facebook', value)}
            hint={strings.toLet.composer.facebookLinkHint}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={form.addContact2}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {strings.toLet.composer.addContactAction}
        </button>
      )}

      <Input
        label={strings.toLet.composer.sourceUrlLabel}
        value={form.form.sourceUrl}
        onChange={(value) => form.update('sourceUrl', value)}
        hint={strings.toLet.composer.sourceUrlHint}
      />
    </div>
  );
}

export function ToLetPhotoPicker({ form }: { form: ToLetFormApi }) {
  return (
    <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {strings.toLet.composer.sectionPhotos}
      </h3>
      <div className="flex flex-wrap gap-2">
        <input
          ref={form.fileInput}
          type="file"
          accept={ACCEPTED_IMAGE_MIMES.join(',')}
          multiple
          className="hidden"
          onChange={form.addFiles}
        />

        {form.form.images.map((src, index) => (
          <div
            key={src}
            className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
          >
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => form.removeImage(index)}
              aria-label={strings.community.imageRemove}
              title={strings.community.imageRemove}
              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white transition-colors hover:bg-red-600"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {form.form.images.length < toLetConfig.maxImagesPerListing && (
          <button
            type="button"
            onClick={() => form.fileInput.current?.click()}
            aria-label={strings.community.addPhotos}
            title={strings.community.addPhotos}
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-500"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{strings.toLet.composer.photosHint(toLetConfig.maxImagesPerListing)}</p>
    </div>
  );
}

export function ToLetComposerFooter({ form }: { form: ToLetFormApi }) {
  return (
    <Button onClick={() => void form.submit()} disabled={!form.canSubmit} loading={form.saving}>
      {form.saving
        ? strings.toLet.composer.submitting
        : form.editing
          ? strings.toLet.composer.submitEdit
          : form.reposting
            ? strings.toLet.composer.submitRepost
            : strings.toLet.composer.submitCreate}
    </Button>
  );
}
