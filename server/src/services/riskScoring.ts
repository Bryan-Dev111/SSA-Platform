import { prisma } from '../lib/prisma';

export interface SupplierRiskSummary {
  supplierId: string;
  score: number;
  level: 'Low' | 'Medium' | 'High';
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

function toRiskPercent(ratio: number): number {
  return clamp01(ratio) * 100;
}

function levelFromScore(score: number): 'Low' | 'Medium' | 'High' {
  if (score >= 67) return 'High';
  if (score >= 34) return 'Medium';
  return 'Low';
}

export async function computeSupplierRisk(supplierId: string): Promise<SupplierRiskSummary> {
  const [weights, findings, audits, shipments, cars, records] = await Promise.all([
    prisma.riskWeightConfig.findFirst(),
    prisma.finding.findMany({
      where: { supplierId, status: { not: 'DRAFT' } },
      select: { severity: true, status: true },
    }),
    prisma.audit.findMany({
      where: { supplierId },
      select: { result: true },
    }),
    prisma.shipment.findMany({
      where: { supplierId },
      select: { status: true, result: true },
    }),
    prisma.correctiveAction.findMany({
      where: { supplierId, status: { not: 'DRAFT' } },
      select: { status: true },
    }),
    prisma.record.findMany({
      where: { supplierId },
      select: { status: true },
    }),
  ]);

  const wQuality = weights?.qualityPercent ?? 20;
  const wAudit = weights?.auditPercent ?? 20;
  const wDelivery = weights?.deliveryPercent ?? 20;
  const wCar = weights?.carClosurePercent ?? 20;
  const wDoc = weights?.documentationPercent ?? 20;
  const wSum = wQuality + wAudit + wDelivery + wCar + wDoc || 100;

  // Quality: proportion of major/critical findings still open.
  const qualDen = findings.length || 1;
  const qualNum = findings.filter(
    (f) => (f.severity === 'Critical' || f.severity === 'Major') && f.status !== 'Closed'
  ).length;
  const quality = toRiskPercent(qualNum / qualDen);

  // Audit: failed/cancelled audit ratio.
  const auditDen = audits.length || 1;
  const auditNum = audits.filter((a) => a.result === 'Failed' || a.result === 'Cancelled').length;
  const audit = toRiskPercent(auditNum / auditDen);

  // Delivery: failed shipment ratio.
  const deliveryDen = shipments.length || 1;
  const deliveryNum = shipments.filter((s) => s.result === 'Failed' || s.status === 'Failed').length;
  const delivery = toRiskPercent(deliveryNum / deliveryDen);

  // CAR closure: non-closed CAR ratio.
  const carDen = cars.length || 1;
  const carNum = cars.filter((c) => c.status !== 'Closed').length;
  const carClosure = toRiskPercent(carNum / carDen);

  // Documentation: rejected records ratio.
  const docDen = records.length || 1;
  const docNum = records.filter((r) => r.status === 'Rejected').length;
  const documentation = toRiskPercent(docNum / docDen);

  const score =
    (quality * wQuality + audit * wAudit + delivery * wDelivery + carClosure * wCar + documentation * wDoc) /
    wSum;
  const rounded = Math.round(score * 100) / 100;

  return {
    supplierId,
    score: rounded,
    level: levelFromScore(rounded),
    factors: {
      quality: Math.round(quality * 100) / 100,
      audit: Math.round(audit * 100) / 100,
      delivery: Math.round(delivery * 100) / 100,
      carClosure: Math.round(carClosure * 100) / 100,
      documentation: Math.round(documentation * 100) / 100,
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
