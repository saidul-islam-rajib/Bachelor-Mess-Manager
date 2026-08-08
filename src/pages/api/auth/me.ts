import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { clearSessionCookie } from '@/lib/auth';
import { ok } from '@/lib/http';
import { touchSession } from '@/lib/user-sessions';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {

  const user = await getSessionUser(req, res);

  if (!user && req.headers.cookie?.includes('bachelor_point_session')) {
    clearSessionCookie(res);
  }

  if (user && !user.impersonatedBy) {
    await touchSession(user.id, req);
  }

  return ok(res, { user: user ?? null });
}

export default withAudit(handler);
