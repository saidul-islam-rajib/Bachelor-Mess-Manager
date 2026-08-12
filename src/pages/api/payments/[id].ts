import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser } from '@/lib/auth-utils';
import { badRequest, conflict, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { reversePayment } from '@/lib/bill-collections';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return methodNotAllowed(res, ['DELETE']);
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
    include: { group: { select: { id: true, supervisorId: true } } }
  });
  if (!payment) {
    return notFound(res, 'Payment not found.');
  }
  if (!(await canManageGroup(payment.group.id, sessionUser))) {
    return forbidden(res, 'Only the group supervisor can reverse a payment.');
  }

  const reversed = await reversePayment({
    paymentId,
    actorId: sessionUser.id,
    groupId: payment.groupId
  });
  if (!reversed.ok) {
    return conflict(res, reversed.error);
  }

  return ok(res, { reversed: true, amount: reversed.amount });
}

export default withAudit(handler);
