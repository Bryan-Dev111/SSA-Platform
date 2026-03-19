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

export interface ShipmentMetricsResult {
  totalInspectionRequests: number;
  waitingInspection: number;
  passed: number;
  failed: number;
  overdueWaiting: number;
  lateVsSchedule: number;
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
  let fpyPassed = 0;
  let fpyFailed = 0;
  let otdOnTime = 0;
  let otdLate = 0;

  const scopedSchedules =
    allowedSupplierIds === null
      ? schedules
      : schedules.filter((s) => s.supplierId && allowedSupplierIds.includes(s.supplierId));

  const scheduleRowCount = scopedSchedules.length;

  for (const sh of shipments) {
    if (sh.status === 'WaitingInspection') {
      waitingInspection++;
      const insp = dateOnlyMs(sh.inspectionDate);
      if (insp !== null && insp < startOfTodayUtc) overdueWaiting++;
      continue;
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
          }
        } else if (sh.status === 'Failed' || sh.result === 'Failed') {
          if (inspDay > schedDay) lateVsSchedule++;
        }
      }
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
    otdPercent: otdDenom > 0 ? Math.round((otdOnTime / otdDenom) * 1000) / 10 : null,
    fpyPercent: fpyDenom > 0 ? Math.round((fpyPassed / fpyDenom) * 1000) / 10 : null,
    scheduleRowCount,
  };
}
