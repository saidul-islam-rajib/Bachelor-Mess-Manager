import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { ok } from '@/lib/http';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getSessionUser(req);
  return ok(res, { user: user ?? null });
}

export default withAudit(handler);
