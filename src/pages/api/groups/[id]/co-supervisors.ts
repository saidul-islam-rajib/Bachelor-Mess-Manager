import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, conflict, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { addCoSupervisor, listSupervisors, removeCoSupervisor } from '@/lib/supervisors';
import { NOTIFICATION_TYPES } from '@/lib/constants';
import { notifyGroup } from '@/lib/notifications';
import { strings } from '@/lib/i18n';
import { groupPath } from '@/lib/routes';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, strings.errors.unauthorized);
  }

  const groupId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!groupId) {
    return badRequest(res, 'Group ID is required.');
  }

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) {
    return notFound(res, strings.groups.notFound);
  }

  if (req.method === 'GET') {
    if (!(await isGroupMember(groupId, sessionUser.id)) && !requireAdmin(sessionUser)) {
      return forbidden(res, 'You are not a member of this group.');
    }
    return ok(res, await listSupervisors(groupId));
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
  }

  if (!(await canManageGroup(groupId, sessionUser))) {
    return forbidden(res, strings.groups.coSupervisorOnlySupervisor);
  }

  const userId = req.method === 'POST'
    ? (req.body as { userId?: string }).userId
    : (Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId);

  if (!userId) {
    return badRequest(res, strings.members.userIdRequired);
  }

  if (req.method === 'DELETE') {
    const removed = await removeCoSupervisor({ groupId, userId });
    if (!removed.ok) {
      return conflict(res, removed.error);
    }
    return ok(res, { ...(await listSupervisors(groupId)), removed: removed.user, demoted: removed.demoted });
  }

  const result = await addCoSupervisor({ groupId, userId, actorId: sessionUser.id });
  if (!result.ok) {
    return conflict(res, result.error);
  }

  await notifyGroup(
    groupId,
    {
      type: NOTIFICATION_TYPES.SUPERVISOR_CHANGED,
      actorId: sessionUser.id,
      title: strings.groups.coSupervisorAdded(result.user.name),
      excerpt: strings.groups.coSupervisorNotice(sessionUser.name, result.user.name, result.groupName),
      link: groupPath(groupId)
    },
    { excludeUserId: sessionUser.id }
  );

  return created(res, {
    ...(await listSupervisors(groupId)),
    added: result.user,
    promoted: result.promoted
  });
}

export default withAudit(handler);
