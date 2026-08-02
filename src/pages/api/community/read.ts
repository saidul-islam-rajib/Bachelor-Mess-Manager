import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { markRead, unreadCount } from '@/lib/community';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, strings.community.signedOut);
  }

  if (req.method === 'GET') {
    return ok(res, { unreadCount: await unreadCount(sessionUser.id) });
  }

  if (req.method === 'POST') {
    await markRead(sessionUser.id);
    return ok(res, { unreadCount: 0 });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler);
