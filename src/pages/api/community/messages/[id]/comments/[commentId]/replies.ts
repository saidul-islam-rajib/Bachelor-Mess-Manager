import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, created, methodNotAllowed, notFound, unauthorized } from '@/lib/http';
import { communityConfig } from '@/config';
import { addReply, findComment, findMessage, notifyNewComment } from '@/lib/community';
import { strings } from '@/lib/i18n';
import { firstValue } from '@/lib/query';
import { findXssField } from '@/lib/xss';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const commentId = firstValue(req.query.commentId);
  if (!commentId) return badRequest(res, strings.community.idRequired);

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) return unauthorized(res, strings.community.signedOut);

  const comment = await findComment(commentId);
  if (!comment) return notFound(res, strings.community.notFound);

  const message = await findMessage(comment.messageId);
  if (!message) return notFound(res, strings.community.notFound);

  const { text } = req.body as { text?: string };
  const value = typeof text === 'string' ? text.trim() : '';

  if (!value) return badRequest(res, strings.community.comments.required);
  if (value.length > communityConfig.maxMessageLength) {
    return badRequest(res, strings.community.comments.tooLong(communityConfig.maxMessageLength));
  }
  if (findXssField({ text: value })) return badRequest(res, strings.errors.suspiciousInput);

  const reply = await addReply({ commentId, userId: sessionUser.id, text: value });
  await notifyNewComment({ message, commenterId: sessionUser.id, text: value });

  return created(res, { reply });
}

export default withAudit(handler);
