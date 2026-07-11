import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { USER_STATUS } from '@/lib/constants';
import { badRequest, conflict, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  // Admin can add members directly; supervisors invite instead (see /invitations).
  if (req.method === 'POST') {
    if (!requireAdmin(sessionUser)) {
      return forbidden(res, 'Only admins can add members directly. Supervisors should invite members.');
    }

    const { email } = req.body as { email?: string };
    if (!email) {
      return badRequest(res, 'Member email is required.');
    }

    const member = await prisma.user.findUnique({ where: { email } });
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

    const membership = existing
      ? await prisma.membership.update({ where: { id: existing.id }, data: { isActive: true, leftAt: null } })
      : await prisma.membership.create({ data: { groupId, userId: member.id, isActive: true } });

    return created(res, { membership, member: { id: member.id, name: member.name, email: member.email } });
  }

  // Admin or the group's supervisor can remove a member.
  if (req.method === 'DELETE') {
    const isGroupSupervisor = group.supervisorId === sessionUser.id;
    if (!isGroupSupervisor && !requireAdmin(sessionUser)) {
      return forbidden(res, 'Only this group\'s supervisor can remove members.');
    }

    const { userId } = req.body as { userId?: string };
    if (!userId) {
      return badRequest(res, 'User ID is required.');
    }
    if (userId === group.supervisorId) {
      return badRequest(res, 'The group supervisor cannot be removed.');
    }

    const membership = await prisma.membership.findFirst({ where: { groupId, userId, isActive: true } });
    if (!membership) {
      return notFound(res, 'That user is not an active member of this group.');
    }

    await prisma.membership.update({
      where: { id: membership.id },
      data: { isActive: false, leftAt: new Date() }
    });

    return ok(res, { removed: true });
  }

  return methodNotAllowed(res, ['POST', 'DELETE']);
}
