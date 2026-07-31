import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getRealSessionUser } from '@/lib/auth-utils';
import { clearImpersonationCookie, setImpersonationCookie } from '@/lib/auth';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { USER_ROLES, USER_STATUS } from '@/lib/constants';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'DELETE') {
    clearImpersonationCookie(res);
    return ok(res, { message: strings.admin.impersonation.stopped });
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST', 'DELETE']);
  }

  const admin = await getRealSessionUser(req, res);
  if (!admin) {
    return unauthorized(res, strings.errors.unauthorized);
  }
  if (admin.role !== USER_ROLES.ADMIN) {
    return forbidden(res, strings.errors.adminOnly);
  }

  const { userId } = req.body as { userId?: string };
  if (!userId) {
    return badRequest(res, strings.admin.users.idRequired);
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, status: true, tokenVersion: true }
  });

  if (!target) {
    return notFound(res, strings.admin.users.notFound);
  }
  if (target.id === admin.id) {
    return badRequest(res, strings.admin.impersonation.cannotImpersonateSelf);
  }
  if (target.role === USER_ROLES.ADMIN) {
    return forbidden(res, strings.admin.impersonation.cannotImpersonateAdmin);
  }
  if (target.status !== USER_STATUS.APPROVED) {
    return badRequest(res, strings.admin.impersonation.targetNotApproved);
  }

  await setImpersonationCookie(res, admin.id, target.id, target.tokenVersion);

  return ok(res, {
    message: strings.admin.impersonation.started(target.name),
    user: { id: target.id, name: target.name, email: target.email, role: target.role }
  });
}

export default withAudit(handler);
