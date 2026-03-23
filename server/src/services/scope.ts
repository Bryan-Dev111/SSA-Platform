/**
 * Supplier scope helpers for data access.
 * Buyer/QE: assigned suppliers only; Supplier: only own data.
 */
import { prisma } from '../lib/prisma';

/** For Buyer: return list of supplier IDs assigned to this user. Empty array = no assignments. */
export async function getAssignedSupplierIds(userId: string): Promise<string[]> {
  const assignments = await prisma.buyerSupplier.findMany({
    where: { buyerId: userId },
    select: { supplierId: true },
  });
  return assignments.map((a) => a.supplierId);
}

/** For QualityEngineer: return list of supplier IDs assigned to this user. Empty array = no assignments. */
export async function getQeAssignedSupplierIds(userId: string): Promise<string[]> {
  const assignments = await prisma.qeSupplier.findMany({
    where: { qualityEngineerId: userId },
    select: { supplierId: true },
  });
  return assignments.map((a) => a.supplierId);
}

/** For Supplier role: return the supplier ID linked to this user, or null. */
export async function getSupplierIdForUser(userId: string): Promise<string | null> {
  const supplier = await prisma.supplier.findFirst({
    where: { userId },
    select: { id: true },
  });
  return supplier?.id ?? null;
}

/** Return allowed supplier IDs based on role assignment rules. */
export async function getAllowedSupplierIds(user: {
  roleNames: string[];
  id: string;
  supplierId?: string | null;
}): Promise<string[] | null> {
  if (user.roleNames.includes('Supplier')) {
    if (user.supplierId) return [user.supplierId];
    // Supplier role but no Supplier row linked to user — must not see all suppliers (Day 9.5 / security)
    return [];
  }
  const restrictToAssignments = user.roleNames.includes('Buyer') || user.roleNames.includes('QualityEngineer');
  if (restrictToAssignments) {
    const [buyerIds, qeIds] = await Promise.all([
      user.roleNames.includes('Buyer') ? getAssignedSupplierIds(user.id) : Promise.resolve<string[]>([]),
      user.roleNames.includes('QualityEngineer') ? getQeAssignedSupplierIds(user.id) : Promise.resolve<string[]>([]),
    ]);
    return [...new Set([...buyerIds, ...qeIds])]; // can be [] if no assignments
  }
  return null; // Admin, Viewer, Auditor: no restriction
}
