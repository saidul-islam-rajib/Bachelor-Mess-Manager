import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { GROUP_STATUS_VALUES, MEAL_RATE_MODE_VALUES } from '@/lib/constants';
import { deleteGroupPermanently } from '@/lib/hard-delete';
import {
  getMealEditPolicy,
  SUPERVISORS_PER_GROUP_MAX,
  SUPERVISORS_PER_GROUP_MIN
} from '@/lib/settings-service';
import { listSupervisors } from '@/lib/supervisors';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    return ok(res, {
      group,
      mealEditPolicy: await getMealEditPolicy(groupId),
      supervisors: await listSupervisors(groupId)
    });
  }

  if (req.method === 'PATCH') {
    if (!(await canManageGroup(groupId, sessionUser))) {
      return forbidden(res, strings.groups.onlySupervisorOrAdmin);
    }

    const {
      name,
      status,
      mealWeightBreakfast,
      mealWeightLunch,
      mealWeightDinner,
      mealRateMode,
      carryForwardEnabled,
      mealEditRequiresApproval,
      maxSupervisors
    } = req.body as {
      name?: string;
      status?: string;
      mealWeightBreakfast?: number;
      mealWeightLunch?: number;
      mealWeightDinner?: number;
      mealRateMode?: string;
      carryForwardEnabled?: boolean;
      mealEditRequiresApproval?: boolean | null;
      maxSupervisors?: number | null;
    };

    const data: Record<string, unknown> = {};
    if (maxSupervisors !== undefined) {
      if (!requireAdmin(sessionUser)) {
        return forbidden(res, 'Only an admin can change how many supervisors a mess may have.');
      }

      if (maxSupervisors === null) {
        data.maxSupervisors = null;
      } else {
        const cap = Number(maxSupervisors);
        if (!Number.isInteger(cap) || cap < SUPERVISORS_PER_GROUP_MIN || cap > SUPERVISORS_PER_GROUP_MAX) {
          return badRequest(
            res,
            `A mess can have between ${SUPERVISORS_PER_GROUP_MIN} and ${SUPERVISORS_PER_GROUP_MAX} supervisors.`
          );
        }

        const current = (await listSupervisors(groupId)).supervisors.length;
        if (current > cap) {
          return badRequest(
            res,
            `This mess already has ${current} supervisors. Remove one before lowering the limit to ${cap}.`
          );
        }
        data.maxSupervisors = cap;
      }
    }
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (mealEditRequiresApproval !== undefined) {
      if (mealEditRequiresApproval !== null && typeof mealEditRequiresApproval !== 'boolean') {
        return badRequest(res, 'Past-meal approval must be on, off, or left to the site default.');
      }
      data.mealEditRequiresApproval = mealEditRequiresApproval;
    }
    if (typeof status === 'string' && GROUP_STATUS_VALUES.includes(status)) data.status = status;
    if (mealRateMode !== undefined) {
      if (!MEAL_RATE_MODE_VALUES.includes(mealRateMode)) {
        return badRequest(res, 'The meal rate must be worked out monthly or daily.');
      }
      data.mealRateMode = mealRateMode;
    }
    if (typeof carryForwardEnabled === 'boolean') data.carryForwardEnabled = carryForwardEnabled;
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

  if (req.method === 'DELETE') {
    if (!requireAdmin(sessionUser)) {
      return forbidden(res, strings.errors.adminOnly);
    }

    await deleteGroupPermanently(groupId);
    return ok(res, { deleted: true, name: group.name });
  }

  return methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
}

export default withAudit(handler);
