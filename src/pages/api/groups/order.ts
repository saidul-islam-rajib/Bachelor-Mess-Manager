import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return methodNotAllowed(res, ['PUT']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const { groupIds } = req.body as { groupIds?: unknown };
  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return badRequest(res, 'A list of group IDs is required.');
  }
  if (groupIds.some((id) => typeof id !== 'string')) {
    return badRequest(res, 'Group IDs must be strings.');
  }
  if (new Set(groupIds).size !== groupIds.length) {
    return badRequest(res, 'Each group may only appear once.');
  }

  const ids = groupIds as string[];

  const visible = await prisma.group.findMany({
    where: requireAdmin(sessionUser)
      ? { id: { in: ids } }
      : {
          id: { in: ids },
          OR: [
            { supervisorId: sessionUser.id },
            { memberships: { some: { userId: sessionUser.id, isActive: true } } }
          ]
        },
    select: { id: true }
  });

  if (visible.length !== ids.length) {
    return forbidden(res, 'You can only reorder groups you belong to.');
  }

  await prisma.$transaction(
    ids.map((groupId, index) =>
      prisma.groupOrder.upsert({
        where: { userId_groupId: { userId: sessionUser.id, groupId } },
        update: { position: index },
        create: { userId: sessionUser.id, groupId, position: index }
      })
    )
  );

  return ok(res, { groupIds: ids });
}

export default withAudit(handler);
