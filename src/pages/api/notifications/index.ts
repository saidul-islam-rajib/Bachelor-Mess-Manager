import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { notificationFeed } from '@/lib/notifications';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  if (req.method === 'GET') {
    return ok(res, await notificationFeed(sessionUser.id));
  }

  if (req.method === 'PATCH') {
    await prisma.notification.updateMany({
      where: { userId: sessionUser.id, readAt: null },
      data: { readAt: new Date() }
    });

    return ok(res, await notificationFeed(sessionUser.id));
  }

  return methodNotAllowed(res, ['GET', 'PATCH']);
}

export default withAudit(handler);
