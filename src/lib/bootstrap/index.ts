import { describeAdminOutcome, ensureAdministrator, type AdminBootstrapOutcome } from '@/lib/bootstrap/admin';
import { publishPendingAnnouncements } from '@/lib/community';
import { syncRolesAndPermissions, type RoleSyncResult } from '@/lib/bootstrap/roles';
import { log } from '@/lib/log';
import { getSiteSettings } from '@/lib/settings-service';

export type BootstrapStatus = {
  completedAt: string | null;
  reference: RoleSyncResult | null;
  administrator: AdminBootstrapOutcome | null;
  administratorMessage: string | null;
  error: string | null;
};

const EMPTY_STATUS: BootstrapStatus = {
  completedAt: null,
  reference: null,
  administrator: null,
  administratorMessage: null,
  error: null
};

const RETRY_COOLDOWN_MS = 30_000;

const globalForBootstrap = globalThis as unknown as {
  applicationBootstrap?: Promise<void>;
  applicationBootstrapStatus?: BootstrapStatus;
  applicationBootstrapRetryAt?: number;
};

globalForBootstrap.applicationBootstrapStatus ??= EMPTY_STATUS;

async function runBootstrap() {
  try {
    const reference = await syncRolesAndPermissions();
    await getSiteSettings();
    const administrator = await ensureAdministrator();
    await publishPendingAnnouncements();

    globalForBootstrap.applicationBootstrapStatus = {
      completedAt: new Date().toISOString(),
      reference,
      administrator,
      administratorMessage: describeAdminOutcome(administrator),
      error: null
    };
  } catch (error) {
    log.error('bootstrap.error', { error });

    globalForBootstrap.applicationBootstrapStatus = {
      ...EMPTY_STATUS,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function bootstrapApplication(): Promise<void> {
  const pending = globalForBootstrap.applicationBootstrap;
  if (pending) return pending;

  if (Date.now() < (globalForBootstrap.applicationBootstrapRetryAt ?? 0)) {
    return Promise.resolve();
  }

  const run = runBootstrap().then(() => {
    if (globalForBootstrap.applicationBootstrapStatus?.error) {
      globalForBootstrap.applicationBootstrap = undefined;
      globalForBootstrap.applicationBootstrapRetryAt = Date.now() + RETRY_COOLDOWN_MS;
    }
  });

  globalForBootstrap.applicationBootstrap = run;
  return run;
}

export function bootstrapWithin(timeoutMs: number): Promise<void> {
  const run = bootstrapApplication();
  if (timeoutMs <= 0) return run;

  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    run.then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export function getBootstrapStatus(): BootstrapStatus {
  return globalForBootstrap.applicationBootstrapStatus ?? EMPTY_STATUS;
}
