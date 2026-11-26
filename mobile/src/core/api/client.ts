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

export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.auth !== false && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
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
