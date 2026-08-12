import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return methodNotAllowed(res, ['DELETE']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const replyId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!replyId) {
    return badRequest(res, 'Reply ID is required.');
  }

  const reply = await prisma.commentReply.findUnique({
    where: { id: replyId },
    include: { comment: { select: { group: { select: { id: true, supervisorId: true } } } } }
  });
  if (!reply || reply.deletedAt) {
    return notFound(res, 'Reply not found.');
  }

  const isSupervisor = await canManageGroup(reply.comment.group.id, sessionUser);
  if (!isSupervisor && !requireAdmin(sessionUser)) {
    return forbidden(res, 'Only the group supervisor can delete replies.');
  }

  await prisma.commentReply.update({ where: { id: replyId }, data: { deletedAt: new Date() } });

  return ok(res, { deleted: true });
}

export default withAudit(handler);
