import { prisma } from '../lib/prisma';

export interface SupplierMonthlyTrendPoint {
  month: string;
  findings: number;
  cars: number;
  audits: number;
  shipments: number;
}

/** Last 6 calendar months (UTC), same bucketing as dashboard `monthlyTrends`, scoped to one supplier. */
export async function buildSupplierMonthlyTrends(
  supplierId: string,
  now = new Date()
): Promise<SupplierMonthlyTrendPoint[]> {
  const monthlyTrends: SupplierMonthlyTrendPoint[] = [];
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = 5; i >= 0; i -= 1) {
    const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    // eslint-disable-next-line no-await-in-loop
    const [findings, cars, audits, shipments] = await Promise.all([
      prisma.finding.count({ where: { supplierId, createdAt: { gte: start, lt: end } } }),
      prisma.correctiveAction.count({ where: { supplierId, createdAt: { gte: start, lt: end } } }),
      prisma.audit.count({ where: { supplierId, createdAt: { gte: start, lt: end } } }),
      prisma.shipment.count({ where: { supplierId, createdAt: { gte: start, lt: end } } }),
    ]);
    monthlyTrends.push({
      month: start.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      findings,
      cars,
      audits,
      shipments,
    });
  }
  return monthlyTrends;
}
