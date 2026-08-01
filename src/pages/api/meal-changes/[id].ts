import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser } from '@/lib/auth-utils';
import { badRequest, conflict, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { NOTIFICATION_TYPES, REQUEST_STATUS } from '@/lib/constants';
import { notifyGroup, notifyUsers } from '@/lib/notifications';
import { ROUTES } from '@/lib/routes';
import { describeChange, serializeChangeRequest } from '@/lib/meal-edits';
import { utcDateToDay } from '@/lib/month';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) {
    return badRequest(res, 'Request ID is required.');
  }

  const request = await prisma.mealChangeRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true } }
    }
  });

  if (!request) {
    return notFound(res, 'That meal change request no longer exists.');
  }

  const canManage = await canManageGroup(request.groupId, sessionUser);

  if (req.method === 'DELETE') {
    if (request.userId !== sessionUser.id && !canManage) {
      return forbidden(res, 'You can only withdraw your own request.');
    }
    if (request.status !== REQUEST_STATUS.PENDING) {
      return conflict(res, 'That request has already been decided.');
    }

    await prisma.mealChangeRequest.update({
      where: { id },
      data: { status: REQUEST_STATUS.CANCELLED, decidedById: sessionUser.id, decidedAt: new Date() }
    });

    return ok(res, { status: REQUEST_STATUS.CANCELLED });
  }

  if (req.method === 'PATCH') {
    if (!canManage) {
      return forbidden(res, 'Only this group’s supervisor can decide meal change requests.');
    }
    if (request.status !== REQUEST_STATUS.PENDING) {
      return conflict(res, 'That request has already been decided.');
    }

    const { status, note } = req.body as { status?: string; note?: string };
    if (status !== REQUEST_STATUS.APPROVED && status !== REQUEST_STATUS.REJECTED) {
      return badRequest(res, 'Status must be APPROVED or REJECTED.');
    }

    const decisionNote = typeof note === 'string' ? note.trim().slice(0, 300) || null : null;
    const from = { breakfast: request.fromBreakfast, lunch: request.fromLunch, dinner: request.fromDinner };
    const to = { breakfast: request.toBreakfast, lunch: request.toLunch, dinner: request.toDinner };
    const day = utcDateToDay(request.date);

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.mealChangeRequest.update({
        where: { id },
        data: { status, decidedById: sessionUser.id, decidedAt: new Date(), decisionNote },
        include: {
          user: { select: { id: true, name: true } },
          decidedBy: { select: { id: true, name: true } }
        }
      });

      if (status === REQUEST_STATUS.APPROVED) {
        const totalMeals = to.breakfast + to.lunch + to.dinner;
        await tx.mealEntry.upsert({
          where: { userId_groupId_date: { userId: request.userId, groupId: request.groupId, date: request.date } },
          update: {
            breakfastCount: to.breakfast,
            lunchCount: to.lunch,
            dinnerCount: to.dinner,
            totalMeals,
            fromPlan: false
          },
          create: {
            userId: request.userId,
            groupId: request.groupId,
            date: request.date,
            breakfastCount: to.breakfast,
            lunchCount: to.lunch,
            dinnerCount: to.dinner,
            totalMeals,
            fromPlan: false,
            publishedAt: new Date()
          }
        });
      }

      return row;
    });

    await notifyUsers([request.user], {
      type:
        status === REQUEST_STATUS.APPROVED
          ? NOTIFICATION_TYPES.MEAL_CHANGE_APPROVED
          : NOTIFICATION_TYPES.MEAL_CHANGE_REJECTED,
      title:
        status === REQUEST_STATUS.APPROVED
          ? `Your meal change for ${day} was approved`
          : `Your meal change for ${day} was declined`,
      body: decisionNote ?? `${describeChange(from, to)} — decided by ${sessionUser.name}.`,
      link: ROUTES.meals,
      groupId: request.groupId,
      actorId: sessionUser.id
    });

    if (status === REQUEST_STATUS.APPROVED) {
      await notifyGroup(
        request.groupId,
        {
          type: NOTIFICATION_TYPES.MEAL_CHANGED_BY_SUPERVISOR,
          title: `${request.user.name}’s meals for ${day} were changed`,
          body: `${describeChange(from, to)}, approved by ${sessionUser.name}. This changes the meal rate and everyone’s share for ${request.group.name}.`,
          link: ROUTES.meals,
          actorId: sessionUser.id
        },
        { excludeUserId: request.userId }
      );
    }

    return ok(res, { request: serializeChangeRequest(updated) });
  }

  return methodNotAllowed(res, ['PATCH', 'DELETE']);
}

export default withAudit(handler);
