import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';
import { hashPassword, validatePasswordWithPolicy } from '@/lib/password';
import { USER_STATUS } from '@/lib/constants';
import { badRequest, methodNotAllowed, ok, tooManyRequests } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { consumeToken, findValidToken, TOKEN_PURPOSE } from '@/lib/password-tokens';
import { getSecurityPolicy, getSiteSettings } from '@/lib/settings-service';
import { ensureWelcomeMessage } from '@/lib/community';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

const MAX_ATTEMPTS = 20;
const WINDOW_MS = 15 * 60 * 1000;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  const limit = rateLimit(`set-password:${clientIp(req)}`, MAX_ATTEMPTS, WINDOW_MS);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return tooManyRequests(res, strings.errors.tooManyRequests);
  }

  if (req.method === 'GET') {
    const token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
    const lookup = await findValidToken(token);

    if (!lookup.ok) {
      return badRequest(res, lookup.error, { valid: false });
    }

    return ok(res, { valid: true, name: lookup.name, email: lookup.email, purpose: lookup.purpose });
  }

  const { token, password } = req.body as Record<string, unknown>;

  const lookup = await findValidToken(token);
  if (!lookup.ok) {
    return badRequest(res, lookup.error, { valid: false });
  }

  const policy = await getSecurityPolicy();
  const passwordCheck = validatePasswordWithPolicy(password, policy.requireStrongPasswords);
  if (!passwordCheck.ok) {
    return badRequest(res, passwordCheck.error);
  }

  const current = await prisma.user.findUnique({
    where: { id: lookup.userId },
    select: { status: true }
  });

  const settings = await getSiteSettings();
  const settledStatus = settings.autoApproveRegistration ? USER_STATUS.APPROVED : USER_STATUS.PENDING;

  const user = await prisma.user.update({
    where: { id: lookup.userId },
    data: {
      password: await hashPassword(password as string),
      tokenVersion: { increment: 1 },
      ...(current?.status === USER_STATUS.UNVERIFIED ? { status: settledStatus } : {})
    },
    select: { id: true, name: true, email: true, role: true, status: true, tokenVersion: true }
  });

  await consumeToken(lookup.tokenId);

  const isReset = lookup.purpose === TOKEN_PURPOSE.RESET;

  if (user.status === USER_STATUS.APPROVED) {
    await ensureWelcomeMessage(user);
    await setSessionCookie(res, user.id, user.tokenVersion);
    return ok(res, {
      signedIn: true,
      message: isReset ? strings.auth.setPassword.resetSuccessSignedIn : strings.auth.setPassword.successSignedIn,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  }

  return ok(res, {
    signedIn: false,
    message: isReset ? strings.auth.setPassword.resetSuccessPending : strings.auth.setPassword.successPending
  });
}

export default withAudit(handler);
