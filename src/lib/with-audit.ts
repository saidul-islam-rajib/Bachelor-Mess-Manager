import type { NextApiHandler } from 'next';
import { parseCookies, SESSION_COOKIE_NAME } from '@/lib/auth';
import { runWithActor } from '@/lib/audit';
import { verifySessionToken } from '@/lib/session';
import { serverError } from '@/lib/http';

/**
 * Wraps an API route so that:
 *  - createdById / updatedById are stamped from the *verified* session (an
 *    unsigned cookie must never be able to attribute writes to someone else);
 *  - an unexpected throw becomes a clean 500 JSON body instead of an HTML error
 *    page, which the client's `res.json()` calls all assume.
 */
export function withAudit(handler: NextApiHandler): NextApiHandler {
  return async (req, res) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME];
    const payload = await verifySessionToken(token);

    return runWithActor(payload?.uid ?? null, async () => {
      try {
        return await handler(req, res);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`[api] ${req.method} ${req.url} failed:`, error);
        if (res.headersSent) return;
        return serverError(res);
      }
    });
  };
}
