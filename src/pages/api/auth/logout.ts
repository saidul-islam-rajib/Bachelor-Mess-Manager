import type { NextApiRequest, NextApiResponse } from 'next';
import { clearSessionCookie } from '@/lib/auth';
import { methodNotAllowed, ok } from '@/lib/http';
import { withAudit } from '@/lib/with-audit';

function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  clearSessionCookie(res);
  return ok(res, { message: 'Logged out' });
}

export default withAudit(handler);
