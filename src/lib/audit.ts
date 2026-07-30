import { AsyncLocalStorage } from 'node:async_hooks';

type AuditContext = { actorId: string | null };

const globalForAudit = globalThis as unknown as { auditStorage?: AsyncLocalStorage<AuditContext> };

const storage = globalForAudit.auditStorage ?? new AsyncLocalStorage<AuditContext>();
globalForAudit.auditStorage = storage;

export function runWithActor<T>(actorId: string | null, fn: () => T): T {
  return storage.run({ actorId }, fn);
}

export function getActorId(): string | null {
  return storage.getStore()?.actorId ?? null;
}

export function stampCreate<T>(data: T): T {
  const actorId = getActorId();
  if (!actorId || !data || typeof data !== 'object') return data;

  const row = data as Record<string, unknown>;
  return {
    ...row,
    createdById: row.createdById ?? actorId,
    updatedById: row.updatedById ?? actorId
  } as T;
}

export function stampUpdate<T>(data: T): T {
  const actorId = getActorId();
  if (!actorId || !data || typeof data !== 'object') return data;

  const row = data as Record<string, unknown>;
  return { ...row, updatedById: row.updatedById ?? actorId } as T;
}
