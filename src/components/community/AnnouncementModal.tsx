import { useState } from 'react';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';
import { api, errorMessage } from '@/lib/api-client';
import { communityConfig } from '@/config';
import { COMMUNITY_MESSAGE_TYPES } from '@/lib/constants';
import { strings } from '@/lib/i18n';
import type { CommunityMessage } from '@/components/community/PostCard';

export function AnnouncementModal({
  open,
  onClose,
  onPosted
}: {
  open: boolean;
  onClose: () => void;
  onPosted: (message: CommunityMessage) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle('');
    setText('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function submit() {
    if (saving || !title.trim() || !text.trim()) return;

    setSaving(true);
    try {
      const data = await api.post<{ message: CommunityMessage }>('/api/community/messages', {
        type: COMMUNITY_MESSAGE_TYPES.ANNOUNCEMENT,
        title: title.trim(),
        text: text.trim()
      });
      onPosted(data.message);
      toast.success(strings.community.announcement.posted);
      reset();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = Boolean(title.trim() && text.trim());

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={strings.community.announcement.modalTitle}
      size="md"
      footer={
        <Button onClick={() => void submit()} disabled={!canSubmit} loading={saving}>
          {saving ? strings.community.announcement.submitting : strings.community.announcement.submitAction}
        </Button>
      }
    >
      <div className="space-y-4">
        <Input
          label={strings.community.announcement.titleLabel}
          value={title}
          onChange={setTitle}
          placeholder={strings.community.announcement.titlePlaceholder}
          maxLength={communityConfig.maxAnnouncementTitleLength}
        />
        <Textarea
          label={strings.community.announcement.bodyLabel}
          value={text}
          onChange={setText}
          placeholder={strings.community.announcement.bodyPlaceholder}
          rows={5}
          maxLength={communityConfig.maxMessageLength}
        />
      </div>
    </Modal>
  );
}

export default AnnouncementModal;
