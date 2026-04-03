/**
 * Day 10: Shipment page metrics — OTD vs schedule, FPY, counts (scoped by supplier).
 */
import { prisma } from '../lib/prisma';
import type { Shipment, ShipmentSchedule } from '@prisma/client';

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function dateOnlyMs(d: Date | null | undefined): number | null {
  if (!d) return null;
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}

/** Best matching schedule row for a shipment (same supplier, PO, part). */
export function findMatchingSchedule(
  shipment: Pick<Shipment, 'supplierId' | 'purchaseOrder' | 'partNumber'>,
  schedules: ShipmentSchedule[]
): ShipmentSchedule | null {
  const po = norm(shipment.purchaseOrder);
  const part = norm(shipment.partNumber);
  const matches = schedules.filter(
    (s) =>
      s.supplierId === shipment.supplierId &&
      norm(s.purchaseOrder) === po &&
      norm(s.partNumber) === part
  );
  if (matches.length === 0) return null;
  // Prefer schedule with scheduledDate closest to shipment need; use earliest scheduled
  return [...matches].sort((a, b) => {
    const ta = a.scheduledDate?.getTime() ?? 0;
    const tb = b.scheduledDate?.getTime() ?? 0;
    return ta - tb;
  })[0];
}

export interface LateShipmentDetail {
  purchaseOrder: string | null;
  qty: number | null;
}

export interface ShortDeliveryDetail {
  purchaseOrder: string | null;
  missingQty: number;
}

export interface ShipmentMetricsResult {
  totalInspectionRequests: number;
  waitingInspection: number;
  passed: number;
  failed: number;
  overdueWaiting: number;
  lateVsSchedule: number;
  /** Purchase orders / quantities for shipments counted in lateVsSchedule (for UI tooltip). */
  lateDetails: LateShipmentDetail[];
  /** Waiting-inspection rows past requested inspection date (for UI tooltip). */
  overdueDetails: LateShipmentDetail[];
  /** Schedules where shipped quantity is less than planned after scheduled date. */
  shortDeliveries: number;
  shortDeliveryDetails: ShortDeliveryDetail[];
  otdPercent: number | null;
  fpyPercent: number | null;
  scheduleRowCount: number;
}

export async function computeShipmentMetrics(
  allowedSupplierIds: string[] | null
): Promise<ShipmentMetricsResult> {
  const empty: ShipmentMetricsResult = {
    totalInspectionRequests: 0,
    waitingInspection: 0,
    passed: 0,
    failed: 0,
    overdueWaiting: 0,
    lateVsSchedule: 0,
    lateDetails: [],
    overdueDetails: [],
    shortDeliveries: 0,
    shortDeliveryDetails: [],
    otdPercent: null,
    fpyPercent: null,
    scheduleRowCount: 0,
  };

  if (allowedSupplierIds !== null && allowedSupplierIds.length === 0) {
    return empty;
  }

  const shipWhere =
    allowedSupplierIds === null ? {} : { supplierId: { in: allowedSupplierIds } };
  const schedWhere =
    allowedSupplierIds === null ? {} : { supplierId: { in: allowedSupplierIds } };

  const [shipments, schedules] = await Promise.all([
    prisma.shipment.findMany({ where: shipWhere }),
    prisma.shipmentSchedule.findMany({ where: schedWhere }),
  ]);

  const startOfTodayUtc = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  );

  let waitingInspection = 0;
  let passed = 0;
  let failed = 0;
  let overdueWaiting = 0;
  let lateVsSchedule = 0;
  const lateDetails: LateShipmentDetail[] = [];
  const overdueDetails: LateShipmentDetail[] = [];
  const shortDeliveryDetails: ShortDeliveryDetail[] = [];
  let shortDeliveries = 0;
  let fpyPassed = 0;
  let fpyFailed = 0;
  let otdOnTime = 0;
  let otdLate = 0;

  const scopedSchedules =
    allowedSupplierIds === null
      ? schedules
      : schedules.filter((s) => s.supplierId && allowedSupplierIds.includes(s.supplierId));

  const scheduleRowCount = scopedSchedules.length;

  // Aggregate shipped quantity by (supplier, PO, part) for short-delivery checks.
  const shippedByKey = new Map<string, number>();

  const makeKey = (supplierId: string, purchaseOrder: string | null, partNumber: string | null): string =>
    `${supplierId}::${norm(purchaseOrder)}::${norm(partNumber)}`;

  for (const sh of shipments) {
    if (sh.status === 'WaitingInspection') {
      waitingInspection++;
      const insp = dateOnlyMs(sh.inspectionDate);
      if (insp !== null && insp < startOfTodayUtc) {
        overdueWaiting++;
        overdueDetails.push({ purchaseOrder: sh.purchaseOrder, qty: sh.qty });
      }
      continue;
    }

    // Only approved (Passed) inspections count toward quantity vs schedule — not pending or rejected.
    const shippedQty = typeof sh.qty === 'number' ? sh.qty : 0;
    if (shippedQty > 0 && sh.status === 'Passed') {
      const key = makeKey(sh.supplierId, sh.purchaseOrder, sh.partNumber);
      shippedByKey.set(key, (shippedByKey.get(key) ?? 0) + shippedQty);
    }
    if (sh.status === 'Passed' || sh.result === 'Passed') {
      passed++;
      fpyPassed++;
    } else if (sh.status === 'Failed' || sh.result === 'Failed') {
      failed++;
      fpyFailed++;
    }

    const sch = findMatchingSchedule(sh, scopedSchedules);
    if (sch?.scheduledDate && sh.inspectionDate) {
      const inspDay = dateOnlyMs(sh.inspectionDate);
      const schedDay = dateOnlyMs(sch.scheduledDate);
      if (inspDay !== null && schedDay !== null) {
        if (sh.status === 'Passed' || sh.result === 'Passed') {
          if (inspDay <= schedDay) otdOnTime++;
          else {
            otdLate++;
            lateVsSchedule++;
            lateDetails.push({ purchaseOrder: sh.purchaseOrder, qty: sh.qty });
          }
        } else if (sh.status === 'Failed' || sh.result === 'Failed') {
          if (inspDay > schedDay) {
            lateVsSchedule++;
            lateDetails.push({ purchaseOrder: sh.purchaseOrder, qty: sh.qty });
          }
        }
      }
    }
  }

  // Short deliveries: planned qty on schedule vs total shipped qty, after scheduled date.
  for (const sch of scopedSchedules) {
    const plannedQty = typeof sch.qty === 'number' ? sch.qty : 0;
    const schedDateMs = sch.scheduledDate ? dateOnlyMs(sch.scheduledDate) : null;
    if (!plannedQty || schedDateMs === null || schedDateMs >= startOfTodayUtc) continue;
    const key = makeKey(sch.supplierId ?? '', sch.purchaseOrder ?? null, sch.partNumber ?? null);
    const shippedTotal = shippedByKey.get(key) ?? 0;
    if (shippedTotal < plannedQty) {
      shortDeliveries++;
      shortDeliveryDetails.push({
        purchaseOrder: sch.purchaseOrder,
        missingQty: plannedQty - shippedTotal,
      });
    }
  }

  const total = shipments.length;
  const fpyDenom = fpyPassed + fpyFailed;
  const otdDenom = otdOnTime + otdLate;

  return {
    totalInspectionRequests: total,
    waitingInspection,
    passed,
    failed,
    overdueWaiting,
    lateVsSchedule,
    lateDetails,
    overdueDetails,
    shortDeliveries,
    shortDeliveryDetails,
    otdPercent: otdDenom > 0 ? Math.round((otdOnTime / otdDenom) * 1000) / 10 : null,
    fpyPercent: fpyDenom > 0 ? Math.round((fpyPassed / fpyDenom) * 1000) / 10 : null,
    scheduleRowCount,
  };
}
