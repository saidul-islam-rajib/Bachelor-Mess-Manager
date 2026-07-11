import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { withAudit } from '@/lib/with-audit';

const MAX_LENGTH = 1000;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const groupId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!groupId) {
    return badRequest(res, 'Group ID is required.');
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, supervisorId: true }
  });
  if (!group) {
    return notFound(res, 'Group not found.');
  }

  const admin = requireAdmin(sessionUser);
  if (!(await isGroupMember(groupId, sessionUser.id)) && !admin) {
    return forbidden(res, 'You are not a member of this group.');
  }

  const canReply = group.supervisorId === sessionUser.id || admin;

  if (req.method === 'GET') {
    const rows = await prisma.comment.findMany({
      where: { groupId, deletedAt: null },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const comments = rows.map((c) => ({
      id: c.id,
      text: c.text,
      replyText: c.replyText,
      authorId: c.userId,
      authorName: c.user.name,
      createdAt: c.createdAt.toISOString(),
      repliedAt: c.repliedAt ? c.repliedAt.toISOString() : null,
      canDelete: canReply
    }));

    return ok(res, { comments, canReply, currentUserId: sessionUser.id });
  }

  if (req.method === 'POST') {
    const { text } = req.body as { text?: string };
    const value = typeof text === 'string' ? text.trim() : '';

    if (!value) {
      return badRequest(res, 'Write something first.');
    }
    if (value.length > MAX_LENGTH) {
      return badRequest(res, `Keep it under ${MAX_LENGTH} characters.`);
    }

    const comment = await prisma.comment.create({
      data: { userId: sessionUser.id, groupId, text: value }
    });

    return created(res, {
      comment: {
        id: comment.id,
        text: comment.text,
        replyText: null,
        authorId: sessionUser.id,
        authorName: sessionUser.name,
        createdAt: comment.createdAt.toISOString(),
        repliedAt: null,
        canDelete: true
      }
    });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler);
