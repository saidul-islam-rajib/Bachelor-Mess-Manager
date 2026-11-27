import type { ClientLogEntry } from '@/lib/log';

type Level = ClientLogEntry['level'];

const ENDPOINT = '/api/logs';
const FLUSH_MS = 5_000;
const FLUSH_AT = 20;
const BATCH_MAX = 50;
const BUFFER_MAX = 200;

const buffer: ClientLogEntry[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let installed = false;

export function logClient(
  level: Level,
  event: string,
  fields: { rid?: string | null; msg?: string; data?: unknown } = {}
): void {
  if (typeof window === 'undefined') return;
  const entry: ClientLogEntry = { ts: new Date().toISOString(), level, event: event.slice(0, 80) };
  if (fields.rid) entry.rid = fields.rid;
  if (fields.msg !== undefined) entry.msg = fields.msg;
  if (fields.data !== undefined) entry.data = fields.data;
  buffer.push(entry);
  if (buffer.length > BUFFER_MAX) buffer.splice(0, buffer.length - BUFFER_MAX);
  if (level === 'error' || buffer.length >= FLUSH_AT) void flushClientLog();
}

export function logApiFailure(method: string, path: string, status: number, rid: string | null): void {
  if (path.startsWith(ENDPOINT)) return;
  logClient(status >= 500 || status === 0 ? 'error' : 'warn', 'api.fail', {
    rid,
    data: { method, path: path.split('?')[0], status }
  });
}

function takeBatch(): ClientLogEntry[] {
  return buffer.splice(0, BATCH_MAX);
}

export async function flushClientLog(beacon = false): Promise<void> {
  while (buffer.length > 0) {
    const entries = takeBatch();
    const body = JSON.stringify({ platform: 'web', entries });
    try {
      if (beacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      } else {
        await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true
        });
      }
    } catch {
      return;
    }
  }
}

export function installClientLog(): () => void {
  if (typeof window === 'undefined' || installed) return () => undefined;
  installed = true;

  const onError = (event: ErrorEvent) => {
    logClient('error', 'window.error', {
      msg: event.message,
      data: { source: event.filename, line: event.lineno, col: event.colno, stack: event.error?.stack }
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    logClient('error', 'window.unhandledrejection', {
      msg: reason instanceof Error ? reason.message : String(reason),
      data: { stack: reason instanceof Error ? reason.stack : undefined }
    });
  };
  const onPageHide = () => {
    void flushClientLog(true);
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  window.addEventListener('pagehide', onPageHide);
  timer = setInterval(() => void flushClientLog(), FLUSH_MS);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    window.removeEventListener('pagehide', onPageHide);
    if (timer) clearInterval(timer);
    timer = null;
    installed = false;
  };
}
