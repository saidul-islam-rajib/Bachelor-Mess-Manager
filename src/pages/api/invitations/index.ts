import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { INVITATION_STATUS } from '@/lib/constants';
import { methodNotAllowed, ok, unauthorized } from '@/lib/http';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const invitations = await prisma.invitation.findMany({
    where: { inviteeId: sessionUser.id, status: INVITATION_STATUS.PENDING },
    include: {
      group: { select: { id: true, name: true } },
      inviter: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return ok(res, { invitations });
}
