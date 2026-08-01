import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, forbidden, methodNotAllowed, notFound, unauthorized } from '@/lib/http';
import { NOTIFICATION_TYPES } from '@/lib/constants';
import { notifyMentions } from '@/lib/notifications';
import { withAudit } from '@/lib/with-audit';

const MAX_LENGTH = 500;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const expenseId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!expenseId) {
    return badRequest(res, 'Expense ID is required.');
  }

  const expense = await prisma.expenseEntry.findUnique({
    where: { id: expenseId },
    select: { id: true, groupId: true }
  });
  if (!expense) {
    return notFound(res, 'Purchase not found.');
  }

  if (!(await isGroupMember(expense.groupId, sessionUser.id)) && !requireAdmin(sessionUser)) {
    return forbidden(res, 'You are not a member of this group.');
  }

  const { text } = req.body as { text?: string };
  const value = typeof text === 'string' ? text.trim() : '';

  if (!value) {
    return badRequest(res, 'Write a comment first.');
  }
  if (value.length > MAX_LENGTH) {
    return badRequest(res, `Keep comments under ${MAX_LENGTH} characters.`);
  }

  const comment = await prisma.expenseComment.create({
    data: {
      expenseId,
      groupId: expense.groupId,
      userId: sessionUser.id,
      text: value
    }
  });

  await notifyMentions({
    text: value,
    actorId: sessionUser.id,
    groupId: expense.groupId,
    type: NOTIFICATION_TYPES.MENTION_EXPENSE_COMMENT
  });

  return created(res, {
    comment: {
      id: comment.id,
      text: comment.text,
      authorId: sessionUser.id,
      authorName: sessionUser.name,
      createdAt: comment.createdAt.toISOString()
    }
  });
}

export default withAudit(handler);
