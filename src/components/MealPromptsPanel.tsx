import { useCallback, useEffect, useState } from 'react';
import { MealPromptCard, type MealCounts, type MealPromptState } from '@/components/MealPromptCard';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { api, errorMessage } from '@/lib/api-client';
import { type MealPromptAnswer } from '@/lib/constants';
import { strings } from '@/lib/i18n';

type PromptsResponse = { date: string; prompts: MealPromptState[] };

export function MealPromptsPanel() {
  const toast = useToast();
  const { user } = useCurrentUser();
  const [prompts, setPrompts] = useState<MealPromptState[]>([]);
  const [busyGroupId, setBusyGroupId] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.get<PromptsResponse>('/api/meal-prompts');
      setPrompts(data.prompts);
    } catch {
      setPrompts([]);
    } finally {
      setLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function answer(prompt: MealPromptState, choice: MealPromptAnswer, counts?: MealCounts) {
    setBusyGroupId(prompt.groupId);
    try {
      const data = await api.post<{ counts: MealCounts; summary: string }>('/api/meal-prompts', {
        groupId: prompt.groupId,
        date: prompt.date,
        answer: choice,
        counts
      });

      setPrompts((current) =>
        current.map((item) =>
          item.groupId === prompt.groupId ? { ...item, counts: data.counts, answer: choice } : item
        )
      );
      toast.success(strings.mealPrompt.saved);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyGroupId('');
    }
  }

  if (!loaded || prompts.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {prompts.map((prompt) => (
        <MealPromptCard
          key={`${prompt.groupId}-${prompt.date}`}
          prompt={prompt}
          compact
          busy={busyGroupId === prompt.groupId}
          onAnswer={(choice, counts) => answer(prompt, choice, counts)}
        />
      ))}
    </div>
  );
}

export default MealPromptsPanel;
