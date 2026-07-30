import type { NextApiRequest, NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin, requireSupervisorOrAdmin } from '@/lib/auth-utils';
import { badRequest, conflict, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { canCreateGroup } from '@/lib/groups';
import { groupConfig } from '@/config';
import {
  GROUP_SORT_FIELDS,
  GROUP_STATUS,
  GROUP_STATUS_VALUES,
  SORT_DIRECTIONS,
  type GroupSortField
} from '@/lib/constants';
import { buildPageMeta, queryEnum, queryPagination, queryString } from '@/lib/query';
import { strings } from '@/lib/i18n';
import { normalizeEmail } from '@/lib/validation';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, strings.errors.unauthorized);
  }

  if (req.method === 'GET') {
    const isAdmin = requireAdmin(sessionUser);
    const search = queryString(req, 'search');
    const status = queryEnum(req, 'status', GROUP_STATUS_VALUES as string[]);
    const supervisorId = queryString(req, 'supervisorId');
    const sortBy = (queryEnum(req, 'sortBy', GROUP_SORT_FIELDS) ?? 'createdAt') as GroupSortField;
    const sortDir = queryEnum(req, 'sortDir', [SORT_DIRECTIONS.ASC, SORT_DIRECTIONS.DESC]) ?? SORT_DIRECTIONS.DESC;
    const paginated = queryString(req, 'paginated') === 'true';
    const { page, pageSize, skip, take } = queryPagination(req);

    const scope: Prisma.GroupWhereInput = isAdmin
      ? {}
      : {
          OR: [
            { supervisorId: sessionUser.id },
            { memberships: { some: { userId: sessionUser.id, isActive: true } } }
          ]
        };

    const conditions: Prisma.GroupWhereInput[] = [scope];
    if (search) conditions.push({ name: { contains: search } });
    if (status) conditions.push({ status });
    if (supervisorId) conditions.push({ supervisorId });

    const where: Prisma.GroupWhereInput = { AND: conditions };

    const [total, rows] = await Promise.all([
      prisma.group.count({ where }),
      prisma.group.findMany({
        where,
        include: {
          supervisor: { select: { id: true, name: true, email: true } },
          _count: { select: { memberships: { where: { isActive: true } } } }
        },
        orderBy: { [sortBy]: sortDir },
        ...(paginated ? { skip, take } : {})
      })
    ]);

    const orders = await prisma.groupOrder.findMany({
      where: { userId: sessionUser.id, groupId: { in: rows.map((group) => group.id) } },
      select: { groupId: true, position: true }
    });
    const positionOf = new Map(orders.map((order) => [order.groupId, order.position]));

    const sorted = paginated
      ? rows
      : [...rows].sort((a, b) => {
          const positionA = positionOf.get(a.id);
          const positionB = positionOf.get(b.id);
          if (positionA !== undefined && positionB !== undefined) return positionA - positionB;
          if (positionA !== undefined) return -1;
          if (positionB !== undefined) return 1;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });

    const ownedCount = requireSupervisorOrAdmin(sessionUser)
      ? await prisma.group.count({ where: { supervisorId: sessionUser.id } })
      : 0;

    return ok(res, {
      groups: sorted.map((group) => ({
        id: group.id,
        name: group.name,
        supervisor: group.supervisor,
        status: group.status,
        memberCount: group._count.memberships,
        createdAt: group.createdAt.toISOString()
      })),
      meta: buildPageMeta(page, pageSize, total),
      limits: {
        maxGroups: groupConfig.maxGroupsPerSupervisor,
        ownedCount,
        canCreate:
          isAdmin ||
          (requireSupervisorOrAdmin(sessionUser) && ownedCount < groupConfig.maxGroupsPerSupervisor)
      }
    });
  }

  if (req.method === 'POST') {
    if (!requireSupervisorOrAdmin(sessionUser)) {
      return forbidden(res, strings.errors.supervisorOnly);
    }

    const { name, supervisorEmail, status } = req.body as {
      name?: string;
      supervisorEmail?: string;
      status?: string;
    };

    const trimmedName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
    if (!trimmedName) {
      return badRequest(res, strings.groups.nameRequired);
    }
    if (trimmedName.length > groupConfig.maxNameLength) {
      return badRequest(res, strings.groups.nameTooLong(groupConfig.maxNameLength));
    }

    let supervisorId = sessionUser.id;

    if (requireAdmin(sessionUser)) {
      if (!supervisorEmail) {
        return badRequest(res, strings.groups.supervisorEmailRequired);
      }
      const supervisor = await prisma.user.findUnique({ where: { email: normalizeEmail(supervisorEmail) } });
      if (!supervisor) {
        return notFound(res, strings.groups.supervisorNotFound);
      }
      if (!requireSupervisorOrAdmin(supervisor)) {
        return badRequest(res, strings.groups.notASupervisor);
      }
      supervisorId = supervisor.id;
    }

    const capacity = await canCreateGroup(supervisorId);
    if (!capacity.ok) {
      return conflict(res, capacity.error);
    }

    const group = await prisma.group.create({
      data: {
        name: trimmedName,
        supervisorId,
        status: status === GROUP_STATUS.INACTIVE ? GROUP_STATUS.INACTIVE : GROUP_STATUS.ACTIVE,
        mealWeightBreakfast: groupConfig.mealWeightBreakfast,
        mealWeightLunch: groupConfig.mealWeightLunch,
        mealWeightDinner: groupConfig.mealWeightDinner,
        publishedAt: new Date(),
        memberships: { create: { userId: supervisorId, isActive: true, publishedAt: new Date() } }
      }
    });

    return created(res, { group });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler);
