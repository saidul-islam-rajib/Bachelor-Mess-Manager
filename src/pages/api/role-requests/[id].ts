import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, conflict, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { decideRoleRequest, ROLE_REQUEST_STATUS } from '@/lib/role-requests';
import { strings } from '@/lib/i18n';
import { validationConfig } from '@/config';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, strings.errors.unauthorized);
  }

  const requestId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!requestId) {
    return badRequest(res, strings.roleRequests.idRequired);
  }

  const existing = await prisma.roleRequest.findUnique({
    where: { id: requestId },
    select: { id: true, userId: true, status: true, requestedRole: true }
  });
  if (!existing) {
    return notFound(res, strings.roleRequests.notFound);
  }

  if (req.method === 'DELETE') {
    if (existing.userId !== sessionUser.id) {
      return forbidden(res, strings.roleRequests.notYours);
    }
    if (existing.status !== ROLE_REQUEST_STATUS.PENDING) {
      return conflict(res, strings.roleRequests.alreadyDecided);
    }

    await prisma.roleRequest.update({
      where: { id: requestId },
      data: { status: ROLE_REQUEST_STATUS.CANCELLED, decidedAt: new Date() }
    });

    return ok(res, { cancelled: true, message: strings.roleRequests.cancelled });
  }

  if (req.method === 'PATCH') {
    if (!hasPermission(sessionUser, PERMISSIONS.USER_ASSIGN_ROLE)) {
      return forbidden(res, strings.errors.adminOnly);
    }

    const { approve, note } = req.body as Record<string, unknown>;
    if (typeof approve !== 'boolean') {
      return badRequest(res, strings.roleRequests.approveRequired);
    }
    if (note !== undefined && typeof note === 'string' && note.length > validationConfig.noteMaxLength) {
      return badRequest(res, strings.validation.textTooLong(validationConfig.noteMaxLength));
    }

    const outcome = await decideRoleRequest({
      requestId,
      approve,
      decidedById: sessionUser.id,
      note: typeof note === 'string' ? note : null
    });

    if (!outcome.ok) {
      return conflict(res, outcome.error);
    }

    return ok(res, {
      decided: true,
      approved: approve,
      message: approve
        ? strings.roleRequests.approvedMessage(outcome.role)
        : strings.roleRequests.rejectedMessage
    });
  }

  return methodNotAllowed(res, ['PATCH', 'DELETE']);
}

export default withAudit(handler);
