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

/** For Auditor: return list of supplier IDs assigned to this auditor. Empty array = no assignments. */
export async function getAuditorAssignedSupplierIds(userId: string): Promise<string[]> {
  const assignments = await prisma.auditorSupplier.findMany({
    where: { auditorId: userId },
    select: { supplierId: true },
  });
  return assignments.map((a) => a.supplierId);
}

/**
 * For QualityEngineer (new logic): QE -> Buyers -> Suppliers.
 * - QeBuyer links a QE to many buyers
 * - BuyerSupplier links a buyer to many suppliers
 * Return unique supplier IDs; empty array = no assignments.
 */
export async function getQeAssignedSupplierIdsViaBuyers(userId: string): Promise<string[]> {
  const qeBuyers = await prisma.qeBuyer.findMany({
    where: { qualityEngineerId: userId },
    select: { buyerId: true },
  });
  const buyerIds = qeBuyers.map((x) => x.buyerId);
  if (buyerIds.length === 0) return [];

  const links = await prisma.buyerSupplier.findMany({
    where: { buyerId: { in: buyerIds } },
    select: { supplierId: true },
  });

  return [...new Set(links.map((x) => x.supplierId))];
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
  const restrictToAssignments =
    user.roleNames.includes('Buyer') || user.roleNames.includes('QualityEngineer') || user.roleNames.includes('Auditor');
  if (restrictToAssignments) {
    const [buyerSupplierIds, qeSupplierIdsViaBuyers, auditorSupplierIds] = await Promise.all([
      user.roleNames.includes('Buyer') ? getAssignedSupplierIds(user.id) : Promise.resolve<string[]>([]),
      user.roleNames.includes('QualityEngineer')
        ? getQeAssignedSupplierIdsViaBuyers(user.id)
        : Promise.resolve<string[]>([]),
      user.roleNames.includes('Auditor') ? getAuditorAssignedSupplierIds(user.id) : Promise.resolve<string[]>([]),
    ]);
    // Backward compatibility: if QE has not been assigned via qeBuyers yet,
    // fall back to legacy direct qeSuppliers assignments.
    let qeSupplierIds = qeSupplierIdsViaBuyers;
    if (qeSupplierIdsViaBuyers.length === 0 && user.roleNames.includes('QualityEngineer')) {
      qeSupplierIds = await getQeAssignedSupplierIds(user.id);
    }
    return [...new Set([...buyerSupplierIds, ...qeSupplierIds, ...auditorSupplierIds])]; // can be [] if no assignments
  }
  return null; // Admin, Viewer, Auditor: no restriction
}
