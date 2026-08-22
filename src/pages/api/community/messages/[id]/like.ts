import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { findMessage, toggleLike } from '@/lib/community';
import { strings } from '@/lib/i18n';
import { firstValue } from '@/lib/query';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const id = firstValue(req.query.id);
  if (!id) return badRequest(res, strings.community.idRequired);

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) return unauthorized(res, strings.community.signedOut);

  const message = await findMessage(id);
  if (!message) return notFound(res, strings.community.notFound);

  const result = await toggleLike(id, sessionUser.id);
  return ok(res, result);
}

export default withAudit(handler);
