import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { queryEnum, queryInt, queryString } from '@/lib/query';
import { buildActivityReport, type LeaderboardSort } from '@/lib/user-sessions';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

const SORTS = ['visits', 'time', 'recent'] as const;

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

  const days = queryInt(req, 'days', 30, 0, 3650);
  const sort = (queryEnum<LeaderboardSort>(req, 'sort', SORTS) ?? 'visits') as LeaderboardSort;

  const report = await buildActivityReport({
    days: days === 0 ? null : days,
    sort,
    search: queryString(req, 'search')
  });

  return ok(res, report);
}

export default withAudit(handler);
