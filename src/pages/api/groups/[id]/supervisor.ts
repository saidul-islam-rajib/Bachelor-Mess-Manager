import type { NextApiRequest, NextApiResponse } from 'next';
import { canManageGroup, getSessionUser } from '@/lib/auth-utils';
import { badRequest, conflict, forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { transferSupervision } from '@/lib/groups';
import { NOTIFICATION_TYPES } from '@/lib/constants';
import { notifyGroup } from '@/lib/notifications';
import { strings } from '@/lib/i18n';
import { groupPath } from '@/lib/routes';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, strings.errors.unauthorized);
  }

  const groupId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!groupId) {
    return badRequest(res, 'Group ID is required.');
  }

  if (!(await canManageGroup(groupId, sessionUser))) {
    return forbidden(res, strings.groups.handoverOnlySupervisor);
  }

  const { userId } = req.body as { userId?: string };
  if (!userId) {
    return badRequest(res, strings.members.userIdRequired);
  }

  const result = await transferSupervision({ groupId, nextSupervisorId: userId });
  if (!result.ok) {
    return conflict(res, result.error);
  }

  await notifyGroup(
    groupId,
    {
      type: NOTIFICATION_TYPES.SUPERVISOR_CHANGED,
      actorId: sessionUser.id,
      title: strings.groups.handoverDone(result.nextSupervisor.name),
      excerpt: strings.groups.handoverNotice(
        result.previousSupervisor.name,
        result.nextSupervisor.name,
        result.groupName
      ),
      link: groupPath(groupId)
    },
    { excludeUserId: sessionUser.id }
  );

  return ok(res, {
    supervisor: result.nextSupervisor,
    previousSupervisor: result.previousSupervisor,
    promoted: result.promoted,
    demoted: result.demoted
  });
}

export default withAudit(handler);
