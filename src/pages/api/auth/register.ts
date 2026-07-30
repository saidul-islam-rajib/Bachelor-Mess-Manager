import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { USER_ROLES, USER_STATUS } from '@/lib/constants';
import { badRequest, created, methodNotAllowed, tooManyRequests } from '@/lib/http';
import { clientIp } from '@/lib/rate-limit';
import { countRecentRegistrations, recordRegistrationAttempt } from '@/lib/login-attempts';
import { getSecurityPolicy } from '@/lib/settings-service';
import { isMailConfigured, passwordSetupEmail, sendMail } from '@/lib/mailer';
import { issuePasswordToken, TOKEN_PURPOSE } from '@/lib/password-tokens';
import { passwordTokenConfig, isProduction } from '@/config';
import { strings } from '@/lib/i18n';
import { validateEmail, validateName, validatePhone } from '@/lib/validation';
import { findXssField } from '@/lib/xss';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const policy = await getSecurityPolicy();
  const ipAddress = clientIp(req);

  const recentRegistrations = await countRecentRegistrations(ipAddress);
  if (recentRegistrations >= policy.maxRegistrationsPerIp) {
    res.setHeader('Retry-After', String(policy.registrationWindowMinutes * 60));
    return tooManyRequests(res, strings.errors.tooManySignups);
  }

  const { name, email, phone } = req.body as Record<string, unknown>;

  if (findXssField({ name, email, phone })) {
    return badRequest(res, strings.errors.suspiciousInput);
  }

  const nameCheck = validateName(name);
  if (!nameCheck.ok) return badRequest(res, nameCheck.error);

  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) return badRequest(res, emailCheck.error);

  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.ok) return badRequest(res, phoneCheck.error);

  const existing = await prisma.user.findUnique({
    where: { email: emailCheck.value },
    select: { id: true, name: true, email: true, password: true, status: true }
  });

  await recordRegistrationAttempt(emailCheck.value, ipAddress);

  const awaitingFirstPassword = Boolean(existing && !existing.password);

  if (existing && !awaitingFirstPassword) {
    return created(res, { message: strings.auth.checkEmail, emailSent: true });
  }

  const isFirstUser = !existing && (await prisma.user.count()) === 0;

  try {
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { name: nameCheck.value, phone: phoneCheck.value },
          select: { id: true, name: true, email: true }
        })
      : await prisma.user.create({
          data: {
            name: nameCheck.value,
            email: emailCheck.value,
            password: '',
            phone: phoneCheck.value,
            role: isFirstUser ? USER_ROLES.ADMIN : USER_ROLES.MEMBER,
            status: isFirstUser ? USER_STATUS.APPROVED : USER_STATUS.UNVERIFIED,
            publishedAt: isFirstUser ? new Date() : null
          },
          select: { id: true, name: true, email: true }
        });

    const { link } = await issuePasswordToken({ userId: user.id, purpose: TOKEN_PURPOSE.SETUP, req });
    const message = { ...passwordSetupEmail(user.name, link, passwordTokenConfig.minutes), to: user.email };
    const delivery = await sendMail(message);

    const delivered = delivery.ok && delivery.delivered;

    const body: Record<string, unknown> = {
      message: delivered ? strings.auth.checkEmail : strings.auth.mailFailed,
      emailSent: delivered,
      firstUser: isFirstUser
    };

    if (!isMailConfigured() && !isProduction) {
      body.setupLink = link;
      body.message = strings.auth.checkEmailDevMode;
    }

    return created(res, body);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return created(res, { message: strings.auth.checkEmail, emailSent: true });
    }
    throw error;
  }
}

export default withAudit(handler);
