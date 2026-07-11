import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword, serializeCookie } from '@/lib/auth';
import { USER_STATUS } from '@/lib/constants';
import { badRequest, forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return badRequest(res, 'Email and password are required.');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.password !== hashPassword(password)) {
    return unauthorized(res, 'Invalid email or password.');
  }

  if (user.status === USER_STATUS.PENDING) {
    return forbidden(res, 'Your account is awaiting admin approval.');
  }
  if (user.status !== USER_STATUS.APPROVED) {
    return forbidden(res, 'Your account is not active. Please contact an admin.');
  }

  // Session stays valid for 24 hours (or until the user logs out).
  const cookie = serializeCookie('mess_session_user_id', user.id, { maxAge: 60 * 60 * 24 });
  res.setHeader('Set-Cookie', cookie);

  return ok(res, { user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
