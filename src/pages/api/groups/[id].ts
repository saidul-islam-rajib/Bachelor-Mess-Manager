import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const groupId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!groupId) {
    return badRequest(res, 'Group ID is required.');
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      supervisor: { select: { id: true, name: true, email: true } },
      memberships: {
        where: { isActive: true },
        include: { user: { select: { id: true, name: true, email: true } } }
      }
    }
  });

  if (!group) {
    return notFound(res, 'Group not found.');
  }

  if (req.method === 'GET') {
    const isMember = await isGroupMember(groupId, sessionUser.id);
    if (!isMember && !requireAdmin(sessionUser)) {
      return forbidden(res, 'You are not a member of this group.');
    }
    return ok(res, { group });
  }

  if (req.method === 'PATCH') {
    if (group.supervisorId !== sessionUser.id && !requireAdmin(sessionUser)) {
      return forbidden(res, 'Only this group\'s supervisor can update it.');
    }

    const { name, status, mealWeightBreakfast, mealWeightLunch, mealWeightDinner } = req.body as {
      name?: string;
      status?: string;
      mealWeightBreakfast?: number;
      mealWeightLunch?: number;
      mealWeightDinner?: number;
    };

    const data: Record<string, unknown> = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (status === 'ACTIVE' || status === 'INACTIVE') data.status = status;
    for (const [key, value] of [
      ['mealWeightBreakfast', mealWeightBreakfast],
      ['mealWeightLunch', mealWeightLunch],
      ['mealWeightDinner', mealWeightDinner]
    ] as const) {
      if (value !== undefined) {
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) {
          return badRequest(res, 'Meal weights must be zero or a positive number.');
        }
        data[key] = num;
      }
    }

    if (Object.keys(data).length === 0) {
      return badRequest(res, 'Nothing to update.');
    }

    const updated = await prisma.group.update({ where: { id: groupId }, data });
    return ok(res, { group: updated });
  }

  return methodNotAllowed(res, ['GET', 'PATCH']);
}
