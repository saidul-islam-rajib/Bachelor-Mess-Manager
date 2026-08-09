import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { INVITATION_STATUS, USER_STATUS } from '@/lib/constants';
import { badRequest, conflict, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { canJoinGroup } from '@/lib/groups';
import { normalizeEmail } from '@/lib/validation';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
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

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return notFound(res, 'Group not found.');
  }

  const canManage = group.supervisorId === sessionUser.id || requireAdmin(sessionUser);
  if (!canManage) {
    return forbidden(res, 'Only this group\'s supervisor can manage invitations.');
  }
  if (req.method !== 'GET' && !hasPermission(sessionUser, PERMISSIONS.MEMBERSHIP_INVITE)) {
    return forbidden(res, strings.errors.permissionDenied);
  }

  if (req.method === 'GET') {
    const invitations = await prisma.invitation.findMany({
      where: { groupId },
      include: { invitee: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return ok(res, { invitations });
  }

  if (req.method === 'POST') {
    const { email } = req.body as { email?: string };
    if (!email) {
      return badRequest(res, 'Member email is required.');
    }

    const invitee = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    if (!invitee) {
      return notFound(res, 'No registered user found with that email.');
    }
    if (invitee.status !== USER_STATUS.APPROVED) {
      return badRequest(res, 'That user has not been approved yet.');
    }
    if (invitee.id === sessionUser.id) {
      return badRequest(res, 'You are already part of this group.');
    }

    const activeMembership = await prisma.membership.findFirst({
      where: { groupId, userId: invitee.id, isActive: true }
    });
    if (activeMembership) {
      return conflict(res, 'That user is already a member of this group.');
    }

    const pendingInvite = await prisma.invitation.findFirst({
      where: { groupId, inviteeId: invitee.id, status: INVITATION_STATUS.PENDING }
    });

    const invitation = pendingInvite
      ? await prisma.invitation.update({
          where: { id: pendingInvite.id },
          data: { invitedById: sessionUser.id, createdAt: new Date() }
        })
      : await prisma.invitation.create({
          data: {
            groupId,
            inviteeId: invitee.id,
            invitedById: sessionUser.id,
            status: INVITATION_STATUS.PENDING
          }
        });

    const joinable = await canJoinGroup(invitee.id, groupId);

    return created(res, {
      invitation,
      invitee: { id: invitee.id, name: invitee.name, email: invitee.email },
      resent: Boolean(pendingInvite),
      warning: joinable.ok ? null : joinable.error
    });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler);
