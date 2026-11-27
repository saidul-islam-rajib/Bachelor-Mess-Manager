import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type Entry = {
  ts: string;
  level: LogLevel;
  event: string;
  rid?: string;
  msg?: string;
  data?: Record<string, unknown>;
};

const MAX_BUFFER = 200;
const MAX_BATCH = 50;
const FLUSH_MS = 5000;
const FLUSH_AT = 20;

let buffer: Entry[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let resolveBase: () => string = () => '';

export const configureLog = (getBase: () => string) => {
  resolveBase = getBase;
};

export const newRequestId = () => {
  let out = '';
  for (let i = 0; i < 16; i += 1) out += Math.floor(Math.random() * 16).toString(16);
  return out;
};

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (flushing || buffer.length === 0) return;
  const base = resolveBase();
  if (!base) return;
  flushing = true;
  const batch = buffer.slice(0, MAX_BATCH);
  buffer = buffer.slice(batch.length);
  try {
    const appVersion = Constants.expoConfig?.version;
    await fetch(`${base}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: Platform.OS === 'ios' ? 'ios' : 'android', appVersion, entries: batch }),
    });
  } catch {
  } finally {
    flushing = false;
  }
  if (buffer.length >= FLUSH_AT) void flush();
}

export const flushLog = flush;

export function resetLog() {
  buffer = [];
  flushing = false;
  if (timer) clearTimeout(timer);
  timer = null;
}

export function log(level: LogLevel, event: string, fields: { rid?: string; msg?: string; data?: Record<string, unknown> } = {}) {
  try {
    const entry: Entry = { ts: new Date().toISOString(), level, event, ...fields };
    if (__DEV__) {
      const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      sink(`[${event}]`, fields.msg ?? '', fields.data ?? '');
    }
    buffer.push(entry);
    if (buffer.length > MAX_BUFFER) buffer = buffer.slice(buffer.length - MAX_BUFFER);
    if (level === 'error' || buffer.length >= FLUSH_AT) void flush();
    else if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS);
  } catch {
  }
}

export function logError(event: string, error: unknown, data?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(String(error));
  log('error', event, { msg: err.message, data: { ...data, name: err.name, stack: (err.stack ?? '').split('\n').slice(0, 20).join('\n') } });
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsShape = { getGlobalHandler: () => GlobalHandler; setGlobalHandler: (h: GlobalHandler) => void };

let installed = false;
export function installGlobalHandler() {
  if (installed) return;
  const utils = (globalThis as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (!utils) return;
  installed = true;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    logError('app.crash', error, { fatal: Boolean(isFatal) });
    previous?.(error, isFatal);
  });
}
