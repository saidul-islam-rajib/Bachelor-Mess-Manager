import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { USER_STATUS } from '@/lib/constants';
import { badRequest, conflict, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { activateMembership, canJoinGroup, stayDays } from '@/lib/groups';
import { listSupervisors, removeCoSupervisor } from '@/lib/supervisors';
import { normalizeEmail } from '@/lib/validation';
import { withAudit } from '@/lib/with-audit';

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

  const canManage = await canManageGroup(groupId, sessionUser);

  if (req.method === 'GET') {
    const isMember = await prisma.membership.findFirst({
      where: { groupId, userId: sessionUser.id, isActive: true },
      select: { id: true }
    });
    if (!isMember && !canManage) {
      return forbidden(res, 'You are not a member of this group.');
    }

    const [memberships, supervisors] = await Promise.all([
      prisma.membership.findMany({
        where: { groupId },
        include: { user: { select: { id: true, name: true, email: true, phone: true, profileImage: true } } },
        orderBy: [{ isActive: 'desc' }, { joinedAt: 'asc' }]
      }),
      listSupervisors(groupId)
    ]);

    const coSupervisorIds = new Set(
      supervisors.supervisors.filter((s) => !s.isPrimary).map((s) => s.id)
    );

    return ok(res, {
      canManage,
      isAdmin: requireAdmin(sessionUser),
      supervisors,
      members: memberships.map((m) => ({
        membershipId: m.id,
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        phone: m.user.phone,
        profileImage: m.user.profileImage,
        isActive: m.isActive,
        isSupervisor: m.userId === group.supervisorId,
        isCoSupervisor: coSupervisorIds.has(m.userId),
        joinedAt: m.joinedAt.toISOString(),
        leftAt: m.leftAt ? m.leftAt.toISOString() : null,
        stayDays: stayDays(m.joinedAt, m.leftAt)
      }))
    });
  }

  if (req.method === 'POST') {
    if (!requireAdmin(sessionUser)) {
      return forbidden(res, 'Only admins can add members directly. Supervisors should invite members.');
    }

    const { email } = req.body as { email?: string };
    if (!email) {
      return badRequest(res, 'Member email is required.');
    }

    const member = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    if (!member) {
      return notFound(res, 'No registered user found with that email.');
    }
    if (member.status !== USER_STATUS.APPROVED) {
      return badRequest(res, 'That user has not been approved yet.');
    }

    const existing = await prisma.membership.findFirst({ where: { groupId, userId: member.id } });
    if (existing?.isActive) {
      return conflict(res, 'That user is already a member of this group.');
    }

    const joinable = await canJoinGroup(member.id, groupId);
    if (!joinable.ok) {
      return conflict(res, joinable.error);
    }

    const membership = await activateMembership(groupId, member.id);

    return created(res, { membership, member: { id: member.id, name: member.name, email: member.email } });
  }

  if (req.method === 'PATCH') {
    if (!canManage) {
      return forbidden(res, "Only this group's supervisor can change membership.");
    }

    const { userId, isActive } = req.body as { userId?: string; isActive?: boolean };
    if (!userId) {
      return badRequest(res, 'User ID is required.');
    }
    if (typeof isActive !== 'boolean') {
      return badRequest(res, 'isActive must be true or false.');
    }
    if (userId === group.supervisorId) {
      return badRequest(res, 'The group supervisor is always a member of their own group.');
    }

    const membership = await prisma.membership.findFirst({ where: { groupId, userId } });
    if (!membership) {
      return notFound(res, 'That user has never been a member of this group.');
    }
    if (membership.isActive === isActive) {
      return ok(res, { membership });
    }

    if (isActive) {
      const joinable = await canJoinGroup(userId, groupId);
      if (!joinable.ok) {
        return conflict(res, joinable.error);
      }
      return ok(res, { membership: await activateMembership(groupId, userId) });
    }

    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: { isActive: false, leftAt: new Date() }
    });
    return ok(res, { membership: updated });
  }

  if (req.method === 'DELETE') {
    const { userId } = req.body as { userId?: string };
    const targetId = userId ?? sessionUser.id;
    const isSelf = targetId === sessionUser.id;

    if (!isSelf && !canManage) {
      return forbidden(res, "Only this group's supervisor can remove other members.");
    }
    if (targetId === group.supervisorId) {
      return badRequest(
        res,
        isSelf
          ? 'You supervise this group, so you cannot leave it. Ask an admin to reassign or close the group first.'
          : 'The group supervisor cannot be removed.'
      );
    }

    const membership = await prisma.membership.findFirst({ where: { groupId, userId: targetId, isActive: true } });
    if (!membership) {
      return notFound(res, isSelf ? 'You are not an active member of this group.' : 'That user is not an active member of this group.');
    }

    await prisma.membership.update({
      where: { id: membership.id },
      data: { isActive: false, leftAt: new Date() }
    });

    const wasCoSupervisor = await prisma.groupSupervisor.findUnique({
      where: { groupId_userId: { groupId, userId: targetId } },
      select: { id: true }
    });
    if (wasCoSupervisor) {
      await removeCoSupervisor({ groupId, userId: targetId });
    }

    return ok(res, { removed: true, left: isSelf });
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE']);
}

export default withAudit(handler);
