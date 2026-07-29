import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { INVITATION_STATUS } from '@/lib/constants';
import { badRequest, conflict, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { activateMembership, canJoinGroupSelf } from '@/lib/groups';
import { withAudit } from '@/lib/with-audit';

const ALLOWED_RESPONSES = [INVITATION_STATUS.ACCEPTED, INVITATION_STATUS.REJECTED] as string[];

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    return methodNotAllowed(res, ['PATCH', 'DELETE']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const invitationId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!invitationId) {
    return badRequest(res, 'Invitation ID is required.');
  }

  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation) {
    return notFound(res, 'Invitation not found.');
  }

  // Cancel: the supervisor who sent it (or an admin) can withdraw a pending invitation.
  if (req.method === 'DELETE') {
    if (invitation.invitedById !== sessionUser.id && !requireAdmin(sessionUser)) {
      return forbidden(res, 'Only the sender can cancel this invitation.');
    }
    await prisma.invitation.delete({ where: { id: invitation.id } });
    return ok(res, { cancelled: true });
  }

  // Only the person who was invited can accept or reject it.
  if (invitation.inviteeId !== sessionUser.id) {
    return forbidden(res, 'This invitation is not addressed to you.');
  }
  if (invitation.status !== INVITATION_STATUS.PENDING) {
    return badRequest(res, 'This invitation has already been answered.');
  }

  const { status } = req.body as { status?: string };
  if (!status || !ALLOWED_RESPONSES.includes(status)) {
    return badRequest(res, 'Status must be ACCEPTED or REJECTED.');
  }

  // Accepting makes the user a member — but only if the one-active-group rule
  // allows it. Check before writing, so a refusal leaves the invitation pending
  // and the member can accept it after leaving their current mess.
  if (status === INVITATION_STATUS.ACCEPTED) {
    const joinable = await canJoinGroupSelf(sessionUser.id, invitation.groupId);
    if (!joinable.ok) {
      return conflict(res, joinable.error);
    }
  }

  const updated = await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status, respondedAt: new Date() }
  });

  if (status === INVITATION_STATUS.ACCEPTED) {
    await activateMembership(invitation.groupId, invitation.inviteeId);
  }

  return ok(res, { invitation: updated });
}

export default withAudit(handler);
