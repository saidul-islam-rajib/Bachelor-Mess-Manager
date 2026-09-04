import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, methodNotAllowed, ok, unauthorized } from '@/lib/http';
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

  const { endpoint } = req.body as { endpoint?: unknown };
  if (typeof endpoint !== 'string' || !endpoint) {
    return badRequest(res, strings.errors.generic);
  }

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: sessionUser.id } });

  return ok(res, { unsubscribed: true });
}

export default withAudit(handler);
