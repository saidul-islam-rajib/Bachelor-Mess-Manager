import { prisma } from '@/lib/prisma';
import { groupConfig } from '@/config';
import { invalidatePrefix } from '@/lib/cache';
import { SESSION_USER_CACHE_PREFIX } from '@/lib/cache-keys';
import { GROUP_STATUS, USER_ROLES, USER_STATUS } from '@/lib/constants';
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
  const count = await prisma.group.count({
    where: { supervisorId, status: GROUP_STATUS.ACTIVE }
  });
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

export type SupervisionTransfer =
  | {
      ok: true;
      groupName: string;
      previousSupervisor: { id: string; name: string };
      nextSupervisor: { id: string; name: string };
      promoted: boolean;
      demoted: boolean;
    }
  | { ok: false; error: string };

export async function transferSupervision(params: {
  groupId: string;
  nextSupervisorId: string;
}): Promise<SupervisionTransfer> {
  const { groupId, nextSupervisorId } = params;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, supervisorId: true, supervisor: { select: { id: true, name: true } } }
  });
  if (!group) return { ok: false, error: strings.groups.notFound };

  if (group.supervisorId === nextSupervisorId) {
    return { ok: false, error: strings.groups.handoverSelf };
  }

  const [next, membership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: nextSupervisorId },
      select: { id: true, name: true, role: true, status: true }
    }),
    prisma.membership.findFirst({
      where: { groupId, userId: nextSupervisorId, isActive: true },
      select: { id: true }
    })
  ]);

  if (!next) return { ok: false, error: strings.members.userGone };
  if (next.status !== USER_STATUS.APPROVED) return { ok: false, error: strings.groups.handoverNotApproved };
  if (!membership) return { ok: false, error: strings.groups.handoverNotMember };

  if (next.role === USER_ROLES.SUPERVISOR) {
    const owned = await prisma.group.count({
      where: { supervisorId: nextSupervisorId, status: GROUP_STATUS.ACTIVE }
    });
    if (owned >= groupConfig.maxGroupsPerSupervisor) {
      return { ok: false, error: strings.groups.handoverAtLimit(next.name, groupConfig.maxGroupsPerSupervisor) };
    }
  }

  const previous = group.supervisor;
  const promoted = next.role === USER_ROLES.MEMBER;

  const demoted = await prisma.$transaction(async (tx) => {
    await tx.group.update({ where: { id: groupId }, data: { supervisorId: nextSupervisorId } });

    const outgoingMembership = await tx.membership.findFirst({
      where: { groupId, userId: previous.id },
      select: { id: true, isActive: true }
    });

    if (!outgoingMembership) {
      await tx.membership.create({
        data: { groupId, userId: previous.id, isActive: true, publishedAt: new Date() }
      });
    } else if (!outgoingMembership.isActive) {
      await tx.membership.update({
        where: { id: outgoingMembership.id },
        data: { isActive: true, leftAt: null, joinedAt: new Date() }
      });
    }

    if (promoted) {
      await tx.user.update({ where: { id: nextSupervisorId }, data: { role: USER_ROLES.SUPERVISOR } });
    }

    const outgoing = await tx.user.findUnique({ where: { id: previous.id }, select: { role: true } });
    if (outgoing?.role !== USER_ROLES.SUPERVISOR) return false;

    const [stillSupervises, activeGroups] = await Promise.all([
      tx.group.count({ where: { supervisorId: previous.id } }),
      tx.membership.count({ where: { userId: previous.id, isActive: true } })
    ]);

    if (stillSupervises > 0 || activeGroups > 1) return false;

    await tx.user.update({ where: { id: previous.id }, data: { role: USER_ROLES.MEMBER } });
    return true;
  });

  invalidatePrefix(SESSION_USER_CACHE_PREFIX);

  return {
    ok: true,
    groupName: group.name,
    previousSupervisor: previous,
    nextSupervisor: { id: next.id, name: next.name },
    promoted,
    demoted
  };
}

export const GROUP_CLOSED_MESSAGE =
  'This mess is closed. Reopen it from the group page before recording anything new.';

export function isGroupWritable(group: { status: string } | null): boolean {
  return group?.status === GROUP_STATUS.ACTIVE;
}

const MILLISECONDS_PER_DAY = 86_400_000;

export function stayDays(joinedAt: Date, leftAt: Date | null): number {
  const end = leftAt ?? new Date();
  return Math.max(0, Math.floor((end.getTime() - joinedAt.getTime()) / MILLISECONDS_PER_DAY));
}
