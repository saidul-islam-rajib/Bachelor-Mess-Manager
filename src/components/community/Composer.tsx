import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { CommunityMessage } from '@/components/community/PostCard';
import { MentionInput, type Member } from '@/components/MentionInput';
import { useToast } from '@/components/ToastProvider';
import { Button, Modal } from '@/components/ui';
import { uploadConfig } from '@/config';
import { api, errorMessage } from '@/lib/api-client';
import { strings } from '@/lib/i18n';
import { encodeMentions } from '@/lib/mentions';
import { formatBytes } from '@/lib/format';
import { ACCEPTED_IMAGE_MIMES } from '@/lib/uploads.client';

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(strings.uploads.imageUnreadable));
    reader.readAsDataURL(file);
  });
}

export function Composer({
  open,
  onClose,
  members,
  maxLength,
  maxImagesPerPost,
  allowEveryone,
  onPosted
}: {
  open: boolean;
  onClose: () => void;
  members: Member[];
  maxLength: number;
  maxImagesPerPost: number;
  allowEveryone: boolean;
  onPosted: (message: CommunityMessage) => void;
}) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [maxImageBytes, setMaxImageBytes] = useState(uploadConfig.maxImageBytes);
  const [posting, setPosting] = useState(false);

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

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const room = maxImagesPerPost - images.length;
    if (room <= 0) {
      toast.error(strings.community.tooManyImages(maxImagesPerPost));
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
      toast.error(strings.community.tooManyImages(maxImagesPerPost));
    }

    try {
      const dataUrls = await Promise.all(accepted.map(readAsDataUrl));
      setImages((current) => [...current, ...dataUrls]);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  function removeImage(index: number) {
    setImages((current) => current.filter((_, i) => i !== index));
  }

  async function post() {
    const value = text.trim();
    if ((!value && images.length === 0) || posting) return;

    setPosting(true);
    try {
      const data = await api.post<{ message: CommunityMessage }>('/api/community/messages', {
        text: encodeMentions(value, members),
        images
      });
      onPosted(data.message);
      setText('');
      setImages([]);
      toast.success(strings.community.posted);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPosting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={strings.community.composerTitle}
      size="lg"
      footer={
        <Button onClick={() => void post()} disabled={!text.trim() && images.length === 0} loading={posting}>
          {strings.community.post}
        </Button>
      }
    >
      <MentionInput
        value={text}
        onChange={setText}
        members={members}
        rows={4}
        maxLength={maxLength}
        allowEveryone={allowEveryone}
        hint={allowEveryone ? strings.comments.mentionHint : strings.community.mentionHint}
        placeholder={strings.community.placeholder}
        onSubmit={() => void post()}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_IMAGE_MIMES.join(',')}
          multiple
          className="hidden"
          onChange={addFiles}
        />

        {images.map((src, index) => (
          <div key={src} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200">
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(index)}
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

        {images.length < maxImagesPerPost && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label={strings.community.addPhotos}
            title={strings.community.addPhotos}
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-brand-400 hover:text-brand-500"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </div>
    </Modal>
  );
}

export default Composer;
