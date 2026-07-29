import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { methodNotAllowed, notFound, unauthorized } from '@/lib/http';
import { readProfileImage } from '@/lib/uploads';
import { withAudit } from '@/lib/with-audit';

/**
 * Serves an uploaded profile image.
 *
 * These live outside `public/` because Next.js snapshots that directory at build
 * time, so files written at runtime would 404 under `next start`. Reading from
 * disk per request also lets us require a session — avatars stay inside the mess.
 */
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
  // File names carry a random suffix, so a given URL's bytes never change.
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(file.body);
}

export default withAudit(handler);
