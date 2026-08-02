import type { NextApiRequest, NextApiResponse } from 'next';
import { badRequest, methodNotAllowed, notFound, ok } from '@/lib/http';
import { MEAL_PROMPT_ANSWER_VALUES, type MealPromptAnswer } from '@/lib/constants';
import { strings } from '@/lib/i18n';
import { describeCounts, findPromptByToken, respond } from '@/lib/meal-prompts';
import { firstValue } from '@/lib/query';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = firstValue(req.query.token);
  const lookup = await findPromptByToken(token);

  if (!lookup.ok) {
    return notFound(res, lookup.error);
  }

  if (req.method === 'GET') {
    return ok(res, { prompt: lookup.prompt });
  }

  if (req.method === 'POST') {
    const { answer, counts } = req.body as {
      answer?: string;
      counts?: { breakfast?: number; lunch?: number; dinner?: number };
    };

    if (!answer || !MEAL_PROMPT_ANSWER_VALUES.includes(answer)) {
      return badRequest(res, strings.mealPrompt.invalidAnswer);
    }

    const result = await respond({
      userId: lookup.prompt.userId,
      groupId: lookup.prompt.groupId,
      dateKey: lookup.prompt.date,
      answer: answer as MealPromptAnswer,
      counts
    });

    if (!result.ok) {
      return badRequest(res, result.error);
    }

    const refreshed = await findPromptByToken(token);

    return ok(res, {
      saved: true,
      summary: describeCounts(result.counts),
      prompt: refreshed.ok ? refreshed.prompt : lookup.prompt
    });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler);
