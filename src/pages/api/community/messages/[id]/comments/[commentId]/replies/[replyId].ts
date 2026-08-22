import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, noContent, notFound, unauthorized } from '@/lib/http';
import { deleteReply, findReply } from '@/lib/community';
import { strings } from '@/lib/i18n';
import { firstValue } from '@/lib/query';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return methodNotAllowed(res, ['DELETE']);

  const replyId = firstValue(req.query.replyId);
  if (!replyId) return badRequest(res, strings.community.idRequired);

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) return unauthorized(res, strings.community.signedOut);

  const reply = await findReply(replyId);
  if (!reply) return notFound(res, strings.community.notFound);

  const canDelete = reply.userId === sessionUser.id || requireAdmin(sessionUser);
  if (!canDelete) return forbidden(res, strings.community.deleteNotAllowed);

  await deleteReply(replyId, sessionUser.id);
  return noContent(res);
}

export default withAudit(handler);
