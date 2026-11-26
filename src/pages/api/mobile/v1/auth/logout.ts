import type { NextApiRequest, NextApiResponse } from 'next';
import { readMobileBearer } from '@/lib/auth-utils';
import { methodNotAllowed, ok } from '@/lib/http';
import { verifyMobileToken } from '@/lib/session';
import { endSession } from '@/lib/user-sessions';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const payload = await verifyMobileToken(readMobileBearer(req));
  if (payload) {
    await endSession(payload.uid);
  }

  return ok(res, { ok: true });
}

export default withAudit(handler);
