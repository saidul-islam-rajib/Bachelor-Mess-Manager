import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { isPushConfigured } from '@/lib/push';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, strings.errors.unauthorized);
  }

  if (!isPushConfigured()) {
    return badRequest(res, strings.bazarReminder.alarmUnsupported);
  }

  const { endpoint, keys } = req.body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (
    typeof endpoint !== 'string' ||
    !endpoint ||
    !keys ||
    typeof keys.p256dh !== 'string' ||
    !keys.p256dh ||
    typeof keys.auth !== 'string' ||
    !keys.auth
  ) {
    return badRequest(res, strings.errors.generic);
  }

  const userAgentHeader = req.headers['user-agent'];
  const userAgent = typeof userAgentHeader === 'string' ? userAgentHeader : null;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: sessionUser.id, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    create: { userId: sessionUser.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent, publishedAt: new Date() }
  });

  return ok(res, { subscribed: true });
}

export default withAudit(handler);
