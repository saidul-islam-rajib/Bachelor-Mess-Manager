import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { findListing, toggleLike } from '@/lib/tolet';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const id = firstParam(req.query.id);
  if (!id) return badRequest(res, strings.toLet.idRequired);

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) return unauthorized(res, strings.toLet.signedOut);

  const listing = await findListing(id);
  if (!listing) return notFound(res, strings.toLet.notFound);

  const result = await toggleLike(id, sessionUser.id);
  return ok(res, result);
}

export default withAudit(handler);
