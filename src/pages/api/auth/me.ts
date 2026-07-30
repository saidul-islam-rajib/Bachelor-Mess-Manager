import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { clearSessionCookie } from '@/lib/auth';
import { ok } from '@/lib/http';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {

  const user = await getSessionUser(req, res);

  if (!user && req.headers.cookie?.includes('bachelor_point_session')) {
    clearSessionCookie(res);
  }

  return ok(res, { user: user ?? null });
}

export default withAudit(handler);
