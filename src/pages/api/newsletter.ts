import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { badRequest, methodNotAllowed, ok } from '@/lib/http';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const { email } = req.body as { email?: string };
  if (!email || !EMAIL_RE.test(email)) {
    return badRequest(res, 'A valid email is required.');
  }

  const normalized = email.trim().toLowerCase();
  const existing = await prisma.subscriber.findUnique({ where: { email: normalized } });
  if (existing) {
    return ok(res, { message: "You're already subscribed." });
  }

  await prisma.subscriber.create({ data: { email: normalized } });
  return ok(res, { message: 'Thanks for subscribing!' });
}
