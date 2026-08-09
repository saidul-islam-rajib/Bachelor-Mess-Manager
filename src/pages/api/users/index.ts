import type { NextApiRequest, NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { PERMISSION_EFFECTS } from '@/lib/user-permissions';
import {
  SORT_DIRECTIONS,
  USER_ROLE_VALUES,
  USER_SORT_FIELDS,
  USER_STATUS,
  USER_STATUS_VALUES,
  type UserSortField
} from '@/lib/constants';
import { buildPageMeta, queryBoolean, queryEnum, queryPagination, queryString } from '@/lib/query';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

const SEARCHABLE_FIELDS = ['name', 'email', 'phone'];

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, strings.errors.unauthorized);
  }
  if (!hasPermission(sessionUser, PERMISSIONS.USER_VIEW)) {
    return forbidden(res, strings.errors.adminOnly);
  }

  const search = queryString(req, 'search');
  const role = queryEnum(req, 'role', USER_ROLE_VALUES as string[]);
  const status = queryEnum(req, 'status', USER_STATUS_VALUES as string[]);
  const groupId = queryString(req, 'groupId');
  const supervisorId = queryString(req, 'supervisorId');
  const hasGroup = queryBoolean(req, 'hasGroup');
  const sortBy = (queryEnum(req, 'sortBy', USER_SORT_FIELDS) ?? 'createdAt') as UserSortField;
  const sortDir = queryEnum(req, 'sortDir', [SORT_DIRECTIONS.ASC, SORT_DIRECTIONS.DESC]) ?? SORT_DIRECTIONS.DESC;
  const { page, pageSize, skip, take } = queryPagination(req);

  const where: Prisma.UserWhereInput = {};
  const conditions: Prisma.UserWhereInput[] = [];

  if (role) where.role = role;
  where.status = status ?? { not: USER_STATUS.UNVERIFIED };

  if (search) {
    conditions.push({ OR: SEARCHABLE_FIELDS.map((field) => ({ [field]: { contains: search } })) });
  }

  if (groupId) {
    conditions.push({ memberships: { some: { groupId, isActive: true } } });
  }

  if (supervisorId) {
    conditions.push({
      OR: [
        { memberships: { some: { isActive: true, group: { supervisorId } } } },
        { groupsSupervised: { some: { supervisorId } } }
      ]
    });
  }

  if (hasGroup === true) {
    conditions.push({ memberships: { some: { isActive: true } } });
  } else if (hasGroup === false) {
    conditions.push({ memberships: { none: { isActive: true } } });
  }

  if (conditions.length > 0) {
    where.AND = conditions;
  }

  const orderBy: Prisma.UserOrderByWithRelationInput = { [sortBy]: sortDir };

  const [total, rows, roleFacets, statusFacets] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        profileImage: true,
        lastLoginAt: true,
        createdAt: true,
        memberships: {
          where: { isActive: true },
          select: { group: { select: { id: true, name: true, supervisor: { select: { id: true, name: true } } } } }
        },
        groupsSupervised: { select: { id: true, name: true } },
        permissionOverrides: { select: { effect: true } }
      }
    }),
    prisma.user.groupBy({
      by: ['role'],
      where: { status: { not: USER_STATUS.UNVERIFIED } },
      _count: { _all: true }
    }),
    prisma.user.groupBy({
      by: ['status'],
      where: { status: { not: USER_STATUS.UNVERIFIED } },
      _count: { _all: true }
    })
  ]);

  const users = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    phone: row.phone,
    profileImage: row.profileImage,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    groups: row.memberships.map((membership) => ({
      id: membership.group.id,
      name: membership.group.name,
      supervisor: membership.group.supervisor
    })),
    supervisedGroups: row.groupsSupervised,
    permissionOverrides: {
      added: row.permissionOverrides.filter((override) => override.effect === PERMISSION_EFFECTS.ALLOW).length,
      blocked: row.permissionOverrides.filter((override) => override.effect === PERMISSION_EFFECTS.DENY).length
    }
  }));

  return ok(res, {
    users,
    meta: buildPageMeta(page, pageSize, total),
    facets: {
      roles: Object.fromEntries(roleFacets.map((row) => [row.role, row._count._all])),
      statuses: Object.fromEntries(statusFacets.map((row) => [row.status, row._count._all]))
    }
  });
}

export default withAudit(handler);
