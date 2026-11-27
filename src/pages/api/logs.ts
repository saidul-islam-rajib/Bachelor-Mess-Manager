import type { NextApiRequest, NextApiResponse } from 'next';
import { emitClientBatch, parseClientBatch } from '@/lib/log';
import { badRequest, methodNotAllowed, noContent } from '@/lib/http';
import { withAudit } from '@/lib/with-audit';

export const MAX_LOG_BODY_BYTES = 32 * 1024;

export const config = {
  api: { bodyParser: { sizeLimit: MAX_LOG_BODY_BYTES } }
};

function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const batch = parseClientBatch(req.body);
  if (!batch) {
    return badRequest(res);
  }

  emitClientBatch(batch);
  return noContent(res);
}

export default withAudit(handler, { maxRequestBodyBytes: MAX_LOG_BODY_BYTES });
