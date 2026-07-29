// A small in-process rate limiter for the auth routes.
//
// Scope: this counts within a single Node process. That is the right fit for the
// single-instance SQL Server deployment this app targets, and it already stops
// the thing that matters — someone hammering /api/auth/login with a password
// list. If this is ever run behind several instances, swap the Map for Redis;
// the call sites do not change.

type Bucket = { count: number; resetAt: number };

const globalForRateLimit = globalThis as unknown as { rateLimitBuckets?: Map<string, Bucket> };
const buckets = globalForRateLimit.rateLimitBuckets ?? new Map<string, Bucket>();
globalForRateLimit.rateLimitBuckets = buckets;

let lastSweep = 0;

function sweep(now: number) {
  // Cheap amortised cleanup so the Map cannot grow without bound.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
};

/**
 * Consume one unit against `key`. Returns whether the caller is under the limit.
 * The window is fixed: it starts on the first hit and resets `windowMs` later.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: Math.ceil(windowMs / 1000) };
  }

  bucket.count += 1;
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter
  };
}

/** Forget a key — called after a successful login so one typo does not linger. */
export function resetRateLimit(key: string) {
  buckets.delete(key);
}

/**
 * Best-effort client IP. `x-forwarded-for` is only trustworthy behind a proxy
 * that sets it (Vercel, nginx); we fall back to the socket address otherwise.
 */
export function clientIp(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',')[0].trim();
  }
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.trim()) return real.trim();
  return req.socket?.remoteAddress ?? 'unknown';
}
