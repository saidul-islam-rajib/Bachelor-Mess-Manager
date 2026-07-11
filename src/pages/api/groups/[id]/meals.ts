import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { dayToUtcDate, parseMonth, todayKey, utcDateToDay } from '@/lib/month';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const groupId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!groupId) {
    return badRequest(res, 'Group ID is required.');
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return notFound(res, 'Group not found.');
  }

  const admin = requireAdmin(sessionUser);
  const isMember = await isGroupMember(groupId, sessionUser.id);
  if (!isMember && !admin) {
    return forbidden(res, 'You are not a member of this group.');
  }

  if (req.method === 'GET') {
    const monthKey = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
    const { start, nextStart } = parseMonth(monthKey);

    const memberships = await prisma.membership.findMany({
      where: { groupId, isActive: true },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    const members = memberships.map((m) => m.user);

    const rows = await prisma.mealEntry.findMany({
      where: { groupId, date: { gte: start, lt: nextStart } }
    });
    const entries = rows.map((r) => ({
      userId: r.userId,
      date: utcDateToDay(r.date),
      breakfast: r.breakfastCount,
      lunch: r.lunchCount,
      dinner: r.dinnerCount
    }));

    return ok(res, {
      members,
      weights: {
        breakfast: group.mealWeightBreakfast,
        lunch: group.mealWeightLunch,
        dinner: group.mealWeightDinner
      },
      entries
    });
  }

  if (req.method === 'PUT') {
    const body = req.body as {
      date?: string;
      breakfast?: number;
      lunch?: number;
      dinner?: number;
      userId?: string;
    };

    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return badRequest(res, 'A valid date (YYYY-MM-DD) is required.');
    }

    // Members set their own meals; only an admin may edit another member's row.
    const targetUserId = admin && body.userId ? body.userId : sessionUser.id;
    if (targetUserId !== sessionUser.id && !admin) {
      return forbidden(res, 'You can only edit your own meals.');
    }

    // Past dates are locked for everyone except admins.
    if (!admin && body.date < todayKey()) {
      return forbidden(res, 'Past dates are locked. You can only edit today or upcoming days.');
    }

    const targetIsMember = await isGroupMember(groupId, targetUserId);
    if (!targetIsMember) {
      return badRequest(res, 'That user is not a member of this group.');
    }

    const breakfast = Math.max(0, Math.trunc(Number(body.breakfast ?? 0)));
    const lunch = Math.max(0, Math.trunc(Number(body.lunch ?? 0)));
    const dinner = Math.max(0, Math.trunc(Number(body.dinner ?? 0)));
    const date = dayToUtcDate(body.date);

    const entry = await prisma.mealEntry.upsert({
      where: { userId_groupId_date: { userId: targetUserId, groupId, date } },
      update: { breakfastCount: breakfast, lunchCount: lunch, dinnerCount: dinner, totalMeals: breakfast + lunch + dinner },
      create: {
        userId: targetUserId,
        groupId,
        date,
        breakfastCount: breakfast,
        lunchCount: lunch,
        dinnerCount: dinner,
        totalMeals: breakfast + lunch + dinner
      }
    });

    return ok(res, {
      entry: {
        userId: entry.userId,
        date: utcDateToDay(entry.date),
        breakfast: entry.breakfastCount,
        lunch: entry.lunchCount,
        dinner: entry.dinnerCount
      }
    });
  }

  return methodNotAllowed(res, ['GET', 'PUT']);
}
