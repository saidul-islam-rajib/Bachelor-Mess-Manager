import { prisma } from '@/lib/prisma';
import { groupConfig } from '@/config';
import { USER_ROLES } from '@/lib/constants';
import { strings } from '@/lib/i18n';

export const MAX_GROUPS_PER_SUPERVISOR = groupConfig.maxGroupsPerSupervisor;

export type JoinCheck = { ok: true } | { ok: false; error: string };

export async function canJoinGroup(userId: string, groupId: string): Promise<JoinCheck> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true }
  });
  if (!user) return { ok: false, error: strings.members.userGone };

  if (user.role === USER_ROLES.SUPERVISOR || user.role === USER_ROLES.ADMIN) {
    return { ok: true };
  }

  const active = await prisma.membership.findFirst({
    where: { userId, isActive: true, groupId: { not: groupId } },
    include: { group: { select: { name: true } } }
  });

  if (active) {
    return { ok: false, error: strings.members.alreadyInGroup(active.group.name) };
  }

  return { ok: true };
}

export async function canJoinGroupSelf(userId: string, groupId: string): Promise<JoinCheck> {
  const check = await canJoinGroup(userId, groupId);
  if (check.ok) return check;

  const active = await prisma.membership.findFirst({
    where: { userId, isActive: true, groupId: { not: groupId } },
    include: { group: { select: { name: true } } }
  });

  return {
    ok: false,
    error: active ? strings.members.youAreAlreadyInGroup(active.group.name) : check.error
  };
}

export async function canCreateGroup(supervisorId: string): Promise<JoinCheck> {
  const count = await prisma.group.count({ where: { supervisorId } });
  if (count >= groupConfig.maxGroupsPerSupervisor) {
    return { ok: false, error: strings.groups.limitExceeded(groupConfig.maxGroupsPerSupervisor, count) };
  }
  return { ok: true };
}

export async function activateMembership(groupId: string, userId: string) {
  const existing = await prisma.membership.findFirst({ where: { groupId, userId } });

  if (!existing) {
    return prisma.membership.create({
      data: { groupId, userId, isActive: true, publishedAt: new Date() }
    });
  }
  if (existing.isActive) return existing;

  return prisma.membership.update({
    where: { id: existing.id },
    data: { isActive: true, leftAt: null, joinedAt: new Date() }
  });
}

const MILLISECONDS_PER_DAY = 86_400_000;

export function stayDays(joinedAt: Date, leftAt: Date | null): number {
  const end = leftAt ?? new Date();
  return Math.max(0, Math.floor((end.getTime() - joinedAt.getTime()) / MILLISECONDS_PER_DAY));
}
