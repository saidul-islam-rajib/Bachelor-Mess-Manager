import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { USER_ROLES, USER_STATUS } from '@/lib/constants';
import { badRequest, conflict, created, methodNotAllowed } from '@/lib/http';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const { name, email, password } = req.body as { name?: string; email?: string; password?: string };

  if (!name || !email || !password) {
    return badRequest(res, 'Name, email and password are required.');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return conflict(res, 'Email already registered.');
  }

  // New sign-ups start as PENDING and are NOT logged in — an admin must approve first.
  await prisma.user.create({
    data: {
      name,
      email,
      password: hashPassword(password),
      role: USER_ROLES.MEMBER,
      status: USER_STATUS.PENDING
    }
  });

  return created(res, {
    message: 'Registration submitted. An admin will review your account, and you can sign in once it is approved.'
  });
}

export default withAudit(handler);
