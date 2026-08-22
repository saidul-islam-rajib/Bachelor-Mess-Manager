import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { methodNotAllowed, notFound, unauthorized } from '@/lib/http';
import { imageExists, isPubliclyViewable, readImage } from '@/lib/uploads';
import { uploadConfig } from '@/config';
import { withAudit } from '@/lib/with-audit';

function matchesEtag(header: string | string[] | undefined, etag: string): boolean {
  if (!header) return false;

  const raw = Array.isArray(header) ? header.join(',') : header;
  if (raw.trim() === '*') return true;

  return raw
    .split(',')
    .map((candidate) => candidate.trim().replace(/^W\//, ''))
    .includes(etag);
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return methodNotAllowed(res, ['GET', 'HEAD']);
  }

  const name = Array.isArray(req.query.file) ? req.query.file[0] : req.query.file;
  if (!name) {
    return notFound(res, 'Not found.');
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser && !(await isPubliclyViewable(name))) {
    return unauthorized(res, 'You must be signed in.');
  }

  const etag = `"${name}"`;
  const cacheControl = `private, max-age=${uploadConfig.cacheMaxAgeSeconds}, immutable`;

  if (matchesEtag(req.headers['if-none-match'], etag)) {
    if (!(await imageExists(name))) {
      return notFound(res, 'Not found.');
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(304).end();
  }

  const file = await readImage(name);
  if (!file) {
    return notFound(res, 'Not found.');
  }

  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Length', file.body.length);
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(file.body);
}

export default withAudit(handler);
