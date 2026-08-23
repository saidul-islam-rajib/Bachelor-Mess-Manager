import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui';
import { strings } from '@/lib/i18n';
import { TOLET_POST_LAYOUTS } from '@/lib/constants';
import { useToLetPostLayout } from '@/lib/useToLetPostLayout';
import { useToLetForm } from '@/components/community/useToLetForm';
import { SignboardComposer } from '@/components/community/composers/SignboardComposer';
import { WalkthroughComposer, WalkthroughFooter } from '@/components/community/composers/WalkthroughComposer';
import { ToLetComposerFooter } from '@/components/community/composers/ToLetComposerShared';
import type { CommunityMessageView } from '@/lib/community';
import type { ToLetFormState } from '@/components/community/useToLetForm';

export function ToLetComposer({
  open,
  onClose,
  listing,
  prefillFrom,
  importedFields,
  defaultContactName,
  defaultContactPhone,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  listing?: CommunityMessageView | null;
  prefillFrom?: CommunityMessageView | null;
  importedFields?: Partial<ToLetFormState> | null;
  defaultContactName: string;
  defaultContactPhone: string;
  onSaved: (listing: CommunityMessageView) => void;
}) {
  const layout = useToLetPostLayout();
  const [step, setStep] = useState(1);
  const form = useToLetForm({ open, listing, prefillFrom, importedFields, defaultContactName, defaultContactPhone, onSaved, onClose });

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  const title = form.editing
    ? strings.toLet.composer.editTitle
    : form.reposting
      ? strings.toLet.composer.repostTitle
      : strings.toLet.composer.createTitle;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        layout === TOLET_POST_LAYOUTS.WALKTHROUGH ? (
          <WalkthroughFooter form={form} step={step} onStepChange={setStep} />
        ) : (
          <ToLetComposerFooter form={form} />
        )
      }
    >
      {layout === TOLET_POST_LAYOUTS.WALKTHROUGH ? (
        <WalkthroughComposer form={form} step={step} />
      ) : (
        <SignboardComposer form={form} />
      )}
    </Modal>
  );
}

export default ToLetComposer;
