import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { buildPageMeta, queryPagination } from '@/lib/query';
import { listMemberVisits } from '@/lib/user-sessions';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, strings.errors.unauthorized);
  }
  if (!hasPermission(sessionUser, PERMISSIONS.SECURITY_MANAGE)) {
    return forbidden(res, strings.errors.adminOnly);
  }

  const userId = Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId;
  if (!userId) {
    return badRequest(res, 'A user is required.');
  }

  const { page, pageSize, skip, take } = queryPagination(req);
  const { user, visits, total } = await listMemberVisits(userId, take, skip);

  if (!user) {
    return notFound(res, 'That account no longer exists.');
  }

  return ok(res, { user, visits, meta: buildPageMeta(page, pageSize, total) });
}

export default withAudit(handler);
