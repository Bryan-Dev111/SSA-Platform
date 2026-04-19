/**
 * Resolve ClientHistory (project) for a shipment using explicit link or supplier + PO + part match keys.
 */
import { prisma } from './prisma';

export function normalizeShipmentMatchKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** Match shipments to projects where ClientHistory has shipmentMatch* set for that supplier. */
export async function resolveProjectHistoryIdFromShipmentFields(input: {
  supplierId: string;
  purchaseOrder: string | null;
  partNumber: string | null;
  explicitProjectHistoryId?: string | null;
}): Promise<string | null> {
  const explicit = typeof input.explicitProjectHistoryId === 'string' ? input.explicitProjectHistoryId.trim() : '';
  if (explicit) {
    const proj = await prisma.clientHistory.findUnique({
      where: { id: explicit },
      select: { id: true, supplierId: true },
    });
    if (!proj) return null;
    if (proj.supplierId && proj.supplierId !== input.supplierId) {
      return null;
    }
    return proj.id;
  }

  const po = normalizeShipmentMatchKey(input.purchaseOrder);
  const pn = normalizeShipmentMatchKey(input.partNumber);
  if (!po || !pn) return null;

  const candidates = await prisma.clientHistory.findMany({
    where: {
      supplierId: input.supplierId,
      shipmentMatchPurchaseOrder: { not: null },
      shipmentMatchPartNumber: { not: null },
    },
    select: {
      id: true,
      shipmentMatchPurchaseOrder: true,
      shipmentMatchPartNumber: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  for (const c of candidates) {
    if (
      normalizeShipmentMatchKey(c.shipmentMatchPurchaseOrder) === po &&
      normalizeShipmentMatchKey(c.shipmentMatchPartNumber) === pn
    ) {
      return c.id;
    }
  }
  return null;
}

export type ShipmentProjectPick = {
  supplierId: string;
  purchaseOrder: string | null;
  partNumber: string | null;
  projectHistoryId: string | null;
  projectHistory: { id: string; projectCode: string } | null;
};

/** Effective project for UI: stored link, else key match (same rules as persistence). */
export async function resolveEffectiveProjectForShipmentRow(
  row: Pick<ShipmentProjectPick, 'supplierId' | 'purchaseOrder' | 'partNumber' | 'projectHistoryId' | 'projectHistory'>
): Promise<{ id: string; projectCode: string } | null> {
  if (row.projectHistoryId && row.projectHistory) {
    return { id: row.projectHistory.id, projectCode: row.projectHistory.projectCode };
  }
  const id = await resolveProjectHistoryIdFromShipmentFields({
    supplierId: row.supplierId,
    purchaseOrder: row.purchaseOrder,
    partNumber: row.partNumber,
    explicitProjectHistoryId: null,
  });
  if (!id) return null;
  const p = await prisma.clientHistory.findUnique({
    where: { id },
    select: { id: true, projectCode: true },
  });
  return p ? { id: p.id, projectCode: p.projectCode } : null;
}

type ShipmentListRow = {
  id: string;
  supplierId: string;
  purchaseOrder: string | null;
  partNumber: string | null;
  projectHistoryId: string | null;
  projectHistory: { id: string; projectCode: string } | null;
};

/** One DB read of match candidates; used by GET /shipments for resolvedProjectHistory. */
export async function batchResolvedProjectHistoryForShipments(
  rows: ShipmentListRow[]
): Promise<Map<string, { id: string; projectCode: string } | null>> {
  const out = new Map<string, { id: string; projectCode: string } | null>();
  const supplierIds = [...new Set(rows.map((r) => r.supplierId))];
  if (supplierIds.length === 0) return out;

  const candidates = await prisma.clientHistory.findMany({
    where: {
      supplierId: { in: supplierIds },
      shipmentMatchPurchaseOrder: { not: null },
      shipmentMatchPartNumber: { not: null },
    },
    select: {
      id: true,
      supplierId: true,
      projectCode: true,
      shipmentMatchPurchaseOrder: true,
      shipmentMatchPartNumber: true,
      updatedAt: true,
    },
  });

  for (const r of rows) {
    if (r.projectHistoryId && r.projectHistory) {
      out.set(r.id, { id: r.projectHistory.id, projectCode: r.projectHistory.projectCode });
      continue;
    }
    const po = normalizeShipmentMatchKey(r.purchaseOrder);
    const pn = normalizeShipmentMatchKey(r.partNumber);
    if (!po || !pn) {
      out.set(r.id, null);
      continue;
    }
    const matches = candidates
      .filter(
        (c) =>
          c.supplierId === r.supplierId &&
          normalizeShipmentMatchKey(c.shipmentMatchPurchaseOrder) === po &&
          normalizeShipmentMatchKey(c.shipmentMatchPartNumber) === pn
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const m = matches[0];
    out.set(r.id, m ? { id: m.id, projectCode: m.projectCode } : null);
  }
  return out;
}
