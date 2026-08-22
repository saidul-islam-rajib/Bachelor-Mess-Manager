import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, noContent, notFound, unauthorized } from '@/lib/http';
import { deleteComment, findComment } from '@/lib/tolet';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return methodNotAllowed(res, ['DELETE']);

  const commentId = firstParam(req.query.commentId);
  if (!commentId) return badRequest(res, strings.toLet.idRequired);

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) return unauthorized(res, strings.toLet.signedOut);

  const comment = await findComment(commentId);
  if (!comment) return notFound(res, strings.toLet.notFound);

  const canDelete = comment.userId === sessionUser.id || requireAdmin(sessionUser);
  if (!canDelete) return forbidden(res, strings.toLet.forbidden);

  await deleteComment(commentId, comment.listingId, sessionUser.id);
  return noContent(res);
}

export default withAudit(handler);
