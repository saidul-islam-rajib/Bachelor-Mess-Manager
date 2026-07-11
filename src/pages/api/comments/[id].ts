import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { withAudit } from '@/lib/with-audit';

const MAX_LENGTH = 1000;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    return methodNotAllowed(res, ['PATCH', 'DELETE']);
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
    include: { group: { select: { supervisorId: true } } }
  });
  if (!comment || comment.deletedAt) {
    return notFound(res, 'Comment not found.');
  }

  const admin = requireAdmin(sessionUser);
  const isSupervisor = comment.group.supervisorId === sessionUser.id;

  if (req.method === 'PATCH') {
    if (!isSupervisor && !admin) {
      return forbidden(res, 'Only the group supervisor can reply.');
    }

    const { replyText } = req.body as { replyText?: string };
    const value = typeof replyText === 'string' ? replyText.trim() : '';

    if (!value) {
      return badRequest(res, 'Write a reply first.');
    }
    if (value.length > MAX_LENGTH) {
      return badRequest(res, `Keep it under ${MAX_LENGTH} characters.`);
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { replyText: value, repliedAt: new Date() }
    });

    return ok(res, {
      comment: {
        id: updated.id,
        replyText: updated.replyText,
        repliedAt: updated.repliedAt ? updated.repliedAt.toISOString() : null
      }
    });
  }

  if (!isSupervisor && !admin) {
    return forbidden(res, 'Only the group supervisor can delete comments.');
  }

  await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });

  return ok(res, { deleted: true });
}

export default withAudit(handler);
