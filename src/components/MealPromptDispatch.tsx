import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { Button } from '@/components/ui';
import { api, errorMessage } from '@/lib/api-client';
import { strings } from '@/lib/i18n';

export function MealPromptDispatch({ groupId }: { groupId: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const data = await api.post<{ sent: number; message: string }>('/api/meal-prompts/dispatch', { groupId });
      toast.success(data.message);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{strings.mealPrompt.sendNow}</p>
        <p className="mt-0.5 text-sm text-slate-500">{strings.mealPrompt.notificationBody}</p>
      </div>
      <Button onClick={send} loading={busy}>
        {strings.mealPrompt.sendNow}
      </Button>
    </div>
  );
}

export default MealPromptDispatch;
