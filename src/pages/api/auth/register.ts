import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';
import { hashPassword, validatePassword } from '@/lib/password';
import { USER_ROLES, USER_STATUS } from '@/lib/constants';
import { badRequest, conflict, created, methodNotAllowed } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { validateEmail, validateName, validatePhone } from '@/lib/validation';
import { withAudit } from '@/lib/with-audit';

const PER_IP_LIMIT = 5;
const PER_IP_WINDOW_MS = 60 * 60 * 1000;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const limit = rateLimit(`register:ip:${clientIp(req)}`, PER_IP_LIMIT, PER_IP_WINDOW_MS);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ error: 'Too many sign-up attempts. Please try again later.' });
  }

  const { name, email, password, phone } = req.body as Record<string, unknown>;

  const nameCheck = validateName(name);
  if (!nameCheck.ok) return badRequest(res, nameCheck.error);

  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) return badRequest(res, emailCheck.error);

  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.ok) return badRequest(res, phoneCheck.error);

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) return badRequest(res, passwordCheck.error);

  const existing = await prisma.user.findUnique({ where: { email: emailCheck.value }, select: { id: true } });
  if (existing) {
    // This app's user list is already visible to admins and every account needs
    // manual approval, so a clear "already registered" beats a vague success
    // message that would leave someone waiting for an approval that never comes.
    return conflict(res, 'That email is already registered. Try signing in instead.');
  }

  // Bootstrap: the very first account on a fresh database becomes the admin and
  // is signed in immediately — otherwise there would be nobody to approve anyone.
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

    if (isFirstUser) {
      await setSessionCookie(res, user.id, user.tokenVersion);
      return created(res, {
        message: 'Welcome! As the first account on this system you have been made the administrator.',
        signedIn: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    }

    return created(res, {
      message:
        'Registration submitted. An admin will review your account, and you can sign in once it is approved.',
      signedIn: false
    });
  } catch (error) {
    // Two people submitting the same email at the same moment lose the race here.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return conflict(res, 'That email is already registered. Try signing in instead.');
    }
    throw error;
  }
}

export default withAudit(handler);
