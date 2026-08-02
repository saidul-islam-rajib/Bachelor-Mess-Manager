import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { MEAL_PROMPT_ANSWER_VALUES, type MealPromptAnswer } from '@/lib/constants';
import { strings } from '@/lib/i18n';
import { currentCounts } from '@/lib/meal-edits';
import {
  activeGroupsFor,
  describeCounts,
  plannedCounts,
  promptDateKey,
  readPrompt,
  respond
} from '@/lib/meal-prompts';
import { dayToUtcDate } from '@/lib/month';
import { queryString } from '@/lib/query';
import { withAudit } from '@/lib/with-audit';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, strings.errors.unauthorized);
  }

  if (req.method === 'GET') {
    const requested = queryString(req, 'date');
    if (requested !== undefined && !DAY_PATTERN.test(requested)) {
      return badRequest(res, strings.validation.invalidDate);
    }

    const dateKey = requested ?? promptDateKey();
    const groups = await activeGroupsFor(sessionUser.id);

    const prompts = await Promise.all(
      groups.map(async (group) => {
        const prompt = await readPrompt(sessionUser.id, group.id, dateKey);

        return {
          groupId: group.id,
          groupName: group.name,
          date: dateKey,
          counts: prompt?.counts ?? (await currentCounts(sessionUser.id, group.id, dayToUtcDate(dateKey))),
          planned: prompt?.planned ?? (await plannedCounts(sessionUser.id, group.id, dateKey)),
          answer: prompt?.answer ?? null,
          respondedAt: prompt?.respondedAt ?? null
        };
      })
    );

    return ok(res, { date: dateKey, prompts });
  }

  if (req.method === 'POST') {
    const { groupId, date, answer, counts } = req.body as {
      groupId?: string;
      date?: string;
      answer?: string;
      counts?: { breakfast?: number; lunch?: number; dinner?: number };
    };

    if (!groupId) {
      return badRequest(res, strings.validation.groupIdRequired);
    }
    if (!date || !DAY_PATTERN.test(date)) {
      return badRequest(res, strings.validation.invalidDate);
    }
    if (!answer || !MEAL_PROMPT_ANSWER_VALUES.includes(answer)) {
      return badRequest(res, strings.mealPrompt.invalidAnswer);
    }

    const result = await respond({
      userId: sessionUser.id,
      groupId,
      dateKey: date,
      answer: answer as MealPromptAnswer,
      counts
    });

    if (!result.ok) {
      return badRequest(res, result.error);
    }

    return ok(res, { saved: true, counts: result.counts, summary: describeCounts(result.counts) });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler);
