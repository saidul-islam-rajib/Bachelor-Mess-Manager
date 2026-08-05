import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { listLockedAccounts, unlockAccount } from '@/lib/login-attempts';
import { getSiteSettings, invalidateSecurityPolicyCache } from '@/lib/settings-service';
import { prisma } from '@/lib/prisma';
import { SETTINGS_SINGLETON_ID } from '@/lib/constants';
import { strings } from '@/lib/i18n';
import { normalizeEmail } from '@/lib/validation';
import { withAudit } from '@/lib/with-audit';

const NUMERIC_FIELDS = [
  { key: 'maxLoginAttempts', min: 1, max: 100 },
  { key: 'loginLockoutMinutes', min: 1, max: 1440 },
  { key: 'maxLoginAttemptsPerIp', min: 1, max: 1000 },
  { key: 'ipLockoutMinutes', min: 1, max: 1440 },
  { key: 'maxRegistrationsPerIp', min: 1, max: 1000 },
  { key: 'registrationWindowMinutes', min: 1, max: 1440 }
] as const;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, strings.errors.unauthorized);
  }
  if (!hasPermission(sessionUser, PERMISSIONS.SECURITY_MANAGE)) {
    return forbidden(res, strings.errors.adminOnly);
  }

  if (req.method === 'GET') {
    const [settings, lockedAccounts] = await Promise.all([getSiteSettings(), listLockedAccounts()]);

    return ok(res, {
      policy: {
        maxLoginAttempts: settings.maxLoginAttempts,
        loginLockoutMinutes: settings.loginLockoutMinutes,
        maxLoginAttemptsPerIp: settings.maxLoginAttemptsPerIp,
        ipLockoutMinutes: settings.ipLockoutMinutes,
        maxRegistrationsPerIp: settings.maxRegistrationsPerIp,
        registrationWindowMinutes: settings.registrationWindowMinutes,
        requireStrongPasswords: settings.requireStrongPasswords
      },
      lockedAccounts
    });
  }

  if (req.method === 'PATCH') {
    const body = req.body as Record<string, unknown>;
    const data: Record<string, number | boolean> = {};

    for (const field of NUMERIC_FIELDS) {
      if (body[field.key] === undefined) continue;
      const value = Math.trunc(Number(body[field.key]));
      if (!Number.isFinite(value) || value < field.min || value > field.max) {
        return badRequest(res, `${field.key} must be between ${field.min} and ${field.max}.`);
      }
      data[field.key] = value;
    }

    if (typeof body.requireStrongPasswords === 'boolean') {
      data.requireStrongPasswords = body.requireStrongPasswords;
    }

    if (Object.keys(data).length === 0) {
      return badRequest(res, strings.validation.nothingToUpdate);
    }

    const settings = await prisma.siteSettings.upsert({
      where: { id: SETTINGS_SINGLETON_ID },
      update: data,
      create: { id: SETTINGS_SINGLETON_ID, ...data }
    });

    invalidateSecurityPolicyCache();

    return ok(res, {
      policy: {
        maxLoginAttempts: settings.maxLoginAttempts,
        loginLockoutMinutes: settings.loginLockoutMinutes,
        maxLoginAttemptsPerIp: settings.maxLoginAttemptsPerIp,
        ipLockoutMinutes: settings.ipLockoutMinutes,
        maxRegistrationsPerIp: settings.maxRegistrationsPerIp,
        registrationWindowMinutes: settings.registrationWindowMinutes,
        requireStrongPasswords: settings.requireStrongPasswords
      }
    });
  }

  if (req.method === 'DELETE') {
    const { email } = req.body as { email?: string };
    if (typeof email !== 'string' || !email.trim()) {
      return badRequest(res, strings.validation.emailRequired);
    }

    await unlockAccount(normalizeEmail(email));
    return ok(res, { unlocked: true, email: normalizeEmail(email) });
  }

  return methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
}

export default withAudit(handler);
