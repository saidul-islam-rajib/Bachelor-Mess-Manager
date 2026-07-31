import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, forbidden, methodNotAllowed, notFound, unauthorized } from '@/lib/http';
import { NOTIFICATION_TYPES } from '@/lib/constants';
import { notifyMentions } from '@/lib/notifications';
import { withAudit } from '@/lib/with-audit';

const MAX_LENGTH = 1000;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const commentId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!commentId) {
    return badRequest(res, 'Comment ID is required.');
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { group: { select: { id: true, supervisorId: true } } }
  });
  if (!comment || comment.deletedAt) {
    return notFound(res, 'Comment not found.');
  }

  if (!(await isGroupMember(comment.group.id, sessionUser.id)) && !requireAdmin(sessionUser)) {
    return forbidden(res, 'You are not a member of this group.');
  }

  const { text } = req.body as { text?: string };
  const value = typeof text === 'string' ? text.trim() : '';

  if (!value) {
    return badRequest(res, 'Write a reply first.');
  }
  if (value.length > MAX_LENGTH) {
    return badRequest(res, `Keep it under ${MAX_LENGTH} characters.`);
  }

  const reply = await prisma.commentReply.create({
    data: { commentId, userId: sessionUser.id, text: value }
  });

  await notifyMentions({
    text: value,
    actorId: sessionUser.id,
    groupId: comment.group.id,
    type: NOTIFICATION_TYPES.MENTION_REPLY
  });

  return created(res, {
    reply: {
      id: reply.id,
      text: reply.text,
      authorId: sessionUser.id,
      authorName: sessionUser.name,
      isSupervisor: sessionUser.id === comment.group.supervisorId,
      createdAt: reply.createdAt.toISOString()
    }
  });
}

export default withAudit(handler);
