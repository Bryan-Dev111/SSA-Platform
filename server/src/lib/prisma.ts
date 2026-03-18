/**
 * Single Prisma client for the app. Uses DATABASE_URL (Supabase).
 * One instance avoids connection pool issues with Supabase pooler.
 */
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
