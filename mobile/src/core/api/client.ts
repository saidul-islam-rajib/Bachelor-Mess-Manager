import { z } from 'zod';
import { DEFAULT_API_URL } from '@/core/config';
import { storage, STORAGE_KEYS } from '@/core/storage';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

let baseUrl = DEFAULT_API_URL;
let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setBaseUrl = (url: string) => {
  baseUrl = url;
};
export const getBaseUrl = () => baseUrl;
export const setToken = (value: string | null) => {
  token = value;
};
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

export async function loadSavedServer(): Promise<string> {
  const saved = await storage.get(STORAGE_KEYS.apiUrl);
  if (saved) baseUrl = saved;
  return baseUrl;
}

const errorShape = z.object({ error: z.string() });

const REFRESH_PATH = '/api/mobile/v1/auth/refresh';
const refreshSchema = z.object({ token: z.string(), expiresAt: z.union([z.string(), z.number()]) });

let refreshing: Promise<boolean> | null = null;

function refreshToken(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await send(REFRESH_PATH, { method: 'POST' });
        if (!res.ok) return false;
        const parsed = refreshSchema.safeParse(await res.json().catch(() => null));
        if (!parsed.success) return false;
        token = parsed.data.token;
        await storage.set(STORAGE_KEYS.token, parsed.data.token);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

function send(path: string, init: { method?: string; body?: unknown; auth?: boolean }) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.auth !== false && token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  let res = await send(path, init);
  if (res.status === 401 && init.auth !== false && path !== REFRESH_PATH && token) {
    if (await refreshToken()) {
      res = await send(path, init);
    }
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && init.auth !== false) onUnauthorized?.();
    const parsed = errorShape.safeParse(json);
    const retry = Number(res.headers.get('Retry-After'));
    throw new ApiError(res.status, parsed.success ? parsed.data.error : 'Request failed', Number.isFinite(retry) && retry > 0 ? retry : undefined);
  }
  return schema.parse(json);
}

export async function checkHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
