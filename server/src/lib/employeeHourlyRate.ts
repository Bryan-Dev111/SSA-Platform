/**
 * Hourly rate lookup used by Work Logs / labor cost — same rules as Employees (User.hourlyRate).
 * Matches employee row by display name or email (case-insensitive).
 */
import { prisma } from './prisma';

export async function hourlyRateForFullName(fullName: string): Promise<number> {
  const t = fullName.trim();
  if (!t) return 0;
  const u = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: t, mode: 'insensitive' } },
        { name: { equals: t, mode: 'insensitive' } },
      ],
    },
    select: { hourlyRate: true },
  });
  if (u && typeof u.hourlyRate === 'number' && Number.isFinite(u.hourlyRate) && u.hourlyRate >= 0) {
    return u.hourlyRate;
  }
  return 0;
}
