import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser } from '@/lib/auth-utils';
import { badRequest, conflict, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { hardDeletePayment, reversePayment, updatePaymentDetails } from '@/lib/bill-collections';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { GROUP_CLOSED_MESSAGE, isGroupWritable } from '@/lib/groups';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';
import { invalidatePrefix } from '@/lib/cache';
import { advancesKey, billsListGroupPrefix, dashboardGroupPrefix } from '@/lib/cache-keys';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE' && req.method !== 'PATCH') {
    return methodNotAllowed(res, ['DELETE', 'PATCH']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const paymentId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!paymentId) {
    return badRequest(res, 'Payment ID is required.');
  }

  const payment = await prisma.paymentStatus.findUnique({
    where: { id: paymentId },
    include: { group: { select: { id: true, supervisorId: true, status: true } } }
  });
  if (!payment) {
    return notFound(res, 'Payment not found.');
  }
  if (!(await canManageGroup(payment.group.id, sessionUser))) {
    return forbidden(res, 'Only the group supervisor can change a payment.');
  }

  if (!isGroupWritable(payment.group)) {
    return forbidden(res, GROUP_CLOSED_MESSAGE);
  }

  const settleCaches = () => {
    invalidatePrefix(billsListGroupPrefix(payment.groupId));
    invalidatePrefix(advancesKey(payment.groupId));
    invalidatePrefix(dashboardGroupPrefix(payment.groupId));
  };

  if (req.method === 'PATCH') {
    if (!hasPermission(sessionUser, PERMISSIONS.PAYMENT_RECORD)) {
      return forbidden(res, strings.errors.permissionDenied);
    }

    const { amount, date } = req.body as { amount?: number; date?: string };
    const updated = await updatePaymentDetails({
      paymentId,
      groupId: payment.groupId,
      amount: amount === undefined ? undefined : Number(amount),
      date
    });
    if (!updated.ok) {
      return conflict(res, updated.error);
    }

    settleCaches();
    return ok(res, { updated: true });
  }

  const hard = req.query.hard === 'true';
  if (hard) {
    if (!hasPermission(sessionUser, PERMISSIONS.PAYMENT_RECORD)) {
      return forbidden(res, strings.errors.permissionDenied);
    }

    const deleted = await hardDeletePayment({ paymentId, groupId: payment.groupId });
    if (!deleted.ok) {
      return conflict(res, deleted.error);
    }

    settleCaches();
    return ok(res, { deleted: true });
  }

  const reversed = await reversePayment({
    paymentId,
    actorId: sessionUser.id,
    groupId: payment.groupId
  });
  if (!reversed.ok) {
    return conflict(res, reversed.error);
  }

  settleCaches();
  return ok(res, { reversed: true, amount: reversed.amount });
}

export default withAudit(handler);
