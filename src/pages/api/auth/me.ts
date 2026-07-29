import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { clearSessionCookie } from '@/lib/auth';
import { ok } from '@/lib/http';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Passing `res` lets an ageing session slide forward on its own.
  const user = await getSessionUser(req, res);

  // The cookie parsed but resolved to nobody (revoked, deleted, or rejected
  // account) — drop it so the browser stops sending a dead session.
  if (!user && req.headers.cookie?.includes('mess_session')) {
    clearSessionCookie(res);
  }

  return ok(res, { user: user ?? null });
}

export default withAudit(handler);
