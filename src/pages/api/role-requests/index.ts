import type { NextApiRequest, NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, conflict, created, forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import {
  createRoleRequest,
  getRolePolicy,
  REQUESTABLE_ROLES,
  ROLE_REQUEST_STATUS,
  ROLE_REQUEST_STATUS_VALUES
} from '@/lib/role-requests';
import { buildPageMeta, queryEnum, queryPagination } from '@/lib/query';
import { strings } from '@/lib/i18n';
import { validationConfig } from '@/config';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, strings.errors.unauthorized);
  }

  if (req.method === 'GET') {
    const canReview = hasPermission(sessionUser, PERMISSIONS.USER_ASSIGN_ROLE);
    const status = queryEnum(req, 'status', ROLE_REQUEST_STATUS_VALUES);
    const scope = queryEnum(req, 'scope', ['mine', 'all'] as const) ?? (canReview ? 'all' : 'mine');
    const { page, pageSize, skip, take } = queryPagination(req);

    if (scope === 'all' && !canReview) {
      return forbidden(res, strings.errors.adminOnly);
    }

    const where: Prisma.RoleRequestWhereInput = {};
    if (scope === 'mine') where.userId = sessionUser.id;
    if (status) where.status = status;

    const [total, rows, pendingCount] = await Promise.all([
      prisma.roleRequest.count({ where }),
      prisma.roleRequest.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take,
        include: {
          user: { select: { id: true, name: true, email: true, role: true, status: true } },
          decidedBy: { select: { id: true, name: true } }
        }
      }),
      canReview
        ? prisma.roleRequest.count({ where: { status: ROLE_REQUEST_STATUS.PENDING } })
        : Promise.resolve(0)
    ]);

    return ok(res, {
      requests: rows.map((row) => ({
        id: row.id,
        requestedRole: row.requestedRole,
        status: row.status,
        reason: row.reason,
        decisionNote: row.decisionNote,
        decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
        decidedBy: row.decidedBy,
        createdAt: row.createdAt.toISOString(),
        user: row.user
      })),
      meta: buildPageMeta(page, pageSize, total),
      pendingCount,
      canReview,
      policy: await getRolePolicy()
    });
  }

  if (req.method === 'POST') {
    const { requestedRole, reason } = req.body as Record<string, unknown>;

    if (typeof requestedRole !== 'string' || !REQUESTABLE_ROLES.includes(requestedRole)) {
      return badRequest(res, strings.roleRequests.invalidRole);
    }
    if (reason !== undefined && typeof reason === 'string' && reason.length > validationConfig.noteMaxLength) {
      return badRequest(res, strings.validation.textTooLong(validationConfig.noteMaxLength));
    }

    const outcome = await createRoleRequest({
      userId: sessionUser.id,
      requestedRole,
      reason: typeof reason === 'string' ? reason : null
    });

    if (!outcome.ok) {
      return conflict(res, outcome.error);
    }

    return created(res, {
      requestId: outcome.requestId,
      autoApproved: outcome.autoApproved,
      message: outcome.autoApproved
        ? strings.roleRequests.autoApproved(requestedRole)
        : strings.roleRequests.submitted
    });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler);
