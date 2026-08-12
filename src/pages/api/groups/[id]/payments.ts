import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { buildGroupReport } from '@/lib/group-report';
import { categoryLabels } from '@/lib/expense-categories';
import { dayToUtcDate, parseMonth, round2, utcDateToDay } from '@/lib/month';
import { PAYMENT_STATUS } from '@/lib/constants';
import { GROUP_CLOSED_MESSAGE, isGroupWritable } from '@/lib/groups';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);
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
  const canManage = await canManageGroup(groupId, sessionUser);

  if (req.method === 'GET') {
    if (!hasPermission(sessionUser, PERMISSIONS.PAYMENT_VIEW)) {
      return forbidden(res, strings.errors.permissionDenied);
    }

    const monthKey = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
    const { start, nextStart } = parseMonth(monthKey);

    const [report, paymentRows] = await Promise.all([
      buildGroupReport(group, monthKey),
      prisma.paymentStatus.findMany({
        where: { groupId, dueDate: { gte: start, lt: nextStart } },
        include: {
          user: { select: { id: true, name: true } },
          expense: { select: { id: true, type: true } },
          reversedBy: { select: { id: true } }
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
      })
    ]);

    const payments = paymentRows.map((p) => ({
      id: p.id,
      userId: p.userId,
      userName: p.user.name,
      amount: round2(p.amountPaid),
      date: utcDateToDay(p.dueDate),
      billId: p.expense?.id ?? null,
      billType: p.expense?.type ?? null,
      isReversal: Boolean(p.reversalOfId),
      isReversed: Boolean(p.reversedBy)
    }));

    return ok(res, {
      canManage,
      currentUserId: sessionUser.id,
      through: report.through,
      rateMode: report.rateMode,
      effectiveRateMode: report.effectiveRateMode,
      rateModeFallbackReason: report.rateModeFallbackReason,
      categoryLabels: await categoryLabels(groupId),
      closing: report.closing,
      members: report.members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        meals: m.meals,
        carryIn: m.carryIn,
        mealCost: m.mealCost,
        billShare: m.billShare,
        billShareByType: m.billShareByType,
        cost: m.totalCost,
        bazarPaid: m.bazarPaid,
        collected: m.collected,
        due: m.due,
        status: m.status,
        isActive: m.isActive
      })),
      days: report.days,
      payments,
      totals: {
        bazar: report.totals.bazar,
        bills: report.totals.bills,
        expense: report.totals.expense,
        cost: round2(report.totals.mealCost + report.totals.bills + report.totals.carryIn),
        carryIn: report.totals.carryIn,
        mealRate: report.totals.mealRate,
        averageDayRate: report.totals.averageDayRate,
        ratioRate: report.totals.ratioRate,
        pricedDays: report.totals.pricedDays,
        meals: report.totals.meals,
        collected: report.totals.collected,
        outstanding: report.totals.outstanding,
        refunds: report.totals.refunds,
        unallocatedBazar: report.totals.unallocatedBazar,
        unpricedMeals: report.totals.unpricedMeals
      },
      byType: report.byType
    });
  }

  if (req.method === 'POST') {
    if (!canManage) {
      return forbidden(res, 'Only the group supervisor can record payments.');
    }
    if (!hasPermission(sessionUser, PERMISSIONS.PAYMENT_RECORD)) {
      return forbidden(res, strings.errors.permissionDenied);
    }
    if (!isGroupWritable(group)) {
      return forbidden(res, GROUP_CLOSED_MESSAGE);
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
    if (value > 100_000_000) {
      return badRequest(res, 'That amount looks wrong. Please check it.');
    }
    if (!(await isGroupMember(groupId, userId))) {
      return badRequest(res, 'That member does not belong to this group.');
    }

    const payment = await prisma.paymentStatus.create({
      data: {
        userId,
        groupId,
        amountDue: round2(value),
        amountPaid: round2(value),
        status: PAYMENT_STATUS.PAID,
        dueDate: dayToUtcDate(date),
        publishedAt: new Date()
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

export default withAudit(handler);
