import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { MealPromptCard, type MealCounts, type MealPromptState } from '@/components/MealPromptCard';
import { Alert, Card, LoadingCard, PageContainer, PageHeader } from '@/components/ui';
import { api, errorMessage } from '@/lib/api-client';
import { MEAL_PROMPT_ANSWER_VALUES, type MealPromptAnswer } from '@/lib/constants';
import { strings } from '@/lib/i18n';
import { ROUTES } from '@/lib/routes';

type PromptResponse = { prompt: MealPromptState & { expired: boolean } };

export default function MealReplyPage() {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const requested = typeof router.query.answer === 'string' ? router.query.answer.toUpperCase() : '';

  const [prompt, setPrompt] = useState<(MealPromptState & { expired: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const autoAnswered = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.get<PromptResponse>(`/api/meal-prompts/${encodeURIComponent(token)}`);
      setPrompt(data.prompt);
      setError('');
    } catch (caught) {
      setError(errorMessage(caught, strings.mealPrompt.invalidLink));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const answer = useCallback(
    async (choice: MealPromptAnswer, counts?: MealCounts) => {
      if (!token) return;
      setBusy(true);
      try {
        const data = await api.post<{ summary: string; prompt: MealPromptState & { expired: boolean } }>(
          `/api/meal-prompts/${encodeURIComponent(token)}`,
          { answer: choice, counts }
        );
        setPrompt(data.prompt);
        setSaved(strings.mealPrompt.savedDetail(data.summary));
        setError('');
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setBusy(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (autoAnswered.current || loading || !prompt || prompt.expired) return;
    if (!MEAL_PROMPT_ANSWER_VALUES.includes(requested)) return;

    autoAnswered.current = true;
    answer(requested as MealPromptAnswer);
  }, [answer, loading, prompt, requested]);

  return (
    <PageContainer>
      <PageHeader title={strings.mealPrompt.title} />

      {loading ? (
        <LoadingCard />
      ) : error && !prompt ? (
        <Card>
          <Alert tone="warning">{error}</Alert>
          <Link href={ROUTES.meals} className="mt-4 inline-block text-sm font-medium text-slate-700 hover:underline">
            {strings.mealPrompt.openApp}
          </Link>
        </Card>
      ) : prompt ? (
        <div className="space-y-3">
          {error && <Alert tone="warning">{error}</Alert>}
          {saved && <Alert tone="success">{saved}</Alert>}
          {prompt.expired && <Alert tone="warning">{strings.mealPrompt.expiredLink}</Alert>}

          <MealPromptCard prompt={prompt} busy={busy} disabled={prompt.expired} onAnswer={answer} />

          <p className="text-center">
            <Link href={ROUTES.meals} className="text-sm font-medium text-slate-600 hover:underline">
              {strings.mealPrompt.openApp}
            </Link>
          </p>
        </div>
      ) : null}
    </PageContainer>
  );
}
