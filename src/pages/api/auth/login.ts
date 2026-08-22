import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { setSessionCookie, setThemeCookie } from '@/lib/auth';
import { hashPassword, needsRehash, verifyPassword } from '@/lib/password';
import { USER_STATUS } from '@/lib/constants';
import { badRequest, forbidden, methodNotAllowed, ok, tooManyRequests, unauthorized } from '@/lib/http';
import { clientIp } from '@/lib/rate-limit';
import {
  clearFailedAttempts,
  evaluateLoginLock,
  LOGIN_FAILURE_REASONS,
  recordLoginAttempt
} from '@/lib/login-attempts';
import { strings } from '@/lib/i18n';
import { normalizeEmail } from '@/lib/validation';
import { endSession, SESSION_END_REASONS, touchSession } from '@/lib/user-sessions';
import { withAudit } from '@/lib/with-audit';

const DUMMY_HASH =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' +
  'ZG8gbm90IG1hdGNoIGFueXRoaW5nIC0gcGxhY2Vob2xkZXIgZm9yIHRpbWluZyBlcXVhbGl0eSE=';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const { email, password } = req.body as { email?: unknown; password?: unknown };

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return badRequest(res, strings.validation.required(`${strings.common.email} / ${strings.common.name}`));
  }

  const normalizedEmail = normalizeEmail(email);
  const ipAddress = clientIp(req);
  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

  const lock = await evaluateLoginLock(normalizedEmail, ipAddress);
  if (lock.locked) {
    await recordLoginAttempt({
      email: normalizedEmail,
      ipAddress,
      userAgent,
      successful: false,
      reason: lock.scope === 'IP' ? LOGIN_FAILURE_REASONS.IP_LOCKED : LOGIN_FAILURE_REASONS.ACCOUNT_LOCKED
    });

    res.setHeader('Retry-After', String(lock.retryAfterSeconds));
    return tooManyRequests(res, strings.admin.security.accountLocked(lock.retryAfterMinutes));
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  const passwordMatches = await verifyPassword(password, user?.password ?? DUMMY_HASH);

  if (!user || !passwordMatches) {
    await recordLoginAttempt({
      email: normalizedEmail,
      ipAddress,
      userAgent,
      successful: false,
      reason: user ? LOGIN_FAILURE_REASONS.INVALID_CREDENTIALS : LOGIN_FAILURE_REASONS.UNKNOWN_ACCOUNT
    });

    const nextLock = await evaluateLoginLock(normalizedEmail, ipAddress);
    if (nextLock.locked) {
      res.setHeader('Retry-After', String(nextLock.retryAfterSeconds));
      return tooManyRequests(res, strings.admin.security.accountLocked(nextLock.retryAfterMinutes));
    }

    return unauthorized(res, strings.errors.invalidCredentials, {
      attemptsRemaining: nextLock.attemptsRemaining,
      maxAttempts: nextLock.maxAttempts
    });
  }

  if (user.status === USER_STATUS.PENDING) {
    await recordLoginAttempt({
      email: normalizedEmail,
      ipAddress,
      userAgent,
      successful: false,
      reason: LOGIN_FAILURE_REASONS.ACCOUNT_PENDING
    });
    return forbidden(res, strings.errors.accountPending);
  }

  if (user.status !== USER_STATUS.APPROVED) {
    await recordLoginAttempt({
      email: normalizedEmail,
      ipAddress,
      userAgent,
      successful: false,
      reason: LOGIN_FAILURE_REASONS.ACCOUNT_INACTIVE
    });
    return forbidden(res, strings.errors.accountInactive);
  }

  if (needsRehash(user.password)) {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(password) }
    });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordLoginAttempt({ email: normalizedEmail, ipAddress, userAgent, successful: true, reason: null });
  await clearFailedAttempts(normalizedEmail);
  await endSession(user.id, SESSION_END_REASONS.REPLACED);
  await touchSession(user.id, req, { forceNew: true });
  await setSessionCookie(res, user);
  setThemeCookie(res, user.theme);

  return ok(res, {
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
}

export default withAudit(handler);
