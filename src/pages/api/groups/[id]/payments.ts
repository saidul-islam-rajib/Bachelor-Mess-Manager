import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { buildMealSummary } from '@/lib/meal-summary';
import { dayToUtcDate, parseMonth, round2, utcDateToDay } from '@/lib/month';
import { PAYMENT_STATUS } from '@/lib/constants';

// A PaymentStatus row is one payment a member handed to the mess fund. What each
// member still owes is derived, not stored: cost (their meal share) minus what
// they fronted for groceries minus what they have handed over.
//   due > 0  -> member owes the mess
//   due < 0  -> the mess owes the member back

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

  if (!(await isGroupMember(groupId, sessionUser.id)) && !requireAdmin(sessionUser)) {
    return forbidden(res, 'You are not a member of this group.');
  }

  // Only the group's supervisor (or an admin) records money coming in.
  const canManage = group.supervisorId === sessionUser.id || requireAdmin(sessionUser);

  if (req.method === 'GET') {
    const monthKey = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
    const { start, nextStart } = parseMonth(monthKey);

    const [summary, paymentRows] = await Promise.all([
      buildMealSummary(group, monthKey),
      prisma.paymentStatus.findMany({
        where: { groupId, dueDate: { gte: start, lt: nextStart } },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { dueDate: 'asc' }
      })
    ]);

    const collectedByUser = new Map<string, number>();
    for (const p of paymentRows) {
      collectedByUser.set(p.userId, (collectedByUser.get(p.userId) ?? 0) + p.amountPaid);
    }

    const members = summary.members.map((m) => {
      const collected = round2(collectedByUser.get(m.id) ?? 0);
      const due = round2(m.cost - m.paid - collected);
      return {
        id: m.id,
        name: m.name,
        email: m.email,
        meals: m.meals,
        cost: m.cost,
        bazarPaid: m.paid,
        collected,
        due,
        status: paymentState(m.cost, m.paid + collected)
      };
    });

    const payments = paymentRows.map((p) => ({
      id: p.id,
      userId: p.userId,
      userName: p.user.name,
      amount: round2(p.amountPaid),
      date: utcDateToDay(p.dueDate)
    }));

    const totalCollected = round2(payments.reduce((a, p) => a + p.amount, 0));
    const outstanding = round2(members.reduce((a, m) => a + Math.max(0, m.due), 0));
    const refunds = round2(members.reduce((a, m) => a + Math.max(0, -m.due), 0));

    return ok(res, {
      canManage,
      members,
      payments,
      totals: {
        expense: summary.totals.expense,
        cost: summary.totals.cost,
        collected: totalCollected,
        outstanding,
        refunds
      }
    });
  }

  if (req.method === 'POST') {
    if (!canManage) {
      return forbidden(res, 'Only the group supervisor can record payments.');
    }

    const { userId, amount, date } = req.body as { userId?: string; amount?: number; date?: string };

    if (!userId) {
      return badRequest(res, 'Select the member who paid.');
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return badRequest(res, 'A valid date (YYYY-MM-DD) is required.');
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return badRequest(res, 'Amount must be a positive number.');
    }
    if (!(await isGroupMember(groupId, userId))) {
      return badRequest(res, 'That member does not belong to this group.');
    }

    const payment = await prisma.paymentStatus.create({
      data: {
        userId,
        groupId,
        amountDue: value,
        amountPaid: value,
        status: PAYMENT_STATUS.PAID,
        dueDate: dayToUtcDate(date)
      },
      include: { user: { select: { name: true } } }
    });

    return created(res, {
      payment: {
        id: payment.id,
        userId: payment.userId,
        userName: payment.user.name,
        amount: payment.amountPaid,
        date: utcDateToDay(payment.dueDate)
      }
    });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

function paymentState(cost: number, settled: number) {
  if (cost <= 0) return PAYMENT_STATUS.PAID;
  if (settled <= 0) return PAYMENT_STATUS.PENDING;
  if (settled + 0.01 < cost) return PAYMENT_STATUS.PARTIAL;
  return PAYMENT_STATUS.PAID;
}
