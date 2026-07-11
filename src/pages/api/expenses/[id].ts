import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { dayToUtcDate, utcDateToDay } from '@/lib/month';
import { recordExpenseDeleted, recordExpenseUpdated } from '@/lib/expense-history';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    return methodNotAllowed(res, ['PATCH', 'DELETE']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const expenseId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!expenseId) {
    return badRequest(res, 'Expense ID is required.');
  }

  const expense = await prisma.expenseEntry.findUnique({ where: { id: expenseId } });
  if (!expense) {
    return notFound(res, 'Expense not found.');
  }

  // Only the member who logged it (or an admin) may change it — supervisors and
  // other members can view but never edit someone else's entry.
  if (expense.payerId !== sessionUser.id && !requireAdmin(sessionUser)) {
    return forbidden(res, 'You can only edit your own expenses.');
  }

  if (req.method === 'DELETE') {
    await prisma.expenseEntry.delete({ where: { id: expenseId } });

    await recordExpenseDeleted({
      expenseId,
      groupId: expense.groupId,
      actorId: sessionUser.id,
      previous: { amount: expense.amount, date: expense.date, note: expense.note }
    });

    return ok(res, { deleted: true });
  }

  const { date, amount, note } = req.body as { date?: string; amount?: number; note?: string };
  const data: Record<string, unknown> = {};

  if (date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return badRequest(res, 'A valid date (YYYY-MM-DD) is required.');
    }
    data.date = dayToUtcDate(date);
  }
  if (amount !== undefined) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return badRequest(res, 'Amount must be a positive number.');
    }
    data.amount = value;
  }
  if (typeof note === 'string') {
    data.note = note.trim();
  }

  if (Object.keys(data).length === 0) {
    return badRequest(res, 'Nothing to update.');
  }

  const updated = await prisma.expenseEntry.update({ where: { id: expenseId }, data });

  await recordExpenseUpdated({
    expenseId,
    groupId: expense.groupId,
    actorId: sessionUser.id,
    previous: { amount: expense.amount, date: expense.date, note: expense.note },
    next: { amount: updated.amount, date: updated.date, note: updated.note }
  });

  return ok(res, {
    expense: { id: updated.id, date: utcDateToDay(updated.date), amount: updated.amount, note: updated.note }
  });
}

export default withAudit(handler);
