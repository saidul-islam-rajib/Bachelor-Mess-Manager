import type { NextApiRequest, NextApiResponse } from 'next';
import { methodNotAllowed, ok } from '@/lib/http';
import { authenticateLogin, MOBILE_DEVICE } from '@/lib/login';
import { createMobileToken, readMobileClaims } from '@/lib/session';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const user = await authenticateLogin(req, res, { device: MOBILE_DEVICE });
  if (!user) return;

  const token = await createMobileToken(user.id, user.tokenVersion);
  const claims = readMobileClaims(token);

  return ok(res, {
    token,
    expiresAt: new Date((claims?.exp ?? 0) * 1000).toISOString(),
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
}

export default withAudit(handler);
