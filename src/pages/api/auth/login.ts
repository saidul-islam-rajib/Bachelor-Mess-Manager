import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';
import { hashPassword, needsRehash, verifyPassword } from '@/lib/password';
import { USER_STATUS } from '@/lib/constants';
import { badRequest, forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { clientIp, rateLimit, resetRateLimit } from '@/lib/rate-limit';
import { normalizeEmail } from '@/lib/validation';
import { withAudit } from '@/lib/with-audit';

// Two windows: a tight one per account (stops a password list against one user)
// and a looser one per IP (stops one host spraying many accounts).
const PER_ACCOUNT_LIMIT = 8;
const PER_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
const PER_IP_LIMIT = 40;
const PER_IP_WINDOW_MS = 15 * 60 * 1000;

/**
 * A dummy scrypt hash. When the email does not exist we still verify against
 * this, so a missing account takes the same time as a wrong password and the
 * response cannot be used to enumerate who is registered.
 */
const DUMMY_HASH =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' +
  'ZG8gbm90IG1hdGNoIGFueXRoaW5nIC0gcGxhY2Vob2xkZXIgZm9yIHRpbWluZyBlcXVhbGl0eSE=';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const { email, password } = req.body as { email?: unknown; password?: unknown };

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return badRequest(res, 'Email and password are required.');
  }

  const normalizedEmail = normalizeEmail(email);
  const ip = clientIp(req);

  const ipLimit = rateLimit(`login:ip:${ip}`, PER_IP_LIMIT, PER_IP_WINDOW_MS);
  const accountLimit = rateLimit(`login:acct:${normalizedEmail}`, PER_ACCOUNT_LIMIT, PER_ACCOUNT_WINDOW_MS);

  if (!ipLimit.allowed || !accountLimit.allowed) {
    const retryAfter = Math.max(ipLimit.retryAfter, accountLimit.retryAfter);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: `Too many sign-in attempts. Please try again in ${Math.ceil(retryAfter / 60)} minute(s).`
    });
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  // Always run a verification, even with no user, to keep the timing flat.
  const passwordMatches = await verifyPassword(password, user?.password ?? DUMMY_HASH);

  if (!user || !passwordMatches) {
    // One generic message: never reveal whether it was the email or the password.
    return unauthorized(res, 'Invalid email or password.');
  }

  if (user.status === USER_STATUS.PENDING) {
    return forbidden(res, 'Your account is awaiting admin approval.');
  }
  if (user.status !== USER_STATUS.APPROVED) {
    return forbidden(res, 'Your account is not active. Please contact an admin.');
  }

  // Migrate legacy SHA-256 rows to scrypt now that we hold the plaintext.
  if (needsRehash(user.password)) {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(password) }
    });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  resetRateLimit(`login:acct:${normalizedEmail}`);
  await setSessionCookie(res, user.id, user.tokenVersion);

  return ok(res, {
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
}

export default withAudit(handler);
