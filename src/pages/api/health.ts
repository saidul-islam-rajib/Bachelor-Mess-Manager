import type { NextApiRequest, NextApiResponse } from 'next';
import { getBootstrapStatus } from '@/lib/bootstrap';
import { methodNotAllowed, ok, serverError } from '@/lib/http';
import { withAudit } from '@/lib/with-audit';

function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const bootstrap = getBootstrapStatus();

  const body = {
    status: bootstrap.error ? 'degraded' : 'ok',
    bootstrap: {
      completedAt: bootstrap.completedAt,
      roles: bootstrap.reference?.roles ?? null,
      permissions: bootstrap.reference?.permissions ?? null,
      administrator: bootstrap.administrator?.status ?? null,
      administratorMessage: bootstrap.administratorMessage,
      error: bootstrap.error
    }
  };

  if (bootstrap.error) {
    return serverError(res, body.bootstrap.error ?? undefined);
  }

  return ok(res, body);
}

export default withAudit(handler);
