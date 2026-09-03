import { prisma } from '@/lib/prisma';
import { GROUP_STATUS, USER_ROLES } from '@/lib/constants';
import { MESS_ACCESS, OPEN_ACCESS, type MessAccess } from '@/lib/access';

const NO_GROUP: MessAccess = { state: MESS_ACCESS.NO_GROUP, groupName: null, locked: false };

function belongsTo(userId: string) {
  return [
    { memberships: { some: { userId, isActive: true } } },
    { supervisorId: userId },
    { coSupervisors: { some: { userId } } }
  ];
}

export async function messAccessFor(user: { id: string; role: string } | null): Promise<MessAccess> {
  if (!user) return NO_GROUP;
  if (user.role === USER_ROLES.ADMIN) return OPEN_ACCESS;

  const live = await prisma.group.findFirst({
    where: { status: GROUP_STATUS.ACTIVE, OR: belongsTo(user.id) },
    select: { id: true }
  });
  if (live) return OPEN_ACCESS;

  const closed = await prisma.group.findFirst({
    where: { status: { not: GROUP_STATUS.ACTIVE }, OR: belongsTo(user.id) },
    select: { name: true },
    orderBy: { updatedAt: 'desc' }
  });
  if (closed) return { state: MESS_ACCESS.GROUP_CLOSED, groupName: closed.name, locked: true };

  const ended = await prisma.membership.findFirst({
    where: { userId: user.id, isActive: false },
    select: { group: { select: { name: true } } },
    orderBy: { leftAt: 'desc' }
  });
  if (ended) return { state: MESS_ACCESS.MEMBERSHIP_ENDED, groupName: ended.group.name, locked: true };

  return NO_GROUP;
}
