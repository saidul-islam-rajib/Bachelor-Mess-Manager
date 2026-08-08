import { PrismaClient } from '@prisma/client';
import { stampCreate, stampUpdate } from '@/lib/audit';
import { invalidatePrefix } from '@/lib/cache';
import { SESSION_USER_CACHE_PREFIX } from '@/lib/cache-keys';
import { databaseConfig } from '@/config';

function withPoolSettings(url: string | undefined): string | undefined {
  if (!url) return url;

  const sqlServer = url.startsWith('sqlserver://');
  const separator = sqlServer ? ';' : url.includes('?') ? '&' : '?';
  const params: string[] = [];

  const add = (sqlServerKey: string, standardKey: string, value: number | null) => {
    if (value === null) return;
    const key = sqlServer ? sqlServerKey : standardKey;
    if (new RegExp(`[;?&]${key}=`, 'i').test(url)) return;
    params.push(`${key}=${value}`);
  };

  add('connectionLimit', 'connection_limit', databaseConfig.connectionLimit);
  add('poolTimeout', 'pool_timeout', databaseConfig.poolTimeoutSeconds);

  if (params.length === 0) return url;
  if (sqlServer) return `${url.replace(/;$/, '')};${params.join(';')}`;
  return `${url}${separator}${params.join('&')}`;
}

function createPrismaClient() {
  const url = withPoolSettings(process.env.DATABASE_URL);

  return new PrismaClient({
    log: [
      { emit: 'stdout', level: 'error' },
      { emit: 'stdout', level: 'warn' }
    ],
    ...(url ? { datasources: { db: { url } } } : {})
  }).$extends({
    query: {
      $allModels: {
        create({ args, query }) {
          args.data = stampCreate(args.data);
          return query(args);
        },
        createMany({ args, query }) {
          const data = args.data;
          args.data = (
            Array.isArray(data) ? data.map((row: unknown) => stampCreate(row)) : stampCreate(data)
          ) as typeof args.data;
          return query(args);
        },
        update({ model, args, query }) {
          args.data = stampUpdate(args.data);
          if (model === 'User') invalidatePrefix(SESSION_USER_CACHE_PREFIX);
          return query(args);
        },
        updateMany({ model, args, query }) {
          args.data = stampUpdate(args.data);
          if (model === 'User') invalidatePrefix(SESSION_USER_CACHE_PREFIX);
          return query(args);
        },
        upsert({ model, args, query }) {
          args.create = stampCreate(args.create);
          args.update = stampUpdate(args.update);
          if (model === 'User') invalidatePrefix(SESSION_USER_CACHE_PREFIX);
          return query(args);
        },
        delete({ model, args, query }) {
          if (model === 'User') invalidatePrefix(SESSION_USER_CACHE_PREFIX);
          return query(args);
        },
        deleteMany({ model, args, query }) {
          if (model === 'User') invalidatePrefix(SESSION_USER_CACHE_PREFIX);
          return query(args);
        }
      }
    }
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = global as unknown as { prisma?: ExtendedPrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
