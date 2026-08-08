import type { NextApiRequest } from 'next';
import { prisma } from '@/lib/prisma';
import { appConfig } from '@/config';
import { clientIp } from '@/lib/rate-limit';

export const SESSION_IDLE_GAP_MS = 30 * 60_000;
export const SESSION_ONLINE_WINDOW_MS = 5 * 60_000;
export const SESSION_MAX_HEARTBEAT_GAP_MS = 3 * 60_000;
export const LEADERBOARD_LIMIT = 100;

export const SESSION_END_REASONS = {
  LOGOUT: 'LOGOUT',
  IDLE: 'IDLE',
  REPLACED: 'REPLACED'
} as const;

export const DEVICES = { MOBILE: 'MOBILE', TABLET: 'TABLET', DESKTOP: 'DESKTOP' } as const;

export type TimeBucketKey = 'MORNING' | 'MIDDAY' | 'AFTERNOON' | 'EVENING' | 'NIGHT';

export const TIME_BUCKETS: { key: TimeBucketKey; label: string; from: number; to: number }[] = [
  { key: 'MORNING', label: 'Morning', from: 5, to: 11 },
  { key: 'MIDDAY', label: 'Midday', from: 11, to: 15 },
  { key: 'AFTERNOON', label: 'Afternoon', from: 15, to: 18 },
  { key: 'EVENING', label: 'Evening', from: 18, to: 22 },
  { key: 'NIGHT', label: 'Night', from: 22, to: 5 }
];

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

export function bucketOfHour(hour: number): TimeBucketKey {
  for (const bucket of TIME_BUCKETS) {
    if (bucket.from < bucket.to) {
      if (hour >= bucket.from && hour < bucket.to) return bucket.key;
    } else if (hour >= bucket.from || hour < bucket.to) {
      return bucket.key;
    }
  }
  return 'NIGHT';
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: appConfig.timeZone,
  hour: '2-digit',
  hour12: false,
  weekday: 'short'
});

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: appConfig.timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function localStamp(date: Date): { hour: number; weekday: number; day: string } {
  const parts = partsFormatter.formatToParts(date);
  const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '0';
  const weekdayPart = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';

  return {
    hour: Number(hourPart) % 24,
    weekday: WEEKDAY_INDEX[weekdayPart] ?? 0,
    day: dayFormatter.format(date)
  };
}

export function deviceOf(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? '').toLowerCase();
  if (!ua) return DEVICES.DESKTOP;
  if (/ipad|tablet|kindle|playbook|silk/.test(ua)) return DEVICES.TABLET;
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(ua)) return DEVICES.MOBILE;
  if (/android/.test(ua)) return DEVICES.TABLET;
  return DEVICES.DESKTOP;
}

function requestFingerprint(req: NextApiRequest) {
  const raw = req.headers['user-agent'];
  const userAgent = typeof raw === 'string' ? raw.slice(0, 250) : null;
  return { ipAddress: clientIp(req), userAgent, device: deviceOf(userAgent) };
}

export type TouchResult = { sessionId: string; started: boolean };

export async function touchSession(
  userId: string,
  req: NextApiRequest,
  options: { forceNew?: boolean } = {}
): Promise<TouchResult | null> {
  const now = new Date();
  const { ipAddress, userAgent, device } = requestFingerprint(req);

  try {
    const open = options.forceNew
      ? null
      : await prisma.userSession.findFirst({
          where: { userId, endedAt: null, lastSeenAt: { gte: new Date(now.getTime() - SESSION_IDLE_GAP_MS) } },
          orderBy: { lastSeenAt: 'desc' },
          select: { id: true, lastSeenAt: true }
        });

    if (open) {
      const gap = Math.max(0, now.getTime() - open.lastSeenAt.getTime());
      const credited = Math.round(Math.min(gap, SESSION_MAX_HEARTBEAT_GAP_MS) / 1000);

      await prisma.userSession.update({
        where: { id: open.id },
        data: { lastSeenAt: now, seconds: { increment: credited }, device, ipAddress }
      });

      return { sessionId: open.id, started: false };
    }

    await closeStaleSessions(userId, now);

    const stamp = localStamp(now);
    const created = await prisma.userSession.create({
      data: {
        userId,
        startedAt: now,
        lastSeenAt: now,
        seconds: 0,
        startHour: stamp.hour,
        startWeekday: stamp.weekday,
        startDay: stamp.day,
        device,
        ipAddress,
        userAgent,
        publishedAt: now
      },
      select: { id: true }
    });

    return { sessionId: created.id, started: true };
  } catch {
    return null;
  }
}

export async function closeStaleSessions(userId: string, now = new Date()) {
  await prisma.userSession.updateMany({
    where: { userId, endedAt: null, lastSeenAt: { lt: new Date(now.getTime() - SESSION_IDLE_GAP_MS) } },
    data: { endedAt: now, endedReason: SESSION_END_REASONS.IDLE }
  });
}

export async function endSession(userId: string, reason: string = SESSION_END_REASONS.LOGOUT) {
  const now = new Date();
  try {
    await prisma.userSession.updateMany({
      where: { userId, endedAt: null },
      data: { endedAt: now, endedReason: reason }
    });
  } catch {
    return;
  }
}

export type ActivityRange = { days: number | null; since: Date | null };

export function rangeFromDays(days: number | null): ActivityRange {
  if (!days || days <= 0) return { days: null, since: null };
  return { days, since: new Date(Date.now() - days * 86_400_000) };
}

export type LeaderboardSort = 'visits' | 'time' | 'recent';

export type ActivityMember = {
  rank: number;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  visits: number;
  seconds: number;
  averageSeconds: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  online: boolean;
};

export type ActivityOverview = {
  timeZone: string;
  visits: number;
  visitors: number;
  seconds: number;
  averageSeconds: number;
  onlineNow: number;
  visitsToday: number;
  neverVisited: number;
};

export type ActivityReport = {
  range: { days: number | null; since: string | null };
  overview: ActivityOverview;
  byBucket: { key: TimeBucketKey; label: string; window: string; visits: number; share: number }[];
  byHour: { hour: number; visits: number }[];
  byWeekday: { weekday: number; label: string; visits: number }[];
  byDevice: { device: string; visits: number }[];
  trend: { day: string; visits: number; visitors: number }[];
  members: ActivityMember[];
  truncated: boolean;
};

function windowLabel(from: number, to: number): string {
  const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;
  return `${pad(from)}–${pad(to)}`;
}

export async function buildActivityReport(options: {
  days: number | null;
  sort: LeaderboardSort;
  search?: string;
}): Promise<ActivityReport> {
  const { since, days } = rangeFromDays(options.days);
  const now = new Date();
  const where = since ? { startedAt: { gte: since } } : {};

  const [grouped, byHourRows, byWeekdayRows, byDeviceRows, trendRows, onlineRows, todayCount, totalUsers] =
    await Promise.all([
      prisma.userSession.groupBy({
        by: ['userId'],
        where,
        _count: { _all: true },
        _sum: { seconds: true },
        _min: { startedAt: true },
        _max: { lastSeenAt: true }
      }),
      prisma.userSession.groupBy({ by: ['startHour'], where, _count: { _all: true } }),
      prisma.userSession.groupBy({ by: ['startWeekday'], where, _count: { _all: true } }),
      prisma.userSession.groupBy({ by: ['device'], where, _count: { _all: true } }),
      prisma.userSession.groupBy({
        by: ['startDay'],
        where: since ? where : { startedAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
        _count: { _all: true }
      }),
      prisma.userSession.findMany({
        where: { lastSeenAt: { gte: new Date(now.getTime() - SESSION_ONLINE_WINDOW_MS) } },
        select: { userId: true },
        distinct: ['userId']
      }),
      prisma.userSession.count({ where: { startDay: localStamp(now).day } }),
      prisma.user.count()
    ]);

  const online = new Set(onlineRows.map((row) => row.userId));

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((row) => row.userId) } },
    select: { id: true, name: true, email: true, role: true, status: true }
  });
  const userById = new Map(users.map((user) => [user.id, user]));

  const term = options.search?.trim().toLowerCase();
  const ranked = grouped
    .map((row) => {
      const user = userById.get(row.userId);
      const visits = row._count._all;
      const seconds = row._sum.seconds ?? 0;

      return {
        userId: row.userId,
        name: user?.name ?? 'Deleted account',
        email: user?.email ?? '',
        role: user?.role ?? '',
        status: user?.status ?? '',
        visits,
        seconds,
        averageSeconds: visits > 0 ? Math.round(seconds / visits) : 0,
        firstSeenAt: row._min.startedAt ? row._min.startedAt.toISOString() : null,
        lastSeenAt: row._max.lastSeenAt ? row._max.lastSeenAt.toISOString() : null,
        online: online.has(row.userId)
      };
    })
    .filter((row) => !term || row.name.toLowerCase().includes(term) || row.email.toLowerCase().includes(term));

  ranked.sort((a, b) => {
    if (options.sort === 'time') return b.seconds - a.seconds || b.visits - a.visits;
    if (options.sort === 'recent') return (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? '');
    return b.visits - a.visits || b.seconds - a.seconds;
  });

  const members: ActivityMember[] = ranked
    .slice(0, LEADERBOARD_LIMIT)
    .map((row, index) => ({ rank: index + 1, ...row }));

  const totalVisits = grouped.reduce((sum, row) => sum + row._count._all, 0);
  const totalSeconds = grouped.reduce((sum, row) => sum + (row._sum.seconds ?? 0), 0);

  const bucketTotals = new Map<TimeBucketKey, number>();
  for (const row of byHourRows) {
    const key = bucketOfHour(row.startHour);
    bucketTotals.set(key, (bucketTotals.get(key) ?? 0) + row._count._all);
  }

  const hourCounts = new Map(byHourRows.map((row) => [row.startHour, row._count._all]));
  const weekdayCounts = new Map(byWeekdayRows.map((row) => [row.startWeekday, row._count._all]));

  const trendByDay = new Map(trendRows.map((row) => [row.startDay, row._count._all]));
  const trendDays = [...trendByDay.keys()].sort();

  const visitorsPerDay = await visitorsByDay(trendDays);

  return {
    range: { days, since: since ? since.toISOString() : null },
    overview: {
      timeZone: appConfig.timeZone,
      visits: totalVisits,
      visitors: grouped.length,
      seconds: totalSeconds,
      averageSeconds: totalVisits > 0 ? Math.round(totalSeconds / totalVisits) : 0,
      onlineNow: online.size,
      visitsToday: todayCount,
      neverVisited: Math.max(0, totalUsers - grouped.length)
    },
    byBucket: TIME_BUCKETS.map((bucket) => {
      const visits = bucketTotals.get(bucket.key) ?? 0;
      return {
        key: bucket.key,
        label: bucket.label,
        window: windowLabel(bucket.from, bucket.to),
        visits,
        share: totalVisits > 0 ? Math.round((visits / totalVisits) * 1000) / 10 : 0
      };
    }),
    byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, visits: hourCounts.get(hour) ?? 0 })),
    byWeekday: WEEKDAY_LABELS.map((label, weekday) => ({
      weekday,
      label,
      visits: weekdayCounts.get(weekday) ?? 0
    })),
    byDevice: byDeviceRows
      .map((row) => ({ device: row.device, visits: row._count._all }))
      .sort((a, b) => b.visits - a.visits),
    trend: trendDays.map((day) => ({
      day,
      visits: trendByDay.get(day) ?? 0,
      visitors: visitorsPerDay.get(day) ?? 0
    })),
    members,
    truncated: ranked.length > LEADERBOARD_LIMIT
  };
}

async function visitorsByDay(days: string[]): Promise<Map<string, number>> {
  if (days.length === 0) return new Map();

  const rows = await prisma.userSession.findMany({
    where: { startDay: { in: days } },
    select: { startDay: true, userId: true },
    distinct: ['startDay', 'userId']
  });

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.startDay, (counts.get(row.startDay) ?? 0) + 1);
  return counts;
}

export type MemberVisit = {
  id: string;
  startedAt: string;
  lastSeenAt: string;
  endedAt: string | null;
  endedReason: string | null;
  seconds: number;
  bucket: TimeBucketKey;
  device: string;
  ipAddress: string | null;
};

export async function listMemberVisits(userId: string, take: number, skip: number) {
  const [rows, total, user] = await Promise.all([
    prisma.userSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take,
      skip,
      select: {
        id: true,
        startedAt: true,
        lastSeenAt: true,
        endedAt: true,
        endedReason: true,
        seconds: true,
        startHour: true,
        device: true,
        ipAddress: true
      }
    }),
    prisma.userSession.count({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } })
  ]);

  const visits: MemberVisit[] = rows.map((row) => ({
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    endedReason: row.endedReason,
    seconds: row.seconds,
    bucket: bucketOfHour(row.startHour),
    device: row.device,
    ipAddress: row.ipAddress
  }));

  return { user, visits, total };
}
