import { prisma } from '@/lib/prisma';
import { appConfig, securityConfig, uploadConfig } from '@/config';
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

export type MealEditPolicy = {
  windowMinutes: number;
  requiresApproval: boolean;
  siteRequiresApproval: boolean;
  overriddenByGroup: boolean;
};

const MEAL_EDIT_FALLBACK: MealEditPolicy = {
  windowMinutes: 5,
  requiresApproval: true,
  siteRequiresApproval: true,
  overriddenByGroup: false
};

const globalForMealEdit = globalThis as unknown as {
  mealEditPolicyCache?: { value: MealEditPolicy; expiresAt: number } | null;
};

export type UploadPolicy = {
  maxImageBytes: number;
  minConfigurableBytes: number;
  maxConfigurableBytes: number;
};

const globalForUpload = globalThis as unknown as {
  uploadPolicyCache?: { value: UploadPolicy; expiresAt: number } | null;
};

export function clampImageBytes(value: number): number {
  return Math.min(
    uploadConfig.maxConfigurableImageBytes,
    Math.max(uploadConfig.minConfigurableImageBytes, Math.trunc(value))
  );
}

export function uploadPolicyFallback(): UploadPolicy {
  return {
    maxImageBytes: clampImageBytes(uploadConfig.maxImageBytes),
    minConfigurableBytes: uploadConfig.minConfigurableImageBytes,
    maxConfigurableBytes: uploadConfig.maxConfigurableImageBytes
  };
}

export async function getUploadPolicy(): Promise<UploadPolicy> {
  const cached = globalForUpload.uploadPolicyCache;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const settings = await getSiteSettings();
    const value: UploadPolicy = {
      ...uploadPolicyFallback(),
      maxImageBytes: clampImageBytes(settings.maxProfileImageBytes)
    };
    globalForUpload.uploadPolicyCache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch {
    return uploadPolicyFallback();
  }
}

export function invalidateSecurityPolicyCache() {
  globalForSettings.securityPolicyCache = null;
  globalForMealEdit.mealEditPolicyCache = null;
  globalForUpload.uploadPolicyCache = null;
}

export async function getMealEditPolicy(groupId?: string): Promise<MealEditPolicy> {
  const site = await getSiteMealEditPolicy();
  if (!groupId) return site;

  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { mealEditRequiresApproval: true }
    });
    if (typeof group?.mealEditRequiresApproval !== 'boolean') return site;

    return { ...site, requiresApproval: group.mealEditRequiresApproval, overriddenByGroup: true };
  } catch {
    return site;
  }
}

async function getSiteMealEditPolicy(): Promise<MealEditPolicy> {
  const cached = globalForMealEdit.mealEditPolicyCache;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const settings = await getSiteSettings();
    const value: MealEditPolicy = {
      windowMinutes: Math.max(0, Math.trunc(settings.mealEditWindowMinutes)),
      requiresApproval: settings.mealEditRequiresApproval,
      siteRequiresApproval: settings.mealEditRequiresApproval,
      overriddenByGroup: false
    };
    globalForMealEdit.mealEditPolicyCache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch {
    return MEAL_EDIT_FALLBACK;
  }
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
