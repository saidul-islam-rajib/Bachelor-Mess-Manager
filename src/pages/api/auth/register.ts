import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';
import { hashPassword, validatePasswordWithPolicy } from '@/lib/password';
import { USER_ROLES, USER_STATUS } from '@/lib/constants';
import { badRequest, conflict, created, methodNotAllowed, tooManyRequests } from '@/lib/http';
import { clientIp } from '@/lib/rate-limit';
import { countRecentRegistrations, recordRegistrationAttempt } from '@/lib/login-attempts';
import { getSecurityPolicy } from '@/lib/settings-service';
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

  const { name, email, password, phone } = req.body as Record<string, unknown>;

  const nameCheck = validateName(name);
  if (!nameCheck.ok) return badRequest(res, nameCheck.error);

  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) return badRequest(res, emailCheck.error);

  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.ok) return badRequest(res, phoneCheck.error);

  const passwordCheck = validatePasswordWithPolicy(password, policy.requireStrongPasswords);
  if (!passwordCheck.ok) return badRequest(res, passwordCheck.error);

  const existing = await prisma.user.findUnique({ where: { email: emailCheck.value }, select: { id: true } });
  if (existing) {
    return conflict(res, strings.errors.emailTaken);
  }

  const isFirstUser = (await prisma.user.count()) === 0;

  try {
    const user = await prisma.user.create({
      data: {
        name: nameCheck.value,
        email: emailCheck.value,
        password: await hashPassword(password as string),
        phone: phoneCheck.value,
        role: isFirstUser ? USER_ROLES.ADMIN : USER_ROLES.MEMBER,
        status: isFirstUser ? USER_STATUS.APPROVED : USER_STATUS.PENDING,
        publishedAt: isFirstUser ? new Date() : null
      }
    });

    await recordRegistrationAttempt(emailCheck.value, ipAddress);

    if (isFirstUser) {
      await setSessionCookie(res, user.id, user.tokenVersion);
      return created(res, {
        message: strings.success.registrationSubmitted,
        signedIn: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    }

    return created(res, {
      message: strings.auth.submitted.body,
      signedIn: false
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return conflict(res, strings.errors.emailTaken);
    }
    throw error;
  }
}

export default withAudit(handler);
