import { PrismaClient } from '@prisma/client';
import { stampCreate, stampUpdate } from '@/lib/audit';

function createPrismaClient() {
  return new PrismaClient().$extends({
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
        update({ args, query }) {
          args.data = stampUpdate(args.data);
          return query(args);
        },
        updateMany({ args, query }) {
          args.data = stampUpdate(args.data);
          return query(args);
        },
        upsert({ args, query }) {
          args.create = stampCreate(args.create);
          args.update = stampUpdate(args.update);
          return query(args);
        }
      }
    }
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = global as unknown as { prisma?: ExtendedPrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
