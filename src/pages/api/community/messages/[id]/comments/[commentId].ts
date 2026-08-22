import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, noContent, notFound, unauthorized } from '@/lib/http';
import { deleteComment, findComment } from '@/lib/community';
import { strings } from '@/lib/i18n';
import { firstValue } from '@/lib/query';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return methodNotAllowed(res, ['DELETE']);

  const commentId = firstValue(req.query.commentId);
  if (!commentId) return badRequest(res, strings.community.idRequired);

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) return unauthorized(res, strings.community.signedOut);

  const comment = await findComment(commentId);
  if (!comment) return notFound(res, strings.community.notFound);

  const canDelete = comment.userId === sessionUser.id || requireAdmin(sessionUser);
  if (!canDelete) return forbidden(res, strings.community.deleteNotAllowed);

  await deleteComment(commentId, comment.messageId, sessionUser.id);
  return noContent(res);
}

export default withAudit(handler);
