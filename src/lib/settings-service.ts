import { prisma } from '@/lib/prisma';
import { appConfig, securityConfig } from '@/config';
import { SETTINGS_SINGLETON_ID } from '@/lib/constants';

export type SecurityPolicy = {
  maxLoginAttempts: number;
  loginLockoutMinutes: number;
  maxLoginAttemptsPerIp: number;
  ipLockoutMinutes: number;
  maxRegistrationsPerIp: number;
  registrationWindowMinutes: number;
  requireStrongPasswords: boolean;
};

const CACHE_TTL_MS = 30_000;

type CacheEntry = { value: SecurityPolicy; expiresAt: number };

const globalForSettings = globalThis as unknown as { securityPolicyCache?: CacheEntry | null };

export async function getSiteSettings() {
  return prisma.siteSettings.upsert({
    where: { id: SETTINGS_SINGLETON_ID },
    update: {},
    create: {
      id: SETTINGS_SINGLETON_ID,
      companyName: appConfig.name,
      tagline: appConfig.tagline,
      copyrightOwner: appConfig.name,
      maxLoginAttempts: securityConfig.maxLoginAttempts,
      loginLockoutMinutes: securityConfig.loginLockoutMinutes,
      maxLoginAttemptsPerIp: securityConfig.maxLoginAttemptsPerIp,
      ipLockoutMinutes: securityConfig.ipLockoutMinutes,
      maxRegistrationsPerIp: securityConfig.maxRegistrationsPerIp,
      registrationWindowMinutes: securityConfig.registrationWindowMinutes
    }
  });
}

export function invalidateSecurityPolicyCache() {
  globalForSettings.securityPolicyCache = null;
}

export async function getSecurityPolicy(): Promise<SecurityPolicy> {
  const cached = globalForSettings.securityPolicyCache;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const settings = await getSiteSettings();
    const value: SecurityPolicy = {
      maxLoginAttempts: settings.maxLoginAttempts,
      loginLockoutMinutes: settings.loginLockoutMinutes,
      maxLoginAttemptsPerIp: settings.maxLoginAttemptsPerIp,
      ipLockoutMinutes: settings.ipLockoutMinutes,
      maxRegistrationsPerIp: settings.maxRegistrationsPerIp,
      registrationWindowMinutes: settings.registrationWindowMinutes,
      requireStrongPasswords: settings.requireStrongPasswords
    };
    globalForSettings.securityPolicyCache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch {
    return {
      maxLoginAttempts: securityConfig.maxLoginAttempts,
      loginLockoutMinutes: securityConfig.loginLockoutMinutes,
      maxLoginAttemptsPerIp: securityConfig.maxLoginAttemptsPerIp,
      ipLockoutMinutes: securityConfig.ipLockoutMinutes,
      maxRegistrationsPerIp: securityConfig.maxRegistrationsPerIp,
      registrationWindowMinutes: securityConfig.registrationWindowMinutes,
      requireStrongPasswords: false
    };
  }
}
