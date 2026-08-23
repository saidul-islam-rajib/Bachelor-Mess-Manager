import { Button } from '@/components/ui';
import { toLetConfig } from '@/config';
import { strings } from '@/lib/i18n';
import { ACCEPTED_IMAGE_MIMES } from '@/lib/uploads.client';
import type { ToLetFormApi } from '@/components/community/useToLetForm';

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
