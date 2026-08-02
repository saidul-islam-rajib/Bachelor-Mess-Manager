import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { deleteMessage, findMessage, isSystemMessage } from '@/lib/community';
import { strings } from '@/lib/i18n';
import { firstValue } from '@/lib/query';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return methodNotAllowed(res, ['DELETE']);
  }

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, strings.community.signedOut);
  }

  const id = firstValue(req.query.id);
  if (!id) {
    return badRequest(res, strings.community.idRequired);
  }

  const message = await findMessage(id);
  if (!message) {
    return notFound(res, strings.community.notFound);
  }

  const isModerator = requireAdmin(sessionUser);

  if (!isModerator) {
    if (isSystemMessage(message.type)) {
      return forbidden(res, strings.community.systemNotDeletable);
    }
    if (message.authorId !== sessionUser.id) {
      return forbidden(res, strings.community.deleteNotAllowed);
    }
  }

  await deleteMessage(id);

  return ok(res, { deleted: true });
}

export default withAudit(handler);
