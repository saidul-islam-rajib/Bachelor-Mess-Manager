import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { dayToUtcDate, parseMonth, utcDateToDay } from '@/lib/month';
import { recordExpenseCreated } from '@/lib/expense-history';
import { parseItems } from '@/lib/expense-items';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  const admin = requireAdmin(sessionUser);
  const isMember = await isGroupMember(groupId, sessionUser.id);
  if (!isMember && !admin) {
    return forbidden(res, 'You are not a member of this group.');
  }

  const isSupervisor = group.supervisorId === sessionUser.id || admin;

  if (req.method === 'GET') {
    const monthKey = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
    const { start, nextStart } = parseMonth(monthKey);

    const rows = await prisma.expenseEntry.findMany({
      where: { groupId, type: 'BAZAR', date: { gte: start, lt: nextStart } },
      include: {
        payer: { select: { id: true, name: true, email: true } },
        items: { orderBy: { sortOrder: 'asc' } },
        comments: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }]
    });

    const expenses = rows.map((r) => ({
      id: r.id,
      date: utcDateToDay(r.date),
      amount: r.amount,
      note: r.note ?? '',
      payer: r.payer ? { id: r.payer.id, name: r.payer.name, email: r.payer.email } : null,
      items: r.items.map((i) => ({ id: i.id, name: i.name, amount: i.amount })),
      comments: r.comments.map((c) => ({
        id: c.id,
        text: c.text,
        authorId: c.userId,
        authorName: c.user.name,
        createdAt: c.createdAt.toISOString()
      }))
    }));

    return ok(res, { expenses, isSupervisor, currentUserId: sessionUser.id });
  }

  if (req.method === 'POST') {
    const { date, items, note } = req.body as { date?: string; items?: unknown; note?: string };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return badRequest(res, 'A valid date (YYYY-MM-DD) is required.');
    }

    const parsed = parseItems(items);
    if ('error' in parsed) {
      return badRequest(res, parsed.error);
    }

    const expense = await prisma.expenseEntry.create({
      data: {
        groupId,
        type: 'BAZAR',
        amount: parsed.total,
        date: dayToUtcDate(date),
        payerId: sessionUser.id,
        splitMethod: 'MEAL',
        note: note?.trim() || '',
        items: {
          create: parsed.items.map((item, index) => ({
            name: item.name,
            amount: item.amount,
            sortOrder: index
          }))
        }
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } }
    });

    await recordExpenseCreated({
      expenseId: expense.id,
      groupId,
      actorId: sessionUser.id,
      next: { amount: expense.amount, date: expense.date, note: expense.note }
    });

    return created(res, {
      expense: {
        id: expense.id,
        date: utcDateToDay(expense.date),
        amount: expense.amount,
        note: expense.note,
        items: expense.items.map((i) => ({ id: i.id, name: i.name, amount: i.amount }))
      }
    });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler);
