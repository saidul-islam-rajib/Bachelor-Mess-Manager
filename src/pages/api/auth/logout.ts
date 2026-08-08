import type { NextApiRequest, NextApiResponse } from 'next';
import { clearSessionCookie } from '@/lib/auth';
import { readSessionToken } from '@/lib/auth-utils';
import { methodNotAllowed, ok } from '@/lib/http';
import { verifySessionToken } from '@/lib/session';
import { endSession } from '@/lib/user-sessions';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const payload = await verifySessionToken(readSessionToken(req));
  if (payload) {
    await endSession(payload.uid);
  }

  clearSessionCookie(res);
  return ok(res, { message: 'Logged out' });
}

export default withAudit(handler);
