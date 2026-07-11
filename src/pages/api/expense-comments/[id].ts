import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
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

  const commentId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!commentId) {
    return badRequest(res, 'Comment ID is required.');
  }

  const comment = await prisma.expenseComment.findUnique({
    where: { id: commentId },
    include: { expense: { select: { group: { select: { supervisorId: true } } } } }
  });
  if (!comment || comment.deletedAt) {
    return notFound(res, 'Comment not found.');
  }

  const isSupervisor = comment.expense.group.supervisorId === sessionUser.id;
  if (!isSupervisor && !requireAdmin(sessionUser)) {
    return forbidden(res, 'Only the group supervisor can delete comments.');
  }

  await prisma.expenseComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });

  return ok(res, { deleted: true });
}

export default withAudit(handler);
