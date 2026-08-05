import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { mealPromptConfig } from '@/config';
import { GROUP_STATUS, MEAL_PROMPT_CHANNELS, NOTIFICATION_TYPES } from '@/lib/constants';
import { formatDay } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { isMailConfigured, mealPromptEmail, sendMail } from '@/lib/mailer';
import { issuePrompt, pendingRecipients, promptDateKey, promptLink } from '@/lib/meal-prompts';
import { createNotifications } from '@/lib/notifications';
import { publicBaseUrl } from '@/lib/password-tokens';
import { MEAL_PROMPT_ANSWERS } from '@/lib/constants';
import { withAudit } from '@/lib/with-audit';

const DISPATCH_SECRET_HEADER = 'x-dispatch-secret';
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function secretMatches(req: NextApiRequest): boolean {
  const secret = mealPromptConfig.dispatchSecret;
  if (!secret) return false;

  const header = req.headers[DISPATCH_SECRET_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' && value === secret;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const { groupId, date } = req.body as { groupId?: string; date?: string };

  if (date !== undefined && !DAY_PATTERN.test(date)) {
    return badRequest(res, strings.validation.invalidDate);
  }

  const dateKey = date ?? promptDateKey();
  const trusted = secretMatches(req);

  let groupIds: string[];

  if (trusted) {
    const groups = groupId
      ? [{ id: groupId }]
      : await prisma.group.findMany({ where: { status: GROUP_STATUS.ACTIVE }, select: { id: true } });
    groupIds = groups.map((group) => group.id);
  } else {
    const sessionUser = await getSessionUser(req, res);
    if (!sessionUser) {
      return unauthorized(res, strings.errors.unauthorized);
    }

    if (groupId) {
      if (!(await canManageGroup(groupId, sessionUser))) {
        return forbidden(res, strings.mealPrompt.dispatchForbidden);
      }
      groupIds = [groupId];
    } else {
      if (!requireAdmin(sessionUser)) {
        return forbidden(res, strings.mealPrompt.dispatchForbidden);
      }
      const groups = await prisma.group.findMany({
        where: { status: GROUP_STATUS.ACTIVE },
        select: { id: true }
      });
      groupIds = groups.map((group) => group.id);
    }
  }

  const baseUrl = publicBaseUrl(req);
  const dateLabel = formatDay(dateKey);
  const mailReady = isMailConfigured();
  let sent = 0;

  for (const id of groupIds) {
    const group = await prisma.group.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
    if (!group || group.status !== GROUP_STATUS.ACTIVE) continue;

    const recipients = await pendingRecipients(group.id, dateKey);

    for (const recipient of recipients) {
      const { token } = await issuePrompt({
        userId: recipient.id,
        groupId: group.id,
        dateKey,
        channel: mailReady ? MEAL_PROMPT_CHANNELS.EMAIL : MEAL_PROMPT_CHANNELS.IN_APP
      });

      await createNotifications([recipient.id], {
        type: NOTIFICATION_TYPES.MEAL_PROMPT,
        title: strings.mealPrompt.notificationTitle(group.name, dateLabel),
        excerpt: strings.mealPrompt.notificationBody,
        link: promptLink('', token),
        groupId: group.id
      });

      if (mailReady) {
        void sendMail({
          ...mealPromptEmail({
            name: recipient.name,
            groupName: group.name,
            dateLabel,
            yesLink: promptLink(baseUrl, token, MEAL_PROMPT_ANSWERS.YES),
            noLink: promptLink(baseUrl, token, MEAL_PROMPT_ANSWERS.NO),
            chooseLink: promptLink(baseUrl, token)
          }),
          to: recipient.email
        });
      }

      sent += 1;
    }
  }

  return ok(res, { sent, date: dateKey, message: sent > 0 ? strings.mealPrompt.dispatched(sent) : strings.mealPrompt.nothingToSend });
}

export default withAudit(handler);
