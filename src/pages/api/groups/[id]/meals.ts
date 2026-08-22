import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, conflict, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { dayToUtcDate, parseMonth, todayKey, utcDateToDay } from '@/lib/month';
import { syncPlansForMonth } from '@/lib/meal-plan';
import { GROUP_STATUS, NOTIFICATION_TYPES, REQUEST_STATUS } from '@/lib/constants';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { strings } from '@/lib/i18n';
import { notifyGroup, notifyUsers } from '@/lib/notifications';
import { ROUTES } from '@/lib/routes';
import {
  applyMealCounts,
  countsEqual,
  currentCounts,
  describeChange,
  readEditWindow,
  serializeChangeRequest,
  type MealCounts
} from '@/lib/meal-edits';
import { withAudit } from '@/lib/with-audit';

const MEAL_FIELDS = ['breakfast', 'lunch', 'dinner'] as const;

function normalizeCounts(body: { breakfast?: unknown; lunch?: unknown; dinner?: unknown }): MealCounts {
  const clamp = (value: unknown) => Math.min(9, Math.max(0, Math.trunc(Number(value ?? 0)) || 0));
  return { breakfast: clamp(body.breakfast), lunch: clamp(body.lunch), dinner: clamp(body.dinner) };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    if (!hasPermission(sessionUser, PERMISSIONS.MEAL_VIEW)) {
      return forbidden(res, strings.errors.permissionDenied);
    }

    const monthKey = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
    const { start, nextStart } = parseMonth(monthKey);
    await syncPlansForMonth(groupId, monthKey);

    const [memberships, rows, editWindow, pendingChanges] = await Promise.all([
      prisma.membership.findMany({
        where: { groupId, isActive: true },
        include: { user: { select: { id: true, name: true, email: true } } }
      }),
      prisma.mealEntry.findMany({ where: { groupId, date: { gte: start, lt: nextStart } } }),
      readEditWindow(sessionUser.id, groupId),
      prisma.mealChangeRequest.findMany({
        where: { groupId, status: REQUEST_STATUS.PENDING, date: { gte: start, lt: nextStart } },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const canManage = await canManageGroup(groupId, sessionUser);

    return ok(res, {
      canManage,
      currentUserId: sessionUser.id,
      groupStatus: group.status,
      members: memberships.map((m) => m.user),
      weights: {
        breakfast: group.mealWeightBreakfast,
        lunch: group.mealWeightLunch,
        dinner: group.mealWeightDinner
      },
      entries: rows.map((r) => ({
        userId: r.userId,
        date: utcDateToDay(r.date),
        breakfast: r.breakfastCount,
        lunch: r.lunchCount,
        dinner: r.dinnerCount
      })),
      editWindow,
      pendingChanges: pendingChanges
        .filter((row) => canManage || row.userId === sessionUser.id)
        .map(serializeChangeRequest)
    });
  }

  if (req.method === 'PUT') {
    const body = req.body as { date?: string; userId?: string; reason?: string };

    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return badRequest(res, 'A valid date (YYYY-MM-DD) is required.');
    }

    if (group.status === GROUP_STATUS.INACTIVE) {
      return forbidden(res, 'This mess is closed. Ask an admin to reopen it before changing meals.');
    }

    const canManage = await canManageGroup(groupId, sessionUser);
    const targetUserId = (canManage || admin) && body.userId ? body.userId : sessionUser.id;

    if (targetUserId !== sessionUser.id && !canManage && !admin) {
      return forbidden(res, 'You can only edit your own meals.');
    }

    const needed =
      targetUserId === sessionUser.id ? PERMISSIONS.MEAL_RECORD_OWN : PERMISSIONS.MEAL_RECORD_ANY;
    if (!hasPermission(sessionUser, needed)) {
      return forbidden(res, strings.errors.permissionDenied);
    }
    if (!(await isGroupMember(groupId, targetUserId))) {
      return badRequest(res, 'That user is not a member of this group.');
    }

    const date = dayToUtcDate(body.date);
    const isPast = body.date < todayKey();
    const next = normalizeCounts(req.body as Record<string, unknown>);
    const previous = await currentCounts(targetUserId, groupId, date);

    if (!isPast || canManage || admin) {
      const entry = await applyMealCounts(targetUserId, groupId, date, next);

      if (isPast && !countsEqual(previous, next)) {
        const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { name: true } });
        const whose = targetUserId === sessionUser.id ? `their own` : `${target?.name ?? 'a member'}’s`;

        await notifyGroup(
          groupId,
          {
            type: NOTIFICATION_TYPES.MEAL_CHANGED_BY_SUPERVISOR,
            title: `${sessionUser.name} changed ${whose} meals for ${body.date}`,
            excerpt: `${describeChange(previous, next)}. This changes the meal rate and everyone’s share for ${group.name}.`,
            link: ROUTES.meals,
            actorId: sessionUser.id
          },
          { excludeUserId: sessionUser.id }
        );
      }

      return ok(res, {
        applied: true,
        entry: {
          userId: entry.userId,
          date: utcDateToDay(entry.date),
          breakfast: entry.breakfastCount,
          lunch: entry.lunchCount,
          dinner: entry.dinnerCount
        }
      });
    }

    const editWindow = await readEditWindow(sessionUser.id, groupId);
    if (!editWindow.open) {
      return forbidden(
        res,
        'Past days are locked. Turn on "Edit my past meals" in your profile first, then make the change.'
      );
    }

    if (countsEqual(previous, next)) {
      return ok(res, { applied: false, unchanged: true });
    }

    if (!editWindow.requiresApproval) {
      const entry = await applyMealCounts(targetUserId, groupId, date, next);

      await notifyGroup(
        groupId,
        {
          type: NOTIFICATION_TYPES.MEAL_CHANGED_BY_SUPERVISOR,
          title: `${sessionUser.name} changed their meals for ${body.date}`,
          excerpt: `${describeChange(previous, next)}. This changes the meal rate and everyone’s share for ${group.name}.`,
          link: ROUTES.meals,
          actorId: sessionUser.id
        },
        { excludeUserId: sessionUser.id }
      );

      return ok(res, {
        applied: true,
        entry: {
          userId: entry.userId,
          date: utcDateToDay(entry.date),
          breakfast: entry.breakfastCount,
          lunch: entry.lunchCount,
          dinner: entry.dinnerCount
        }
      });
    }

    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) || null : null;
    const pendingFields = {
      fromBreakfast: previous.breakfast,
      fromLunch: previous.lunch,
      fromDinner: previous.dinner,
      toBreakfast: next.breakfast,
      toLunch: next.lunch,
      toDinner: next.dinner,
      reason
    };

    const existing = await prisma.mealChangeRequest.findFirst({
      where: { groupId, userId: targetUserId, date, status: REQUEST_STATUS.PENDING }
    });

    if (existing) {
      const existingFrom = { breakfast: existing.fromBreakfast, lunch: existing.fromLunch, dinner: existing.fromDinner };
      const existingTo = { breakfast: existing.toBreakfast, lunch: existing.toLunch, dinner: existing.toDinner };
      const changedFields = MEAL_FIELDS.filter((f) => next[f] !== previous[f]);
      const conflictingFields = changedFields.filter((f) => existingFrom[f] !== existingTo[f]);

      if (conflictingFields.length > 0) {
        return conflict(res, strings.meals.alreadyPendingError);
      }

      const mergedTo = { ...existingTo };
      for (const f of changedFields) mergedTo[f] = next[f];

      const merged = await prisma.mealChangeRequest.update({
        where: { id: existing.id },
        data: {
          toBreakfast: mergedTo.breakfast,
          toLunch: mergedTo.lunch,
          toDinner: mergedTo.dinner,
          reason: reason ?? existing.reason,
          updatedById: sessionUser.id
        },
        include: { user: { select: { id: true, name: true } } }
      });

      const mergedSupervisor = await prisma.user.findUnique({
        where: { id: group.supervisorId },
        select: { id: true, name: true, email: true }
      });

      if (mergedSupervisor && mergedSupervisor.id !== sessionUser.id) {
        await notifyUsers([mergedSupervisor], {
          type: NOTIFICATION_TYPES.MEAL_CHANGE_REQUESTED,
          title: `${sessionUser.name} asked to change meals for ${body.date}`,
          excerpt: `${describeChange(existingFrom, mergedTo)}. Nothing changes in ${group.name} until you approve it on the meals page.`,
          link: ROUTES.meals,
          groupId,
          actorId: sessionUser.id
        });
      }

      return created(res, { applied: false, pending: true, request: serializeChangeRequest(merged) });
    }

    const request = await prisma.mealChangeRequest.create({
      data: {
        userId: targetUserId,
        groupId,
        date,
        ...pendingFields,
        status: REQUEST_STATUS.PENDING,
        publishedAt: new Date()
      },
      include: { user: { select: { id: true, name: true } } }
    });

    const supervisor = await prisma.user.findUnique({
      where: { id: group.supervisorId },
      select: { id: true, name: true, email: true }
    });

    if (supervisor && supervisor.id !== sessionUser.id) {
      await notifyUsers([supervisor], {
        type: NOTIFICATION_TYPES.MEAL_CHANGE_REQUESTED,
        title: `${sessionUser.name} asked to change meals for ${body.date}`,
        excerpt: `${describeChange(previous, next)}. Nothing changes in ${group.name} until you approve it on the meals page.`,
        link: ROUTES.meals,
        groupId,
        actorId: sessionUser.id
      });
    }

    return created(res, { applied: false, pending: true, request: serializeChangeRequest(request) });
  }

  return methodNotAllowed(res, ['GET', 'PUT']);
}

export default withAudit(handler);
