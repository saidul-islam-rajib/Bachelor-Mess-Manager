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

  const nameCheck = validateName(name);
  if (!nameCheck.ok) return badRequest(res, nameCheck.error);

  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) return badRequest(res, emailCheck.error);

  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.ok) return badRequest(res, phoneCheck.error);

  const existing = await prisma.user.findUnique({
    where: { email: emailCheck.value },
    select: { id: true, password: true }
  });

  await recordRegistrationAttempt(emailCheck.value, ipAddress);

  if (existing) {
    return created(res, { message: strings.auth.checkEmail, emailSent: true });
  }

  const isFirstUser = (await prisma.user.count()) === 0;

  try {
    const user = await prisma.user.create({
      data: {
        name: nameCheck.value,
        email: emailCheck.value,
        password: '',
        phone: phoneCheck.value,
        role: isFirstUser ? USER_ROLES.ADMIN : USER_ROLES.MEMBER,
        status: isFirstUser ? USER_STATUS.APPROVED : USER_STATUS.PENDING,
        publishedAt: isFirstUser ? new Date() : null
      }
    });

    const { link } = await issuePasswordToken({ userId: user.id, purpose: TOKEN_PURPOSE.SETUP, req });
    const message = { ...passwordSetupEmail(user.name, link, passwordTokenConfig.hours), to: user.email };
    const delivery = await sendMail(message);

    const body: Record<string, unknown> = {
      message: strings.auth.checkEmail,
      emailSent: true,
      firstUser: isFirstUser
    };

    if (!isMailConfigured() && !isProduction) {
      body.setupLink = link;
      body.message = strings.auth.checkEmailDevMode;
    }

    if (!delivery.ok) {
      body.message = strings.auth.mailFailed;
      body.emailSent = false;
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
