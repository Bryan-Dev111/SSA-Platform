import type { AuditResult, FindingSeverity, ShipmentStatus, ShipmentResult } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface SupplierRiskSummary {
  supplierId: string;
  /** Overall risk / quality score on 0–100 (higher = worse). QS × 100 with QS = 0.5·SS + 0.5·AS. */
  score: number;
  level: 'Low' | 'Medium' | 'High';
  /**
   * Diagnostic breakdown on 0–100; higher = worse where applicable.
   * Names are legacy: `quality` = shipment composite SS; `audit` = AS; others = sub-components.
   */
  factors: {
    quality: number;
    audit: number;
    delivery: number;
    carClosure: number;
    documentation: number;
  };
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function levelFromScore(score: number): 'Low' | 'Medium' | 'High' {
  if (score >= 67) return 'High';
  if (score >= 34) return 'Medium';
  return 'Low';
}

const W_CRIT = 1.0;
const W_MAJ = 0.7;
const W_MIN = 0.3;

function severityWeight(s: FindingSeverity): number {
  switch (s) {
    case 'Critical':
      return W_CRIT;
    case 'Major':
      return W_MAJ;
    case 'Minor':
      return W_MIN;
    default:
      return 0;
  }
}

/**
 * Sev = (C·1 + M·0.7 + m·0.3) / (Total · (C+M+m)); 0 if no issues or no totals.
 */
function severityIndex(
  findings: Array<{ severity: FindingSeverity }>,
  totalUnits: number
): number {
  let c = 0;
  let m = 0;
  let min = 0;
  for (const f of findings) {
    if (f.severity === 'Critical') c++;
    else if (f.severity === 'Major') m++;
    else if (f.severity === 'Minor') min++;
  }
  const n = c + m + min;
  if (n === 0 || totalUnits <= 0) return 0;
  const weighted = c * W_CRIT + m * W_MAJ + min * W_MIN;
  return weighted / (totalUnits * n);
}

/** Shipment-side FPY on 0–1 from completed inspections (Passed / (Passed+Failed)); 1 if none. */
function shipmentFpy01(
  shipments: Array<{ status: ShipmentStatus; result: ShipmentResult | null }>
): { fpy01: number; passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  for (const s of shipments) {
    if (s.status === 'Passed' || s.result === 'Passed') passed++;
    else if (s.status === 'Failed' || s.result === 'Failed') failed++;
  }
  const d = passed + failed;
  if (d === 0) return { fpy01: 1, passed: 0, failed: 0 };
  return { fpy01: passed / d, passed, failed };
}

/** Audit “FPY” / pass rate on 0–1 from audits with Passed or Failed result; 1 if none. */
function auditFpy01(audits: Array<{ result: AuditResult | null }>): number {
  let passed = 0;
  let failed = 0;
  for (const a of audits) {
    if (a.result === 'Passed') passed++;
    else if (a.result === 'Failed') failed++;
  }
  const d = passed + failed;
  if (d === 0) return 1;
  return passed / d;
}

function findingShipAuditBuckets(
  findings: Array<{ shipmentId: string | null; auditId: string | null; severity: FindingSeverity }>
): { shipment: typeof findings; audit: typeof findings } {
  const shipment: typeof findings = [];
  const audit: typeof findings = [];
  for (const f of findings) {
    if (f.shipmentId) shipment.push(f);
    else audit.push(f);
  }
  return { shipment, audit };
}

/**
 * Client quality / risk model (0–1 internal, exposed as score 0–100):
 * SS = 0.5·(1 − FPY_ship) + 0.5·Sev_ship
 * AS = 0.5·(1 − FPY_audit) + 0.5·Sev_audit
 * QS = 0.5·SS + 0.5·AS
 */
export async function computeSupplierRisk(supplierId: string): Promise<SupplierRiskSummary> {
  const [findings, audits, shipments] = await Promise.all([
    prisma.finding.findMany({
      where: { supplierId, status: { not: 'DRAFT' } },
      select: { severity: true, shipmentId: true, auditId: true },
    }),
    prisma.audit.findMany({
      where: { supplierId },
      select: { result: true },
    }),
    prisma.shipment.findMany({
      where: { supplierId },
      select: { status: true, result: true },
    }),
  ]);

  const { shipment: shipFindings, audit: auditFindings } = findingShipAuditBuckets(findings);

  const totalShipments = shipments.length;
  const totalAudits = audits.length;

  const { fpy01: fpyShip01 } = shipmentFpy01(shipments);
  const fpyAudit01 = auditFpy01(audits);

  const sevShip = severityIndex(shipFindings, totalShipments);
  const sevAudit = severityIndex(auditFindings, totalAudits);

  const SS = 0.5 * (1 - fpyShip01) + 0.5 * sevShip;
  const AS = 0.5 * (1 - fpyAudit01) + 0.5 * sevAudit;
  const QS = 0.5 * clamp01(SS) + 0.5 * clamp01(AS);

  const score = Math.round(clamp01(QS) * 10000) / 100;
  const level = levelFromScore(score);

  const round2 = (x: number) => Math.round(x * 100) / 100;

  return {
    supplierId,
    score,
    level,
    factors: {
      quality: round2(clamp01(SS) * 100),
      audit: round2(clamp01(AS) * 100),
      delivery: round2((1 - fpyShip01) * 100),
      carClosure: round2(clamp01(sevShip) * 100),
      documentation: round2(clamp01(sevAudit) * 100),
    },
  };
}

export async function computeAndStoreRiskSnapshot(supplierId: string) {
  const summary = await computeSupplierRisk(supplierId);
  const latest = await prisma.riskSnapshot.findFirst({
    where: { supplierId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, supplierId: true, score: true, level: true, createdAt: true },
  });
  if (latest && latest.score === summary.score && latest.level === summary.level) {
    return { snapshot: latest, summary };
  }
  const row = await prisma.riskSnapshot.create({
    data: {
      supplierId,
      score: summary.score,
      level: summary.level,
    },
  });
  return { snapshot: row, summary };
}
