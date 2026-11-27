import type { NextApiHandler, NextApiRequest } from 'next';
import { parseCookies, SESSION_COOKIE_NAME } from '@/lib/auth';
import { runWithActor } from '@/lib/audit';
import { emit, isSensitiveKey, redact, redactString, resolveRequestId, serializeError } from '@/lib/log';
import { bootstrapApplication, bootstrapWithin } from '@/lib/bootstrap';
import { securityConfig } from '@/config';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { readBearerToken, verifyMobileToken, verifySessionToken } from '@/lib/session';
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

const MAX_BODY_LOG_BYTES = 2048;

function headerValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

function redactedPath(url: string): string {
  const [path, query] = url.split('?');
  if (!query) return path;
  const params = new URLSearchParams(query);
  for (const key of Array.from(params.keys())) {
    if (isSensitiveKey(key)) params.set(key, '[redacted]');
  }
  return `${path}?${params.toString()}`;
}

function bodySummary(req: NextApiRequest): Record<string, unknown> {
  const contentType = headerValue(req.headers['content-type']);
  if (contentType.toLowerCase().startsWith('multipart/')) {
    return { contentType, bytes: declaredBodyBytes(req) };
  }
  if (req.body === undefined || req.body === null || req.body === '') return {};
  const text = JSON.stringify(redact(req.body)) ?? '';
  return { body: text.length > MAX_BODY_LOG_BYTES ? `${text.slice(0, MAX_BODY_LOG_BYTES)}…` : text };
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
    const requestId = resolveRequestId(req.headers['x-request-id']);
    res.setHeader('x-request-id', requestId);

    const started = Date.now();
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME];
    const payload = token
      ? await verifySessionToken(token)
      : await verifyMobileToken(readBearerToken(req.headers.authorization));
    const actorId = payload?.uid ?? null;

    return runWithActor(
      actorId,
      async () => {
        const url = req.url ?? '';
        const method = req.method ?? 'GET';

        res.once('finish', () => {
          const status = res.statusCode;
          const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
          emit(level, 'api.end', { method, path: redactedPath(url), status, ms: Date.now() - started });
        });

        emit('info', 'api.start', {
          method,
          path: redactedPath(url),
          ip: clientIp(req),
          ua: redactString(headerValue(req.headers['user-agent'])).slice(0, 120),
          ...bodySummary(req)
        });

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

        try {
          return await handler(req, res);
        } catch (error) {
          emit('error', 'api.error', { method, path: redactedPath(url), error: serializeError(error) });
          if (res.headersSent) return;
          return serverError(res);
        }
      },
      requestId
    );
  };
}
