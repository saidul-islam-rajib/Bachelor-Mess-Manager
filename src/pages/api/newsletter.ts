import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, methodNotAllowed, ok, tooManyRequests, unauthorized } from '@/lib/http';
import { strings } from '@/lib/i18n';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { isValidEmail } from '@/lib/validation';
import { withAudit } from '@/lib/with-audit';

const ANON_LIMIT = 5;
const ANON_WINDOW_MS = 60 * 60 * 1000;

function normalize(email: string) {
  return email.trim().toLowerCase();
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);
  const sessionEmail = sessionUser ? normalize(sessionUser.email) : null;

  if (req.method === 'GET') {
    if (!sessionEmail) {
      return ok(res, { subscribed: false, email: null });
    }

    const existing = await prisma.subscriber.findUnique({ where: { email: sessionEmail } });
    return ok(res, { subscribed: Boolean(existing?.isPublished), email: sessionEmail });
  }

  if (req.method === 'POST') {
    const bodyEmail = (req.body as { email?: string })?.email;
    const email = sessionEmail ?? (typeof bodyEmail === 'string' ? normalize(bodyEmail) : '');

    if (!email || !isValidEmail(email)) {
      return badRequest(res, strings.footer.emailRequired);
    }

    if (!sessionEmail) {
      const limit = rateLimit(`newsletter:${clientIp(req)}`, ANON_LIMIT, ANON_WINDOW_MS);
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retryAfter));
        return tooManyRequests(res);
      }
    }

    const existing = await prisma.subscriber.findUnique({ where: { email } });

    if (existing?.isPublished) {
      return ok(res, {
        subscribed: true,
        email,
        message: sessionEmail ? strings.footer.alreadySubscribed : strings.footer.subscribed
      });
    }

    if (existing) {
      await prisma.subscriber.update({
        where: { email },
        data: { isPublished: true, publishedAt: new Date(), unpublishedAt: null }
      });
    } else {
      await prisma.subscriber.create({ data: { email, publishedAt: new Date() } });
    }

    return ok(res, { subscribed: true, email, message: strings.footer.subscribed });
  }

  if (req.method === 'DELETE') {
    if (!sessionEmail) {
      return unauthorized(res, strings.footer.unsubscribeSignedInOnly);
    }

    const existing = await prisma.subscriber.findUnique({ where: { email: sessionEmail } });
    if (existing?.isPublished) {
      await prisma.subscriber.update({
        where: { email: sessionEmail },
        data: { isPublished: false, unpublishedAt: new Date() }
      });
    }

    return ok(res, { subscribed: false, email: sessionEmail, message: strings.footer.unsubscribed });
  }

  return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
}

export default withAudit(handler);
