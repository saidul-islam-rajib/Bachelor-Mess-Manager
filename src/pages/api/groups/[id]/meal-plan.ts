import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isGroupMember } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { applyPlanToUpcoming, emptyPlanDays, type PlanDay } from '@/lib/meal-plan';
import { dayToUtcDate, todayKey, utcDateToDay } from '@/lib/month';
import { withAudit } from '@/lib/with-audit';

const MAX_PER_MEAL = 10;
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const groupId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!groupId) {
    return badRequest(res, 'Group ID is required.');
  }

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) {
    return notFound(res, 'Group not found.');
  }

  if (!(await isGroupMember(groupId, sessionUser.id))) {
    return forbidden(res, 'You are not a member of this group.');
  }

  const userId = sessionUser.id;

  if (req.method === 'GET') {
    const plan = await prisma.mealPlan.findUnique({
      where: { userId_groupId: { userId, groupId } },
      include: { days: true }
    });

    if (!plan) {
      return ok(res, { plan: { isActive: false, startDate: todayKey(), days: emptyPlanDays() } });
    }
    const byWeekday = new Map(plan.days.map((d) => [d.weekday, d]));
    const days = emptyPlanDays().map((d) => {
      const saved = byWeekday.get(d.weekday);
      return saved
        ? {
            weekday: saved.weekday,
            enabled: saved.enabled,
            breakfast: saved.breakfast,
            lunch: saved.lunch,
            dinner: saved.dinner
          }
        : d;
    });

    return ok(res, {
      plan: { isActive: plan.isActive, startDate: utcDateToDay(plan.startDate), days }
    });
  }

  if (req.method === 'PUT') {
    const body = req.body as { isActive?: boolean; days?: PlanDay[]; overwriteEdited?: boolean };

    if (!Array.isArray(body.days) || body.days.length !== 7) {
      return badRequest(res, 'All seven weekdays are required.');
    }

    const seen = new Set<number>();
    const days: PlanDay[] = [];
    for (const raw of body.days) {
      const weekday = Number(raw?.weekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        return badRequest(res, 'Weekday must be 0 (Sunday) through 6 (Saturday).');
      }
      if (seen.has(weekday)) {
        return badRequest(res, 'Each weekday may only appear once.');
      }
      seen.add(weekday);

      const counts = (['breakfast', 'lunch', 'dinner'] as const).map((field) => {
        const value = Math.trunc(Number(raw?.[field] ?? 0));
        return Number.isFinite(value) ? Math.min(MAX_PER_MEAL, Math.max(0, value)) : 0;
      });

      days.push({
        weekday,
        enabled: Boolean(raw?.enabled),
        breakfast: counts[0],
        lunch: counts[1],
        dinner: counts[2]
      });
    }

    const isActive = body.isActive !== false;
    const existing = await prisma.mealPlan.findUnique({
      where: { userId_groupId: { userId, groupId } },
      select: { id: true }
    });
    const plan = existing
      ? await prisma.mealPlan.update({ where: { id: existing.id }, data: { isActive } })
      : await prisma.mealPlan.create({
          data: { userId, groupId, isActive, startDate: dayToUtcDate(todayKey()) }
        });

    await prisma.mealPlanDay.deleteMany({ where: { planId: plan.id } });
    await prisma.mealPlanDay.createMany({
      data: days.map((d) => ({ planId: plan.id, ...d }))
    });

    const { filled } = await applyPlanToUpcoming(userId, groupId, {
      overwriteEdited: body.overwriteEdited === true
    });

    return ok(res, {
      plan: { isActive: plan.isActive, startDate: utcDateToDay(plan.startDate), days },
      filled
    });
  }

  return methodNotAllowed(res, ['GET', 'PUT']);
}

export default withAudit(handler);
