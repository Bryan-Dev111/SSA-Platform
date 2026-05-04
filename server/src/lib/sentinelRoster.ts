/**
 * Sentinel Supplier Assurance roster: active users flagged as employee or contractor.
 * Used for shipment inspector pickers, audit auditor assignment, etc.
 */
import { prisma } from './prisma';

export function sentinelEmployeeContractorWhere() {
  return {
    employmentStatus: 'Active' as const,
    OR: [{ isEmployee: true }, { isContractor: true }],
  };
}

export function normalizeSentinelRosterLabel(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** True if null/blank, or if the string matches a roster member's display label (name or email). */
export async function sentinelEmployeeContractorDisplayLabelsMatch(
  candidate: string | null | undefined
): Promise<boolean> {
  if (candidate == null || !String(candidate).trim()) return true;
  const want = normalizeSentinelRosterLabel(candidate);
  const roster = await prisma.user.findMany({
    where: sentinelEmployeeContractorWhere(),
    select: { name: true, email: true },
  });
  return roster.some((u) => {
    const label = (u.name?.trim() || u.email || '').trim();
    return normalizeSentinelRosterLabel(label) === want;
  });
}

export async function listSentinelEmployeeContractorsForPicker(): Promise<
  Array<{ id: string; name: string; email: string }>
> {
  const users = await prisma.user.findMany({
    where: sentinelEmployeeContractorWhere(),
    select: { id: true, name: true, email: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  });
  return users.map((u) => ({
    id: u.id,
    name: (u.name?.trim() || u.email).trim(),
    email: u.email,
  }));
}
