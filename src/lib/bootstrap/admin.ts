import { prisma } from '@/lib/prisma';
import { adminBootstrapConfig } from '@/config';
import { USER_ROLES, USER_STATUS } from '@/lib/constants';
import { hashPassword, validatePassword } from '@/lib/password';
import { normalizeEmail, validateEmail } from '@/lib/validation';

export type AdminBootstrapOutcome =
  | { status: 'created'; email: string }
  | { status: 'promoted'; email: string }
  | { status: 'exists'; email: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

export async function ensureAdministrator(): Promise<AdminBootstrapOutcome> {
  if (!adminBootstrapConfig.enabled) {
    return { status: 'skipped', reason: 'ADMIN_BOOTSTRAP_ENABLED is false.' };
  }

  if (!adminBootstrapConfig.email || !adminBootstrapConfig.password) {
    return {
      status: 'skipped',
      reason: 'ADMIN_EMAIL and ADMIN_PASSWORD are not set, so no administrator was created.'
    };
  }

  const emailCheck = validateEmail(adminBootstrapConfig.email);
  if (!emailCheck.ok) {
    return { status: 'failed', reason: `ADMIN_EMAIL is not a valid email address: ${emailCheck.error}` };
  }

  const passwordCheck = validatePassword(adminBootstrapConfig.password);
  if (!passwordCheck.ok) {
    return { status: 'failed', reason: `ADMIN_PASSWORD is not acceptable: ${passwordCheck.error}` };
  }

  const email = emailCheck.value;

  const existingAdmin = await prisma.user.findFirst({
    where: { role: USER_ROLES.ADMIN, status: USER_STATUS.APPROVED },
    select: { id: true, email: true }
  });

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, status: true }
  });

  if (existingByEmail) {
    if (existingByEmail.role === USER_ROLES.ADMIN && existingByEmail.status === USER_STATUS.APPROVED) {
      return { status: 'exists', email };
    }

    await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        role: USER_ROLES.ADMIN,
        status: USER_STATUS.APPROVED,
        publishedAt: new Date(),
        unpublishedAt: null,
        tokenVersion: { increment: 1 }
      }
    });
    return { status: 'promoted', email };
  }

  if (existingAdmin) {
    return { status: 'exists', email: existingAdmin.email };
  }

  await prisma.user.create({
    data: {
      name: adminBootstrapConfig.name,
      email,
      password: await hashPassword(adminBootstrapConfig.password),
      phone: adminBootstrapConfig.phone,
      role: USER_ROLES.ADMIN,
      status: USER_STATUS.APPROVED,
      publishedAt: new Date()
    }
  });

  return { status: 'created', email };
}

export function describeAdminOutcome(outcome: AdminBootstrapOutcome): string {
  switch (outcome.status) {
    case 'created':
      return `Administrator account created for ${outcome.email}.`;
    case 'promoted':
      return `Existing account ${outcome.email} promoted to administrator.`;
    case 'exists':
      return `Administrator already present (${outcome.email}); nothing to do.`;
    case 'skipped':
      return `Administrator bootstrap skipped: ${outcome.reason}`;
    case 'failed':
      return `Administrator bootstrap failed: ${outcome.reason}`;
    default:
      return 'Administrator bootstrap produced no result.';
  }
}

export function normalizeAdminEmail(email: string): string {
  return normalizeEmail(email);
}
