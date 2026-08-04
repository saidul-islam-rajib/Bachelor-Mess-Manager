type Entry<T> = { value: T; expiresAt: number };

type Store = {
  entries: Map<string, Entry<unknown>>;
  inFlight: Map<string, Promise<unknown>>;
};

const globalForCache = globalThis as unknown as { appCache?: Store };

const store: Store = globalForCache.appCache ?? { entries: new Map(), inFlight: new Map() };
globalForCache.appCache = store;

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.entries.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const pending = store.inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const request = load()
    .then((value) => {
      if (ttlMs > 0) store.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      store.inFlight.delete(key);
    });

  store.inFlight.set(key, request);
  return request;
}

export function invalidate(key: string) {
  store.entries.delete(key);
}

export function invalidatePrefix(prefix: string) {
  for (const key of store.entries.keys()) {
    if (key.startsWith(prefix)) store.entries.delete(key);
  }
}

export function clearCache() {
  store.entries.clear();
}
