import { prisma } from '@/lib/prisma';
import { computeEqualSplitDays } from '@/lib/bazar-schedule';
import { daysInMonth } from '@/lib/month';

export async function ensureSchedule(groupId: string, monthKey: string, totalDays: number): Promise<string> {
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

export async function bazarDutyUserId(groupId: string, dayKey: string): Promise<string | null> {
  const monthKey = dayKey.slice(0, 7);
  const day = Number(dayKey.slice(8, 10));
  const totalDays = daysInMonth(monthKey).length;
  const scheduleId = await ensureSchedule(groupId, monthKey, totalDays);

  const dutyDay = await prisma.bazarDutyDay.findUnique({
    where: { scheduleId_day: { scheduleId, day } },
    select: { userId: true }
  });
  if (!dutyDay?.userId) return null;

  const activeMembership = await prisma.membership.findFirst({
    where: { groupId, userId: dutyDay.userId, isActive: true },
    select: { userId: true }
  });

  return activeMembership ? dutyDay.userId : null;
}
