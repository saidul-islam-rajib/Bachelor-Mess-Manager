import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    return methodNotAllowed(res, ['PATCH']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) {
    return badRequest(res, 'Notification ID is required.');
  }

  const notification = await prisma.notification.findUnique({ where: { id }, select: { userId: true } });
  if (!notification || notification.userId !== sessionUser.id) {
    return notFound(res, 'Notification not found.');
  }

  await prisma.notification.updateMany({
    where: { id, userId: sessionUser.id, readAt: null },
    data: { readAt: new Date() }
  });

  return ok(res, { id });
}

export default withAudit(handler);
