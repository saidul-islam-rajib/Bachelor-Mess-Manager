import type { NextApiHandler } from 'next';
import { parseCookies, SESSION_COOKIE_NAME } from '@/lib/auth';
import { runWithActor } from '@/lib/audit';
import { bootstrapApplication } from '@/lib/bootstrap';
import { verifySessionToken } from '@/lib/session';
import { serverError } from '@/lib/http';

export function withAudit(handler: NextApiHandler): NextApiHandler {
  return async (req, res) => {
    await bootstrapApplication();

    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME];
    const payload = await verifySessionToken(token);

    return runWithActor(payload?.uid ?? null, async () => {
      try {
        return await handler(req, res);
      } catch {
        if (res.headersSent) return;
        return serverError(res);
      }
    });
  };
}
