import { logConfig } from '@/config';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = { rid?: string | null; uid?: string | null };
type ContextProvider = () => LogContext | undefined;

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const REDACTED = '[redacted]';
const MAX_STRING = 500;
const MAX_ARRAY = 20;
const MAX_DEPTH = 6;
const MAX_STACK_LINES = 20;
const SENSITIVE_PARTS = ['password', 'token', 'secret', 'authorization', 'cookie', 'otp', 'apikey', 'p256dh'];
const SENSITIVE_EXACT = ['auth', 'code'];
const BEARER = /Bearer\s+\S+/gi;
const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;
const PLATFORMS = ['web', 'ios', 'android'];
const CLIENT_LEVELS = ['debug', 'info', 'warn', 'error'];
export const MAX_CLIENT_ENTRIES = 50;
const MAX_CLIENT_MSG = 1000;

const globalForLog = globalThis as unknown as { logContextProvider?: ContextProvider };

export function setLogContextProvider(provider: ContextProvider): void {
  globalForLog.logContextProvider = provider;
}

export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_EXACT.includes(lower) || SENSITIVE_PARTS.some((part) => lower.includes(part));
}

export function redactString(value: string): string {
  const cut = value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  return cut.replace(BEARER, 'Bearer [redacted]');
}

export function redact(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value === null || value === undefined) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (value instanceof Error) return serializeError(value);
  if (typeof value !== 'object') return String(value);
  if (depth >= MAX_DEPTH) return '[depth]';
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  let out: unknown;
  if (Array.isArray(value)) {
    out = value.slice(0, MAX_ARRAY).map((item) => redact(item, depth + 1, seen));
  } else {
    const row: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      row[key] = isSensitiveKey(key) ? REDACTED : redact(item, depth + 1, seen);
    }
    out = row;
  }
  seen.delete(value);
  return out;
}

export function serializeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactString(error.message),
      stack: error.stack
        ? redactString(error.stack.split('\n').slice(0, MAX_STACK_LINES).join('\n').slice(0, 4000))
        : undefined
    };
  }
  return { name: 'Error', message: redactString(String(error)) };
}

function enabled(level: LogLevel): boolean {
  const min = LEVELS[logConfig.level as LogLevel] ?? LEVELS.info;
  return LEVELS[level] >= min;
}

function context(): LogContext {
  try {
    return globalForLog.logContextProvider?.() ?? {};
  } catch {
    return {};
  }
}

export function emit(level: LogLevel, event: string, fields: Record<string, unknown> = {}, src = 'api'): void {
  try {
    if (!enabled(level)) return;
    const ctx = context();
    const safe = redact(fields) as Record<string, unknown>;
    const line: Record<string, unknown> = { ts: new Date().toISOString(), level, event, src };
    if (ctx.rid) line.rid = ctx.rid;
    if (ctx.uid) line.uid = ctx.uid;
    console.log(JSON.stringify({ ...line, ...safe, ...line }));
  } catch {
    return;
  }
}

export const log = {
  debug: (event: string, fields?: Record<string, unknown>) => emit('debug', event, fields),
  info: (event: string, fields?: Record<string, unknown>) => emit('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit('error', event, fields)
};

function summarize(result: unknown): Record<string, unknown> {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const row = result as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    if ('id' in row) out.id = row.id;
    if ('status' in row) out.status = row.status;
    if (Object.keys(out).length > 0) return out;
  }
  return { type: Array.isArray(result) ? 'array' : result === null ? 'null' : typeof result };
}

export function traced<A extends unknown[], R>(name: string, fn: (...args: A) => R): (...args: A) => R {
  return function tracedFn(this: unknown, ...args: A): R {
    const started = Date.now();
    log.debug('fn.start', { fn: name, args });

    const done = (result: unknown) => {
      log.info('fn.end', { fn: name, ms: Date.now() - started, result: summarize(result) });
    };
    const failed = (error: unknown) => {
      log.error('fn.error', { fn: name, ms: Date.now() - started, error: serializeError(error) });
    };

    let output: R;
    try {
      output = fn.apply(this, args);
    } catch (error) {
      failed(error);
      throw error;
    }

    if (output && typeof (output as { then?: unknown }).then === 'function') {
      return (output as unknown as Promise<unknown>).then(
        (result) => {
          done(result);
          return result;
        },
        (error) => {
          failed(error);
          throw error;
        }
      ) as unknown as R;
    }

    done(output);
    return output;
  };
}

export function resolveRequestId(header: string | string[] | undefined | null): string {
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw === 'string' && REQUEST_ID.test(raw)) return raw;
  return globalThis.crypto.randomUUID();
}

export type ClientLogEntry = {
  ts?: string;
  level: LogLevel;
  event: string;
  rid?: string;
  msg?: string;
  data?: unknown;
};

export type ClientLogBatch = {
  platform: 'web' | 'ios' | 'android';
  appVersion?: string;
  entries: ClientLogEntry[];
};

export function parseClientBatch(body: unknown): ClientLogBatch | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as Record<string, unknown>;
  if (typeof raw.platform !== 'string' || !PLATFORMS.includes(raw.platform)) return null;
  if (!Array.isArray(raw.entries) || raw.entries.length > MAX_CLIENT_ENTRIES) return null;

  const entries: ClientLogEntry[] = [];
  for (const item of raw.entries) {
    if (!item || typeof item !== 'object') return null;
    const entry = item as Record<string, unknown>;
    if (typeof entry.level !== 'string' || !CLIENT_LEVELS.includes(entry.level)) return null;
    if (typeof entry.event !== 'string' || entry.event.length === 0 || entry.event.length > 80) return null;
    entries.push({
      ts: typeof entry.ts === 'string' ? entry.ts.slice(0, 40) : undefined,
      level: entry.level as LogLevel,
      event: entry.event,
      rid: typeof entry.rid === 'string' && REQUEST_ID.test(entry.rid) ? entry.rid : undefined,
      msg: typeof entry.msg === 'string' ? entry.msg.slice(0, MAX_CLIENT_MSG) : undefined,
      data: entry.data
    });
  }

  return {
    platform: raw.platform as ClientLogBatch['platform'],
    appVersion: typeof raw.appVersion === 'string' ? raw.appVersion.slice(0, 40) : undefined,
    entries
  };
}

export function emitClientBatch(batch: ClientLogBatch): number {
  let written = 0;
  for (const entry of batch.entries) {
    if (!enabled(entry.level)) continue;
    try {
      const ctx = context();
      const line: Record<string, unknown> = {
        ts: new Date().toISOString(),
        level: entry.level,
        event: entry.event,
        src: batch.platform,
        client: true
      };
      if (entry.rid) line.rid = entry.rid;
      else if (ctx.rid) line.rid = ctx.rid;
      if (ctx.uid) line.uid = ctx.uid;
      if (entry.ts) line.clientTs = entry.ts;
      if (batch.appVersion) line.appVersion = batch.appVersion;
      if (entry.msg !== undefined) line.msg = redactString(entry.msg);
      if (entry.data !== undefined) line.data = redact(entry.data);
      console.log(JSON.stringify(line));
      written += 1;
    } catch {
      continue;
    }
  }
  return written;
}
