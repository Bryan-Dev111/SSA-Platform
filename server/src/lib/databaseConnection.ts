/**
 * Application-wide database connection state (controlled by Super user).
 */
import { prismaBase } from './prisma';

let dbConnected = true;

export function isDatabaseConnected(): boolean {
  return dbConnected;
}

export async function connectDatabase(): Promise<void> {
  await prismaBase.$connect();
  dbConnected = true;
}

export async function disconnectDatabase(): Promise<void> {
  await prismaBase.$disconnect();
  dbConnected = false;
}
