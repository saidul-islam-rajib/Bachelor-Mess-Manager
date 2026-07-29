import { securityConfig } from '@/config';

type Bucket = { count: number; resetAt: number };

const globalForRateLimit = globalThis as unknown as { rateLimitBuckets?: Map<string, Bucket> };
const buckets = globalForRateLimit.rateLimitBuckets ?? new Map<string, Bucket>();
globalForRateLimit.rateLimitBuckets = buckets;

const SWEEP_INTERVAL_MS = 60_000;
const MAX_BUCKETS = 50_000;

let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS && buckets.size < MAX_BUCKETS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size >= MAX_BUCKETS) {
    buckets.clear();
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
};

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

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export function clientIp(req: {
  headers: Record<string, unknown>;
  socket?: { remoteAddress?: string };
}): string {
  if (securityConfig.trustProxyHeaders) {
    const forwarded = req.headers['x-forwarded-for'];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (typeof raw === 'string' && raw.trim()) {
      return raw.split(',')[0].trim();
    }

    const real = req.headers['x-real-ip'];
    if (typeof real === 'string' && real.trim()) return real.trim();
  }

  return req.socket?.remoteAddress ?? 'unknown';
}
