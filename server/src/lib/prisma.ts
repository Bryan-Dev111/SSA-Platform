/**
 * Single Prisma client for the app. Uses DATABASE_URL (Supabase).
 * Reuses the same client across dev hot-reloads (nodemon/ts-node) so old pools
 * are not left open. Add connection_limit / pool_timeout to DATABASE_URL
 * (see server/.env) to stay under Supabase pooler limits.
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as typeof globalThis & {
  __ssa_prismaBase?: PrismaClient;
  __ssa_prisma?: PrismaExtended;
};

type PrismaExtended = ReturnType<typeof extendPrisma>;

function extendPrisma(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          try {
            return await query(args);
          } catch (error) {
            if (!isTransientPrismaConnectionError(error)) {
              throw error;
            }
            const err = error as { code?: string };
            await base.$disconnect();
            await sleep(err.code === 'P2024' ? 400 : 120);
            await base.$connect();
            return query(args);
          }
        },
      },
    },
  });
}

function isTransientPrismaConnectionError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  const message = (err?.message ?? '').toLowerCase();
  return (
    err?.code === 'P1017' ||
    err?.code === 'P1001' ||
    err?.code === 'P2024' ||
    message.includes('server has closed the connection') ||
    message.includes("can't reach database server") ||
    message.includes('timed out fetching a new connection from the connection pool')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const basePrisma =
  globalForPrisma.__ssa_prismaBase ??
  new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__ssa_prismaBase = basePrisma;
}

/**
 * Unextended Prisma client (no `$allModels.$allOperations` retry wrapper).
 * Use for `$transaction` (interactive or array): the extended client's middleware
 * may call `$disconnect()` / `$connect()` on transient errors, which invalidates
 * interactive transaction IDs and surfaces as P2028.
 */
export const prismaBase = basePrisma;

export const prisma: PrismaExtended =
  globalForPrisma.__ssa_prisma ?? extendPrisma(basePrisma);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__ssa_prisma = prisma;
}
