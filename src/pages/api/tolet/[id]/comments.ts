import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, created, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { toLetConfig } from '@/config';
import { addComment, findListing, listComments, notifyNewComment } from '@/lib/tolet';
import { strings } from '@/lib/i18n';
import { findXssField } from '@/lib/xss';
import { withAudit } from '@/lib/with-audit';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const listingId = firstParam(req.query.id);
  if (!listingId) return badRequest(res, strings.toLet.idRequired);

  if (req.method === 'GET') {
    const listing = await findListing(listingId);
    if (!listing) return notFound(res, strings.toLet.notFound);

    const comments = await listComments(listingId);
    return ok(res, { comments });
  }

  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) return unauthorized(res, strings.toLet.signedOut);

  const listing = await findListing(listingId);
  if (!listing) return notFound(res, strings.toLet.notFound);

  const { text } = req.body as { text?: string };
  const value = typeof text === 'string' ? text.trim() : '';

  if (!value) return badRequest(res, strings.toLet.comments.required);
  if (value.length > toLetConfig.commentMaxLength) {
    return badRequest(res, strings.toLet.comments.tooLong(toLetConfig.commentMaxLength));
  }
  if (findXssField({ text: value })) return badRequest(res, strings.errors.suspiciousInput);

  const comment = await addComment({ listingId, userId: sessionUser.id, text: value });
  await notifyNewComment({ listing, commenterId: sessionUser.id, text: value });

  return created(res, { comment });
}

export default withAudit(handler);
