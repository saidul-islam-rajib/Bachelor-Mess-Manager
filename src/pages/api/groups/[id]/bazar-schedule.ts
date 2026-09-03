import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { computeEqualSplitDays } from '@/lib/bazar-schedule';
import { daysInMonth, parseMonth } from '@/lib/month';
import { GROUP_CLOSED_MESSAGE, isGroupWritable } from '@/lib/groups';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

type LockedReason = 'GROUP_CLOSED' | 'MONTH_CLOSED' | 'NO_MEMBERS' | null;

async function isMonthClosed(groupId: string, monthKey: string): Promise<boolean> {
  const closing = await prisma.monthClosing.findFirst({
    where: { groupId, monthKey, reopenedAt: null },
    select: { id: true }
  });
  return Boolean(closing);
}

async function ensureSchedule(groupId: string, monthKey: string, totalDays: number): Promise<string> {
  const schedule = await prisma.bazarSchedule.upsert({
    where: { groupId_monthKey: { groupId, monthKey } },
    update: {},
    create: { groupId, monthKey, publishedAt: new Date() }
  });

  const dayCount = await prisma.bazarDutyDay.count({ where: { scheduleId: schedule.id } });
  if (dayCount > 0) return schedule.id;

  const activeMembers = await prisma.membership.findMany({
    where: { groupId, isActive: true },
    orderBy: { joinedAt: 'asc' },
    select: { userId: true }
  });
  if (activeMembers.length === 0) return schedule.id;

  const defaultAssignments = computeEqualSplitDays(
    activeMembers.map((m) => m.userId),
    totalDays
  );

  await prisma.$transaction(
    defaultAssignments.map((assignment) =>
      prisma.bazarDutyDay.upsert({
        where: { scheduleId_day: { scheduleId: schedule.id, day: assignment.day } },
        update: {},
        create: { scheduleId: schedule.id, day: assignment.day, userId: assignment.userId, publishedAt: new Date() }
      })
    )
  );

  return schedule.id;
}

async function loadSchedule(
  groupId: string,
  group: { status: string },
  monthKey: string,
  currentUserId: string,
  canManage: boolean
) {
  const totalDays = daysInMonth(monthKey).length;
  const scheduleId = await ensureSchedule(groupId, monthKey, totalDays);

  const [activeMembers, dayRows, groupClosed, monthClosed] = await Promise.all([
    prisma.membership.findMany({
      where: { groupId, isActive: true },
      orderBy: { joinedAt: 'asc' },
      select: { user: { select: { id: true, name: true } } }
    }),
    prisma.bazarDutyDay.findMany({
      where: { scheduleId },
      select: { id: true, day: true, userId: true, user: { select: { id: true, name: true } } }
    }),
    Promise.resolve(!isGroupWritable(group)),
    isMonthClosed(groupId, monthKey)
  ]);

  const activeIds = new Set(activeMembers.map((m) => m.user.id));

  const staleIds = dayRows.filter((row) => row.userId && !activeIds.has(row.userId)).map((row) => row.id);
  if (staleIds.length > 0) {
    await prisma.bazarDutyDay.updateMany({ where: { id: { in: staleIds } }, data: { userId: null } });
  }
  const staleSet = new Set(staleIds);

  const dayByNumber = new Map<number, { userId: string | null; userName: string | null }>();
  for (const row of dayRows) {
    const cleared = staleSet.has(row.id);
    dayByNumber.set(row.day, cleared ? { userId: null, userName: null } : { userId: row.userId, userName: row.user?.name ?? null });
  }

  const dateKeys = daysInMonth(monthKey);
  const days = dateKeys.map((date, index) => {
    const day = index + 1;
    const entry = dayByNumber.get(day);
    return { day, date, userId: entry?.userId ?? null, userName: entry?.userName ?? null };
  });

  const dayCountByMember = new Map<string, number>();
  const firstDayByMember = new Map<string, number>();
  for (const day of days) {
    if (!day.userId) continue;
    dayCountByMember.set(day.userId, (dayCountByMember.get(day.userId) ?? 0) + 1);
    if (!firstDayByMember.has(day.userId)) firstDayByMember.set(day.userId, day.day);
  }

  // The rotation reads top to bottom in calendar order, so whoever shops first is listed
  // first. Reordering the list therefore moves a member's turn, not just their row.
  const members = activeMembers
    .map((m) => ({
      id: m.user.id,
      name: m.user.name,
      dayCount: dayCountByMember.get(m.user.id) ?? 0,
      firstDay: firstDayByMember.get(m.user.id) ?? Number.MAX_SAFE_INTEGER
    }))
    .sort((a, b) => (a.firstDay !== b.firstDay ? a.firstDay - b.firstDay : a.name.localeCompare(b.name)))
    .map(({ firstDay: _firstDay, ...member }) => member);

  let lockedReason: LockedReason = null;
  if (activeMembers.length === 0) lockedReason = 'NO_MEMBERS';
  else if (groupClosed) lockedReason = 'GROUP_CLOSED';
  else if (monthClosed) lockedReason = 'MONTH_CLOSED';

  return {
    monthKey,
    totalDays,
    editable: lockedReason === null,
    lockedReason,
    canManage,
    currentUserId,
    members,
    days
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);
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

  if (!(await isGroupMember(groupId, sessionUser.id)) && !requireAdmin(sessionUser)) {
    return forbidden(res, 'You are not a member of this group.');
  }
  const canManage = await canManageGroup(groupId, sessionUser);

  const monthParam = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
  const { key: monthKey } = parseMonth(monthParam);

  if (req.method === 'GET') {
    if (!hasPermission(sessionUser, PERMISSIONS.EXPENSE_VIEW)) {
      return forbidden(res, strings.errors.permissionDenied);
    }

    return ok(res, await loadSchedule(groupId, group, monthKey, sessionUser.id, canManage));
  }

  if (req.method === 'PUT') {
    if (!hasPermission(sessionUser, PERMISSIONS.EXPENSE_CREATE)) {
      return forbidden(res, strings.errors.permissionDenied);
    }
    if (!isGroupWritable(group)) {
      return forbidden(res, GROUP_CLOSED_MESSAGE);
    }
    if (await isMonthClosed(groupId, monthKey)) {
      return forbidden(res, strings.bazarSchedule.lockedMonthClosed);
    }

    const { assignments } = req.body as { assignments?: unknown };
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return badRequest(res, strings.bazarSchedule.invalidAssignment);
    }

    const totalDays = daysInMonth(monthKey).length;
    const activeMemberships = await prisma.membership.findMany({
      where: { groupId, isActive: true },
      select: { userId: true }
    });
    const activeIds = new Set(activeMemberships.map((m) => m.userId));

    const parsed: { day: number; userId: string | null }[] = [];
    for (const item of assignments) {
      if (!item || typeof item !== 'object') {
        return badRequest(res, strings.bazarSchedule.invalidAssignment);
      }
      const { day, userId } = item as { day?: unknown; userId?: unknown };
      if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > totalDays) {
        return badRequest(res, strings.bazarSchedule.invalidAssignment);
      }
      if (userId !== null && typeof userId !== 'string') {
        return badRequest(res, strings.bazarSchedule.invalidAssignment);
      }
      if (userId !== null && !activeIds.has(userId)) {
        return badRequest(res, strings.bazarSchedule.invalidAssignment);
      }
      parsed.push({ day, userId: (userId as string | null) ?? null });
    }

    const scheduleId = await ensureSchedule(groupId, monthKey, totalDays);

    await prisma.$transaction(
      parsed.map((entry) =>
        entry.userId === null
          ? prisma.bazarDutyDay.deleteMany({ where: { scheduleId, day: entry.day } })
          : prisma.bazarDutyDay.upsert({
              where: { scheduleId_day: { scheduleId, day: entry.day } },
              update: { userId: entry.userId },
              create: { scheduleId, day: entry.day, userId: entry.userId, publishedAt: new Date() }
            })
      )
    );

    return ok(res, await loadSchedule(groupId, group, monthKey, sessionUser.id, canManage));
  }

  return methodNotAllowed(res, ['GET', 'PUT']);
}

export default withAudit(handler);
