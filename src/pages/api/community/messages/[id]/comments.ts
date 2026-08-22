import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, created, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { communityConfig } from '@/config';
import { addComment, findMessage, listComments, notifyNewComment } from '@/lib/community';
import { strings } from '@/lib/i18n';
import { firstValue } from '@/lib/query';
import { findXssField } from '@/lib/xss';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const messageId = firstValue(req.query.id);
  if (!messageId) return badRequest(res, strings.community.idRequired);

  if (req.method === 'GET') {
    const message = await findMessage(messageId);
    if (!message) return notFound(res, strings.community.notFound);

    const comments = await listComments(messageId);
    return ok(res, { comments });
  }

  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) return unauthorized(res, strings.community.signedOut);

  const message = await findMessage(messageId);
  if (!message) return notFound(res, strings.community.notFound);

  const { text } = req.body as { text?: string };
  const value = typeof text === 'string' ? text.trim() : '';

  if (!value) return badRequest(res, strings.community.comments.required);
  if (value.length > communityConfig.maxMessageLength) {
    return badRequest(res, strings.community.comments.tooLong(communityConfig.maxMessageLength));
  }
  if (findXssField({ text: value })) return badRequest(res, strings.errors.suspiciousInput);

  const comment = await addComment({ messageId, userId: sessionUser.id, text: value });
  await notifyNewComment({ message, commenterId: sessionUser.id, text: value });

  return created(res, { comment });
}

export default withAudit(handler);
