/**
 * Supplier scope helpers for data access.
 * Buyer/QE/Auditor: assigned suppliers only; employees/contractors also use EmployeeSupplierAssignment;
 * QualityManager/Admin: all suppliers; Supplier: only own data.
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

/** Employee / contractor → supplier (Internal Management → Employee Assignments). */
export async function getEmployeeAssignedSupplierIds(userId: string): Promise<string[]> {
  const rows = await prisma.employeeSupplierAssignment.findMany({
    where: { employeeId: userId },
    select: { supplierId: true },
  });
  return rows.map((r) => r.supplierId);
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
  const employeeSupplierIds = await getEmployeeAssignedSupplierIds(user.id);
  const hasEmployeeAssignments = employeeSupplierIds.length > 0;

  if (user.roleNames.includes('Supplier')) {
    const own: string[] = user.supplierId ? [user.supplierId] : [];
    const merged = [...new Set([...own, ...employeeSupplierIds])];
    if (merged.length > 0) return merged;
    return [];
  }

  // Quality Managers oversee all suppliers (e.g. cover for QE); do not restrict to QE buyer/supplier assignments.
  if (user.roleNames.includes('QualityManager')) {
    return null;
  }

  const restrictToAssignments =
    user.roleNames.includes('Buyer') ||
    user.roleNames.includes('QualityEngineer') ||
    user.roleNames.includes('Auditor');

  let roleSupplierIds: string[] = [];
  if (restrictToAssignments) {
    const [buyerSupplierIds, qeSupplierIdsViaBuyers, auditorSupplierIds] = await Promise.all([
      user.roleNames.includes('Buyer') ? getAssignedSupplierIds(user.id) : Promise.resolve<string[]>([]),
      user.roleNames.includes('QualityEngineer')
        ? getQeAssignedSupplierIdsViaBuyers(user.id)
        : Promise.resolve<string[]>([]),
      user.roleNames.includes('Auditor') ? getAuditorAssignedSupplierIds(user.id) : Promise.resolve<string[]>([]),
    ]);
    let qeSupplierIds = qeSupplierIdsViaBuyers;
    if (qeSupplierIdsViaBuyers.length === 0 && user.roleNames.includes('QualityEngineer')) {
      qeSupplierIds = await getQeAssignedSupplierIds(user.id);
    }
    roleSupplierIds = [...new Set([...buyerSupplierIds, ...qeSupplierIds, ...auditorSupplierIds])];
  }

  if (restrictToAssignments || hasEmployeeAssignments) {
    return [...new Set([...roleSupplierIds, ...employeeSupplierIds])];
  }

  return null; // Admin, Viewer (no employee supplier rows): unrestricted supplier list
}
