import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { hashPassword } from '@/lib/auth';
import { badRequest, methodNotAllowed, ok, unauthorized } from '@/lib/http';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    return methodNotAllowed(res, ['PATCH']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const { name, phone, password } = req.body as { name?: string; phone?: string; password?: string };

  const data: { name?: string; phone?: string | null; password?: string } = {};
  if (typeof name === 'string' && name.trim()) {
    data.name = name.trim();
  }
  if (typeof phone === 'string') {
    data.phone = phone.trim() || null;
  }
  if (typeof password === 'string' && password.length > 0) {
    if (password.length < 6) {
      return badRequest(res, 'Password must be at least 6 characters.');
    }
    data.password = hashPassword(password);
  }

  if (Object.keys(data).length === 0) {
    return badRequest(res, 'Nothing to update.');
  }

  const user = await prisma.user.update({
    where: { id: sessionUser.id },
    data,
    select: { id: true, name: true, email: true, role: true, phone: true, profileImage: true }
  });

  return ok(res, { user });
}
