import type { NextApiRequest, NextApiResponse } from 'next';
import { serializeCookie } from '@/lib/auth';
import { methodNotAllowed, ok } from '@/lib/http';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const cookie = serializeCookie('mess_session_user_id', '', { maxAge: 0 });
  res.setHeader('Set-Cookie', cookie);
  return ok(res, { message: 'Logged out' });
}
