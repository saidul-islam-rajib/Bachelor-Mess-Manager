import type { NextApiRequest, NextApiResponse } from 'next';
import { getMobileSession } from '@/lib/auth-utils';
import { methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { createMobileToken, readMobileClaims } from '@/lib/session';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const session = await getMobileSession(req);
  if (!session) return unauthorized(res);

  const token = await createMobileToken(session.user.id, session.payload.sv);
  const claims = readMobileClaims(token);

  return ok(res, { token, expiresAt: new Date((claims?.exp ?? 0) * 1000).toISOString() });
}

export default withAudit(handler);
