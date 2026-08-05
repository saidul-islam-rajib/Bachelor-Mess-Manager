import { describeAdminOutcome, ensureAdministrator, type AdminBootstrapOutcome } from '@/lib/bootstrap/admin';
import { publishPendingAnnouncements } from '@/lib/community';
import { syncRolesAndPermissions, type RoleSyncResult } from '@/lib/bootstrap/roles';
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

const globalForBootstrap = globalThis as unknown as {
  applicationBootstrap?: Promise<void>;
  applicationBootstrapStatus?: BootstrapStatus;
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
    globalForBootstrap.applicationBootstrapStatus = {
      ...EMPTY_STATUS,
      error: error instanceof Error ? error.message : String(error)
    };
    globalForBootstrap.applicationBootstrap = undefined;
  }
}

export function bootstrapApplication(): Promise<void> {
  globalForBootstrap.applicationBootstrap ??= runBootstrap();
  return globalForBootstrap.applicationBootstrap;
}

export function getBootstrapStatus(): BootstrapStatus {
  return globalForBootstrap.applicationBootstrapStatus ?? EMPTY_STATUS;
}
