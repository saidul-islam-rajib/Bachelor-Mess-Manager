import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { searchLocations } from '@/lib/geo';
import { strings } from '@/lib/i18n';
import { queryString } from '@/lib/query';
import { withAudit } from '@/lib/with-audit';

const MIN_QUERY_LENGTH = 3;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) return unauthorized(res, strings.toLet.signedOut);

  const q = queryString(req, 'q') ?? '';
  if (q.trim().length < MIN_QUERY_LENGTH) return ok(res, { results: [] });

  const results = await searchLocations(q);
  return ok(res, { results });
}

export default withAudit(handler);
