import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { buildPageMeta, queryPagination, queryString } from '@/lib/query';
import { clampSupervisorCap, getSupervisorPolicy } from '@/lib/settings-service';
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
  if (!requireAdmin(sessionUser)) {
    return forbidden(res, strings.errors.adminOnly);
  }

  const search = queryString(req, 'search') ?? '';
  const { page, pageSize, skip, take } = queryPagination(req);

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { supervisor: { name: { contains: search, mode: 'insensitive' as const } } }
        ]
      }
    : {};

  const [policy, rows, total, exceptions] = await Promise.all([
    getSupervisorPolicy(),
    prisma.group.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        maxSupervisors: true,
        supervisor: { select: { id: true, name: true } },
        coSupervisors: {
          select: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: [{ name: 'asc' }],
      skip,
      take
    }),
    prisma.group.count({ where }),
    prisma.group.count({ where: { maxSupervisors: { not: null } } })
  ]);

  const siteMax = policy.siteMaxSupervisors;

  const groups = rows.map((group) => {
    const used = 1 + group.coSupervisors.length;
    const effectiveMax =
      typeof group.maxSupervisors === 'number' ? clampSupervisorCap(group.maxSupervisors) : siteMax;

    return {
      id: group.id,
      name: group.name,
      status: group.status,
      maxSupervisors: group.maxSupervisors,
      effectiveMax,
      overridden: typeof group.maxSupervisors === 'number',
      used,
      canAddMore: used < effectiveMax,
      supervisors: [
        { id: group.supervisor.id, name: group.supervisor.name, isPrimary: true },
        ...group.coSupervisors.map((row) => ({ id: row.user.id, name: row.user.name, isPrimary: false }))
      ]
    };
  });

  return ok(res, {
    siteMax,
    exceptions,
    groups,
    meta: buildPageMeta(page, pageSize, total)
  });
}

export default withAudit(handler);
