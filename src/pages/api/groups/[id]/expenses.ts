import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { dayToUtcDate, parseMonth, utcDateToDay } from '@/lib/month';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const groupId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!groupId) {
    return badRequest(res, 'Group ID is required.');
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return notFound(res, 'Group not found.');
  }

  const isMember = await isGroupMember(groupId, sessionUser.id);
  if (!isMember && !requireAdmin(sessionUser)) {
    return forbidden(res, 'You are not a member of this group.');
  }

  if (req.method === 'GET') {
    const monthKey = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
    const { start, nextStart } = parseMonth(monthKey);

    const rows = await prisma.expenseEntry.findMany({
      where: { groupId, type: 'BAZAR', date: { gte: start, lt: nextStart } },
      include: { payer: { select: { id: true, name: true, email: true } } },
      orderBy: { date: 'asc' }
    });

    const expenses = rows.map((r) => ({
      id: r.id,
      date: utcDateToDay(r.date),
      amount: r.amount,
      note: r.note ?? '',
      payer: r.payer ? { id: r.payer.id, name: r.payer.name, email: r.payer.email } : null
    }));

    return ok(res, { expenses });
  }

  if (req.method === 'POST') {
    const { date, amount, note } = req.body as { date?: string; amount?: number; note?: string };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return badRequest(res, 'A valid date (YYYY-MM-DD) is required.');
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return badRequest(res, 'Amount must be a positive number.');
    }

    const expense = await prisma.expenseEntry.create({
      data: {
        groupId,
        type: 'BAZAR',
        amount: value,
        date: dayToUtcDate(date),
        payerId: sessionUser.id,
        splitMethod: 'MEAL',
        note: note?.trim() || ''
      }
    });

    return created(res, { expense: { id: expense.id, date: utcDateToDay(expense.date), amount: expense.amount, note: expense.note } });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}
