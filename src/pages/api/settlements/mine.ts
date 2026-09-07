import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { listSettlementHistory } from '@/lib/settlement-history';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const submissions = await listSettlementHistory({ userId: sessionUser.id });
  return ok(res, { submissions });
}

export default withAudit(handler);
