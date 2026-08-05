import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { listRecentFailures } from '@/lib/login-attempts';
import { buildPageMeta, queryPagination, queryString } from '@/lib/query';
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

  const { page, pageSize, skip, take } = queryPagination(req);
  const search = queryString(req, 'search');
  const { items, total } = await listRecentFailures({ skip, take, search });

  return ok(res, { failures: items, meta: buildPageMeta(page, pageSize, total) });
}

export default withAudit(handler);
