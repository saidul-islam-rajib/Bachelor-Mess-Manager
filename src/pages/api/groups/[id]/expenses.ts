import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { dayToUtcDate, parseMonth, utcDateToDay } from '@/lib/month';
import { recordExpenseCreated } from '@/lib/expense-history';
import { mentionIdsIn } from '@/lib/mentions';
import { parseItems } from '@/lib/expense-items';
import { GROUP_CLOSED_MESSAGE, isGroupWritable } from '@/lib/groups';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { strings } from '@/lib/i18n';
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

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      status: true,
      supervisorId: true,
      supervisor: { select: { id: true, name: true } },
      memberships: {
        where: { userId: sessionUser.id, isActive: true },
        select: { id: true },
        take: 1
      }
    }
  });
  if (!group) {
    return notFound(res, 'Group not found.');
  }

  const admin = requireAdmin(sessionUser);
  const isMember = group.supervisorId === sessionUser.id || group.memberships.length > 0;
  if (!isMember && !admin) {
    return forbidden(res, 'You are not a member of this group.');
  }

  const isSupervisor = group.supervisorId === sessionUser.id || admin;

  if (req.method === 'GET') {
    if (!hasPermission(sessionUser, PERMISSIONS.EXPENSE_VIEW)) {
      return forbidden(res, strings.errors.permissionDenied);
    }

    const monthKey = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
    const { start, nextStart } = parseMonth(monthKey);

    const [rows, memberships] = await Promise.all([
      prisma.expenseEntry.findMany({
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
      }),
      prisma.membership.findMany({
        where: { groupId, isActive: true },
        select: { user: { select: { id: true, name: true } } }
      })
    ]);

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

    const memberMap = new Map<string, { id: string; name: string }>();
    for (const membership of memberships) memberMap.set(membership.user.id, membership.user);
    if (group.supervisor) memberMap.set(group.supervisor.id, group.supervisor);

    const mentioned = new Set<string>();
    for (const expense of expenses) {
      for (const comment of expense.comments) {
        for (const id of mentionIdsIn(comment.text)) mentioned.add(id);
      }
    }

    const mentionedUsers = mentioned.size
      ? await prisma.user.findMany({ where: { id: { in: [...mentioned] } }, select: { id: true, name: true } })
      : [];
    const mentionNames: Record<string, string> = {};
    for (const user of mentionedUsers) mentionNames[user.id] = user.name;

    return ok(res, {
      expenses,
      members: [...memberMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
      mentionNames,
      isSupervisor,
      currentUserId: sessionUser.id
    });
  }

  if (req.method === 'POST') {
    if (!hasPermission(sessionUser, PERMISSIONS.EXPENSE_CREATE)) {
      return forbidden(res, strings.errors.permissionDenied);
    }
    if (!isGroupWritable(group)) {
      return forbidden(res, GROUP_CLOSED_MESSAGE);
    }

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
