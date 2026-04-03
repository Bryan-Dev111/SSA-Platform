/**
 * Generate next display code for entities (AUD-00001, FIN-00001, etc.)
 * Uses IdSequence table; digits = 5 for AUD, FIN, CAR, SUP; 2 for TYP.
 */
import { prismaBase } from '../lib/prisma';

export async function getNextCode(prefix: string, digits: number = 5): Promise<string> {
  const updated = await prismaBase.$transaction(async (tx) => {
    const row = await tx.idSequence.upsert({
      where: { prefix },
      create: { prefix, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
    });
    return row;
  });
  return `${prefix}-${String(updated.lastValue).padStart(digits, '0')}`;
}
