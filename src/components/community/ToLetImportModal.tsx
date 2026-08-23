import { useState } from 'react';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import { strings } from '@/lib/i18n';
import { parseToLetImportText } from '@/lib/tolet-import-parser';
import type { ToLetFormState } from '@/components/community/useToLetForm';

export function ToLetImportModal({
  open,
  onClose,
  onParsed
}: {
  open: boolean;
  onClose: () => void;
  onParsed: (result: Partial<ToLetFormState>) => void;
}) {
  const [text, setText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [error, setError] = useState('');

  function reset() {
    setText('');
    setSourceUrl('');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleParse() {
    if (!text.trim()) {
      setError(strings.toLet.import.textRequired);
      return;
    }
    onParsed({ ...parseToLetImportText(text), sourceUrl: sourceUrl.trim() });
    reset();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={strings.toLet.import.title}
      size="md"
      footer={<Button onClick={handleParse}>{strings.toLet.import.parseAction}</Button>}
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">{strings.toLet.import.hint}</p>
        <Textarea
          label={strings.toLet.import.textareaLabel}
          value={text}
          onChange={(value) => {
            setText(value);
            if (error) setError('');
          }}
          placeholder={strings.toLet.import.placeholder}
          rows={10}
          error={error}
        />
        <Input
          label={strings.toLet.import.sourceUrlLabel}
          value={sourceUrl}
          onChange={setSourceUrl}
          hint={strings.toLet.import.sourceUrlHint}
        />
      </div>
    </Modal>
  );
}

export default ToLetImportModal;
