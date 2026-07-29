import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { methodNotAllowed, notFound, unauthorized } from '@/lib/http';
import { readProfileImage } from '@/lib/uploads';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return methodNotAllowed(res, ['GET', 'HEAD']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const name = Array.isArray(req.query.file) ? req.query.file[0] : req.query.file;
  if (!name) {
    return notFound(res, 'Not found.');
  }

  const file = await readProfileImage(name);
  if (!file) {
    return notFound(res, 'Not found.');
  }

  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Length', file.body.length);

  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(file.body);
}

export default withAudit(handler);
