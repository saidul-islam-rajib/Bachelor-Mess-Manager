import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { USER_STATUS } from '@/lib/constants';
import { methodNotAllowed, ok, tooManyRequests } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { isMailConfigured, passwordResetEmail, sendMail } from '@/lib/mailer';
import { issuePasswordToken, TOKEN_PURPOSE } from '@/lib/password-tokens';
import { isProduction, passwordTokenConfig } from '@/config';
import { strings } from '@/lib/i18n';
import { isValidEmail, normalizeEmail } from '@/lib/validation';
import { withAudit } from '@/lib/with-audit';

const MAX_PER_IP = 10;
const MAX_PER_EMAIL = 3;
const WINDOW_MS = 15 * 60 * 1000;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const ipLimit = rateLimit(`forgot-password:ip:${clientIp(req)}`, MAX_PER_IP, WINDOW_MS);
  if (!ipLimit.allowed) {
    res.setHeader('Retry-After', String(ipLimit.retryAfter));
    return tooManyRequests(res, strings.errors.tooManyRequests);
  }

  const { email } = req.body as { email?: unknown };
  const accepted = { sent: true, mailConfigured: isMailConfigured(), link: null as string | null };

  if (typeof email !== 'string' || !isValidEmail(email)) {
    return ok(res, accepted);
  }

  const normalizedEmail = normalizeEmail(email);

  const emailLimit = rateLimit(`forgot-password:email:${normalizedEmail}`, MAX_PER_EMAIL, WINDOW_MS);
  if (!emailLimit.allowed) {
    return ok(res, accepted);
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true, email: true, status: true }
  });

  if (!user || user.status === USER_STATUS.REJECTED) {
    return ok(res, accepted);
  }

  const { link } = await issuePasswordToken({ userId: user.id, purpose: TOKEN_PURPOSE.RESET, req });
  const message = { ...passwordResetEmail(user.name, link, passwordTokenConfig.minutes), to: user.email };
  await sendMail(message);

  const revealLink = !isMailConfigured() && !isProduction;
  return ok(res, { ...accepted, link: revealLink ? link : null });
}

export default withAudit(handler);
