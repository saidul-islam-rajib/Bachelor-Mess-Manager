import type { NextApiRequest, NextApiResponse } from 'next';
import { methodNotAllowed, ok } from '@/lib/http';
import { suggestLocations } from '@/lib/community';
import { queryString } from '@/lib/query';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const q = queryString(req, 'q') ?? '';
  const suggestions = await suggestLocations(q);

  return ok(res, { suggestions });
}

export default withAudit(handler);
