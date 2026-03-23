/**
 * Single Prisma client for the app. Uses DATABASE_URL (Supabase).
 * One instance avoids connection pool issues with Supabase pooler.
 */
import { PrismaClient } from '@prisma/client';

const basePrisma = new PrismaClient();

function isTransientPrismaConnectionError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  const message = (err?.message ?? '').toLowerCase();
  return (
    err?.code === 'P1017' ||
    err?.code === 'P1001' ||
    message.includes('server has closed the connection') ||
    message.includes("can't reach database server")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Global query retry for transient DB connection drops (e.g., Supabase pooler hiccups).
export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (error) {
          if (!isTransientPrismaConnectionError(error)) {
            throw error;
          }
          // Reset connection and retry once.
          await basePrisma.$disconnect();
          await sleep(120);
          await basePrisma.$connect();
          return query(args);
        }
      },
    },
  },
});
