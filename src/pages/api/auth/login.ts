import type { NextApiRequest, NextApiResponse } from 'next';
import { setSessionCookie, setThemeCookie } from '@/lib/auth';
import { methodNotAllowed, ok } from '@/lib/http';
import { authenticateLogin } from '@/lib/login';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const user = await authenticateLogin(req, res);
  if (!user) return;

  await setSessionCookie(res, user);
  setThemeCookie(res, user.theme);

  return ok(res, {
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
}

export default withAudit(handler);
