import type { NextApiHandler } from 'next';
import { parseCookies, SESSION_COOKIE_NAME } from '@/lib/auth';
import { runWithActor } from '@/lib/audit';

export function withAudit(handler: NextApiHandler): NextApiHandler {
  return (req, res) => {
    const actorId = parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME] ?? null;
    return runWithActor(actorId, () => handler(req, res));
  };
}
