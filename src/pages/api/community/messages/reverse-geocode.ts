import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { reverseGeocode } from '@/lib/geo';
import { strings } from '@/lib/i18n';
import { queryString } from '@/lib/query';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) return unauthorized(res, strings.toLet.signedOut);

  const lat = Number(queryString(req, 'lat'));
  const lng = Number(queryString(req, 'lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return badRequest(res, strings.errors.generic);
  }

  const label = await reverseGeocode({ lat, lng });
  return ok(res, { label });
}

export default withAudit(handler);
