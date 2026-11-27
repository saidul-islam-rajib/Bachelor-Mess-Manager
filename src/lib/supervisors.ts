import { prisma } from '@/lib/prisma';
import { invalidatePrefix } from '@/lib/cache';
import { SESSION_USER_CACHE_PREFIX } from '@/lib/cache-keys';
import { GROUP_STATUS, USER_ROLES, USER_STATUS } from '@/lib/constants';
import { getSupervisorPolicy } from '@/lib/settings-service';
import { strings } from '@/lib/i18n';
import { traced } from '@/lib/log';

export type SupervisorSlot = {
  id: string;
  name: string;
  email: string;
  isPrimary: boolean;
};

export type SupervisorState = {
  supervisors: SupervisorSlot[];
  maxSupervisors: number;
  siteMaxSupervisors: number;
  overriddenByGroup: boolean;
  canAddMore: boolean;
};

export type SupervisorChange =
  | { ok: true; user: { id: string; name: string }; groupName: string; promoted: boolean; demoted: boolean }
  | { ok: false; error: string };

export async function listSupervisors(groupId: string): Promise<SupervisorState> {
  const [group, policy] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      select: {
        supervisor: { select: { id: true, name: true, email: true } },
        coSupervisors: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    }),
    getSupervisorPolicy(groupId)
  ]);

  const supervisors: SupervisorSlot[] = [];
  if (group) {
    supervisors.push({ ...group.supervisor, isPrimary: true });
    for (const row of group.coSupervisors) {
      supervisors.push({ ...row.user, isPrimary: false });
    }
  }

  return {
    supervisors,
    maxSupervisors: policy.maxSupervisors,
    siteMaxSupervisors: policy.siteMaxSupervisors,
    overriddenByGroup: policy.overriddenByGroup,
    canAddMore: supervisors.length < policy.maxSupervisors
  };
}

export async function supervisorIdsFor(groupId: string): Promise<string[]> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { supervisorId: true, coSupervisors: { select: { userId: true } } }
  });
  if (!group) return [];
  return [group.supervisorId, ...group.coSupervisors.map((row) => row.userId)];
}

export async function isSupervisorOf(groupId: string, userId: string): Promise<boolean> {
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [{ supervisorId: userId }, { coSupervisors: { some: { userId } } }]
    },
    select: { id: true }
  });
  return Boolean(group);
}

async function addCoSupervisorImpl(params: {
  groupId: string;
  userId: string;
  actorId: string;
}): Promise<SupervisorChange> {
  const { groupId, userId, actorId } = params;

  const [group, policy] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        supervisorId: true,
        coSupervisors: { select: { userId: true } }
      }
    }),
    getSupervisorPolicy(groupId)
  ]);
  if (!group) return { ok: false, error: strings.groups.notFound };

  if (group.supervisorId === userId) {
    return { ok: false, error: strings.groups.coSupervisorAlreadyPrimary };
  }
  if (group.coSupervisors.some((row) => row.userId === userId)) {
    return { ok: false, error: strings.groups.coSupervisorAlready };
  }

  const current = 1 + group.coSupervisors.length;
  if (current >= policy.maxSupervisors) {
    return { ok: false, error: strings.groups.coSupervisorAtCap(policy.maxSupervisors) };
  }

  const [next, membership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, status: true }
    }),
    prisma.membership.findFirst({ where: { groupId, userId, isActive: true }, select: { id: true } })
  ]);

  if (!next) return { ok: false, error: strings.members.userGone };
  if (next.status !== USER_STATUS.APPROVED) return { ok: false, error: strings.groups.handoverNotApproved };
  if (!membership) return { ok: false, error: strings.groups.handoverNotMember };

  const promoted = next.role === USER_ROLES.MEMBER;

  await prisma.$transaction(async (tx) => {
    await tx.groupSupervisor.create({
      data: { groupId, userId, addedById: actorId, publishedAt: new Date() }
    });
    if (promoted) {
      await tx.user.update({ where: { id: userId }, data: { role: USER_ROLES.SUPERVISOR } });
    }
  });

  invalidatePrefix(SESSION_USER_CACHE_PREFIX);

  return { ok: true, user: { id: next.id, name: next.name }, groupName: group.name, promoted, demoted: false };
}

async function removeCoSupervisorImpl(params: {
  groupId: string;
  userId: string;
}): Promise<SupervisorChange> {
  const { groupId, userId } = params;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, supervisorId: true }
  });
  if (!group) return { ok: false, error: strings.groups.notFound };

  if (group.supervisorId === userId) {
    return { ok: false, error: strings.groups.coSupervisorCannotRemovePrimary };
  }

  const row = await prisma.groupSupervisor.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { user: { select: { id: true, name: true, role: true } } }
  });
  if (!row) return { ok: false, error: strings.groups.coSupervisorNotFound };

  const demoted = await prisma.$transaction(async (tx) => {
    await tx.groupSupervisor.delete({ where: { id: row.id } });

    if (row.user.role !== USER_ROLES.SUPERVISOR) return false;

    const [owns, coSupervises] = await Promise.all([
      tx.group.count({ where: { supervisorId: userId, status: GROUP_STATUS.ACTIVE } }),
      tx.groupSupervisor.count({ where: { userId } })
    ]);
    if (owns > 0 || coSupervises > 0) return false;

    await tx.user.update({ where: { id: userId }, data: { role: USER_ROLES.MEMBER } });
    return true;
  });

  invalidatePrefix(SESSION_USER_CACHE_PREFIX);

  return {
    ok: true,
    user: { id: row.user.id, name: row.user.name },
    groupName: group.name,
    promoted: false,
    demoted
  };
}

export async function groupsOverSupervisorCap(cap: number): Promise<{ id: string; name: string; count: number }[]> {
  const groups = await prisma.group.findMany({
    where: { maxSupervisors: null },
    select: { id: true, name: true, _count: { select: { coSupervisors: true } } }
  });

  return groups
    .map((group) => ({ id: group.id, name: group.name, count: 1 + group._count.coSupervisors }))
    .filter((group) => group.count > cap);
}

export const addCoSupervisor = traced('addCoSupervisor', addCoSupervisorImpl);

export const removeCoSupervisor = traced('removeCoSupervisor', removeCoSupervisorImpl);
