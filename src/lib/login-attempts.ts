import { prisma } from '@/lib/prisma';
import { securityConfig } from '@/config';
import { getSecurityPolicy } from '@/lib/settings-service';

export const LOGIN_FAILURE_REASONS = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  UNKNOWN_ACCOUNT: 'UNKNOWN_ACCOUNT',
  ACCOUNT_PENDING: 'ACCOUNT_PENDING',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  IP_LOCKED: 'IP_LOCKED'
} as const;

export type LoginLockState = {
  locked: boolean;
  scope: 'ACCOUNT' | 'IP' | null;
  retryAfterSeconds: number;
  retryAfterMinutes: number;
  attemptsRemaining: number;
  maxAttempts: number;
};

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

export async function recordLoginAttempt(params: {
  email: string;
  ipAddress: string;
  userAgent?: string | null;
  successful: boolean;
  reason?: string | null;
}) {
  await prisma.loginAttempt.create({
    data: {
      email: params.email,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent ? params.userAgent.slice(0, 250) : null,
      successful: params.successful,
      reason: params.reason ?? null
    }
  });
}

export async function clearFailedAttempts(email: string) {
  await prisma.loginAttempt.deleteMany({ where: { email, successful: false } });
}

export async function evaluateLoginLock(email: string, ipAddress: string): Promise<LoginLockState> {
  const policy = await getSecurityPolicy();

  const accountWindowStart = minutesAgo(policy.loginLockoutMinutes);
  const ipWindowStart = minutesAgo(policy.ipLockoutMinutes);

  const [accountFailures, ipFailures] = await Promise.all([
    prisma.loginAttempt.findMany({
      where: { email, successful: false, createdAt: { gte: accountWindowStart } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.loginAttempt.count({
      where: { ipAddress, successful: false, createdAt: { gte: ipWindowStart } }
    })
  ]);

  if (accountFailures.length >= policy.maxLoginAttempts) {
    const oldest = accountFailures[accountFailures.length - policy.maxLoginAttempts];
    const unlockAt = oldest.createdAt.getTime() + policy.loginLockoutMinutes * 60_000;
    const retryAfterSeconds = Math.max(1, Math.ceil((unlockAt - Date.now()) / 1000));
    return {
      locked: true,
      scope: 'ACCOUNT',
      retryAfterSeconds,
      retryAfterMinutes: Math.max(1, Math.ceil(retryAfterSeconds / 60)),
      attemptsRemaining: 0,
      maxAttempts: policy.maxLoginAttempts
    };
  }

  if (ipFailures >= policy.maxLoginAttemptsPerIp) {
    const retryAfterSeconds = policy.ipLockoutMinutes * 60;
    return {
      locked: true,
      scope: 'IP',
      retryAfterSeconds,
      retryAfterMinutes: policy.ipLockoutMinutes,
      attemptsRemaining: 0,
      maxAttempts: policy.maxLoginAttemptsPerIp
    };
  }

  return {
    locked: false,
    scope: null,
    retryAfterSeconds: 0,
    retryAfterMinutes: 0,
    attemptsRemaining: Math.max(0, policy.maxLoginAttempts - accountFailures.length),
    maxAttempts: policy.maxLoginAttempts
  };
}

export async function listLockedAccounts() {
  const policy = await getSecurityPolicy();
  const windowStart = minutesAgo(policy.loginLockoutMinutes);

  const grouped = await prisma.loginAttempt.groupBy({
    by: ['email'],
    where: { successful: false, createdAt: { gte: windowStart } },
    _count: { _all: true },
    _max: { createdAt: true },
    having: { email: { _count: { gte: policy.maxLoginAttempts } } }
  });

  return grouped
    .map((row) => ({
      email: row.email,
      failedAttempts: row._count._all,
      lastAttemptAt: row._max.createdAt ? row._max.createdAt.toISOString() : null
    }))
    .sort((a, b) => b.failedAttempts - a.failedAttempts);
}

export async function listRecentFailures(limit: number) {
  const rows = await prisma.loginAttempt.findMany({
    where: { successful: false },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, email: true, ipAddress: true, reason: true, createdAt: true }
  });

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    ipAddress: row.ipAddress,
    reason: row.reason,
    createdAt: row.createdAt.toISOString()
  }));
}

export async function unlockAccount(email: string) {
  await clearFailedAttempts(email);
}

export async function pruneLoginAttempts() {
  const cutoff = minutesAgo(securityConfig.loginAttemptRetentionDays * 24 * 60);
  const result = await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}

export async function countRecentRegistrations(ipAddress: string): Promise<number> {
  const policy = await getSecurityPolicy();
  return prisma.loginAttempt.count({
    where: {
      ipAddress,
      reason: 'REGISTRATION',
      createdAt: { gte: minutesAgo(policy.registrationWindowMinutes) }
    }
  });
}

export async function recordRegistrationAttempt(email: string, ipAddress: string) {
  await prisma.loginAttempt.create({
    data: { email, ipAddress, successful: true, reason: 'REGISTRATION' }
  });
}
