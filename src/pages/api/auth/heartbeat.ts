import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { touchSession } from '@/lib/user-sessions';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const user = await getSessionUser(req);
  if (!user) {
    return unauthorized(res, 'You must be signed in.');
  }

  if (user.impersonatedBy) {
    return ok(res, { recorded: false, started: false });
  }

  const result = await touchSession(user.id, req);
  return ok(res, { recorded: Boolean(result), started: result?.started ?? false });
}

export default withAudit(handler);
