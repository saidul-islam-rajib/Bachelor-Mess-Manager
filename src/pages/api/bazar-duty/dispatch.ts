import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { bazarReminderConfig } from '@/config';
import { GROUP_STATUS, NOTIFICATION_TYPES } from '@/lib/constants';
import { bazarDutyUserId } from '@/lib/bazar-duty';
import { formatDay } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { dayToUtcDate, todayKey } from '@/lib/month';
import { notifyUsers } from '@/lib/notifications';
import { sendPushToUser } from '@/lib/push';
import { groupPath } from '@/lib/routes';
import { isNotificationEnabled } from '@/lib/settings-service';
import { withAudit } from '@/lib/with-audit';

const DISPATCH_SECRET_HEADER = 'x-dispatch-secret';
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function secretMatches(req: NextApiRequest): boolean {
  const secret = bazarReminderConfig.dispatchSecret;
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

  const dateKey = date ?? todayKey();
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
        return forbidden(res, strings.bazarReminder.dispatchForbidden);
      }
      groupIds = [groupId];
    } else {
      if (!requireAdmin(sessionUser)) {
        return forbidden(res, strings.bazarReminder.dispatchForbidden);
      }
      const groups = await prisma.group.findMany({
        where: { status: GROUP_STATUS.ACTIVE },
        select: { id: true }
      });
      groupIds = groups.map((group) => group.id);
    }
  }

  if (!(await isNotificationEnabled(NOTIFICATION_TYPES.BAZAR_DUTY_REMINDER))) {
    return ok(res, { sent: 0, date: dateKey, message: strings.bazarReminder.nothingToSend });
  }

  const dateLabel = formatDay(dateKey);
  const reminderDate = dayToUtcDate(dateKey);
  let sent = 0;

  for (const id of groupIds) {
    const group = await prisma.group.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
    if (!group || group.status !== GROUP_STATUS.ACTIVE) continue;

    const userId = await bazarDutyUserId(group.id, dateKey);
    if (!userId) continue;

    try {
      await prisma.bazarDutyReminder.create({ data: { userId, groupId: group.id, date: reminderDate } });
    } catch {
      continue;
    }

    const recipient = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    if (!recipient) continue;

    await notifyUsers(
      [recipient],
      {
        type: NOTIFICATION_TYPES.BAZAR_DUTY_REMINDER,
        title: strings.bazarReminder.notificationTitle(group.name, dateLabel),
        excerpt: strings.bazarReminder.notificationBody,
        link: groupPath(group.id),
        groupId: group.id
      },
      { email: true }
    );

    void sendPushToUser(userId, {
      title: strings.bazarReminder.pushTitle(group.name),
      body: strings.bazarReminder.pushBody,
      url: groupPath(group.id),
      tag: 'bazar-duty'
    });

    sent += 1;
  }

  return ok(res, {
    sent,
    date: dateKey,
    message: sent > 0 ? strings.bazarReminder.dispatched(sent) : strings.bazarReminder.nothingToSend
  });
}

export default withAudit(handler);
