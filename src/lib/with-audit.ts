import type { NextApiHandler, NextApiRequest } from 'next';
import { parseCookies, SESSION_COOKIE_NAME } from '@/lib/auth';
import { runWithActor } from '@/lib/audit';
import { bootstrapApplication, bootstrapWithin } from '@/lib/bootstrap';
import { securityConfig } from '@/config';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { verifySessionToken } from '@/lib/session';
import { payloadTooLarge, serverError, tooManyRequests } from '@/lib/http';

const WINDOW_MS = 60_000;
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const READ_BOOTSTRAP_WAIT_MS = 1_500;

function isRead(req: NextApiRequest): boolean {
  return READ_METHODS.has((req.method ?? 'GET').toUpperCase());
}

function declaredBodyBytes(req: NextApiRequest): number {
  const raw = req.headers['content-length'];
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export type AuditOptions = {
  maxRequestBodyBytes?: number;
};

export function withAudit(handler: NextApiHandler, options: AuditOptions = {}): NextApiHandler {
  const maxRequestBodyBytes = Math.max(
    securityConfig.maxRequestBodyBytes,
    options.maxRequestBodyBytes ?? securityConfig.maxRequestBodyBytes
  );

  return async (req, res) => {
    if (declaredBodyBytes(req) > maxRequestBodyBytes) {
      return payloadTooLarge(res);
    }

    const read = isRead(req);
    const limit = read
      ? securityConfig.maxReadRequestsPerMinute
      : securityConfig.maxWriteRequestsPerMinute;
    const bucket = rateLimit(`api:${read ? 'r' : 'w'}:${clientIp(req)}`, limit, WINDOW_MS);

    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(bucket.remaining));

    if (!bucket.allowed) {
      res.setHeader('Retry-After', String(bucket.retryAfter));
      return tooManyRequests(res);
    }

    if (read) await bootstrapWithin(READ_BOOTSTRAP_WAIT_MS);
    else await bootstrapApplication();

    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME];
    const payload = await verifySessionToken(token);

    return runWithActor(payload?.uid ?? null, async () => {
      try {
        return await handler(req, res);
      } catch (error) {
        console.error(`[api] ${req.method ?? 'GET'} ${req.url ?? ''} failed`, error);
        if (res.headersSent) return;
        return serverError(res);
      }
    });
  };
}
