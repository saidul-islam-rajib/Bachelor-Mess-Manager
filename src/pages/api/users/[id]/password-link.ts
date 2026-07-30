import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { isMailConfigured, passwordSetupEmail, sendMail } from '@/lib/mailer';
import { issuePasswordToken, TOKEN_PURPOSE } from '@/lib/password-tokens';
import { passwordTokenConfig } from '@/config';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, strings.errors.unauthorized);
  }
  if (!hasPermission(sessionUser, PERMISSIONS.USER_UPDATE)) {
    return forbidden(res, strings.errors.adminOnly);
  }

  const userId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!userId) {
    return badRequest(res, strings.admin.users.idRequired);
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true }
  });
  if (!target) {
    return notFound(res, strings.admin.users.notFound);
  }

  const { link } = await issuePasswordToken({ userId: target.id, purpose: TOKEN_PURPOSE.SETUP, req });
  const message = { ...passwordSetupEmail(target.name, link, passwordTokenConfig.hours), to: target.email };
  const delivery = await sendMail(message);

  return ok(res, {
    link,
    email: target.email,
    expiresInHours: passwordTokenConfig.hours,
    mailConfigured: isMailConfigured(),
    delivered: delivery.ok && 'delivered' in delivery ? delivery.delivered : false,
    error: delivery.ok ? null : delivery.error
  });
}

export default withAudit(handler);
