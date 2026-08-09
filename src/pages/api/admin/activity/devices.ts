import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { buildPageMeta, queryEnum, queryInt, queryPagination, queryString } from '@/lib/query';
import { DEVICE_VALUES, listDeviceVisitors, type LeaderboardSort } from '@/lib/user-sessions';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

const SORTS = ['visits', 'time', 'recent'] as const;
const MAX_RANGE_DAYS = 3650;
const DEFAULT_RANGE_DAYS = 30;

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

  const device = queryEnum(req, 'device', DEVICE_VALUES);
  if (!device) {
    return badRequest(res, strings.admin.activity.devices.unknownDevice(DEVICE_VALUES.join(', ')));
  }

  const days = queryInt(req, 'days', DEFAULT_RANGE_DAYS, 0, MAX_RANGE_DAYS);
  const sort = (queryEnum<LeaderboardSort>(req, 'sort', SORTS) ?? 'visits') as LeaderboardSort;
  const { page, pageSize, skip, take } = queryPagination(req);

  const report = await listDeviceVisitors({
    device,
    days: days === 0 ? null : days,
    sort,
    search: queryString(req, 'search'),
    take,
    skip
  });

  return ok(res, { ...report, meta: buildPageMeta(page, pageSize, report.total) });
}

export default withAudit(handler);
