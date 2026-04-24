/**
 * Farm Dashboard — scoped KPIs, charts, and table by country (respects employee country assignments).
 */
import { Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

const GLOBAL_VENDORS_PROJECT = 'Global Vendors';

router.use(authMiddleware);
router.use(requirePageAccess('GlobalSupplyFarmDashboard'));

function norm(s: string | null | undefined): string {
  return (s ?? '').trim();
}

function countriesMatch(a: string, b: string): boolean {
  return norm(a).toLowerCase() === norm(b).toLowerCase();
}

function poRevenue(o: {
  totalAmount: number | null;
  quantityKg: number | null;
  pricePerKg: number | null;
}): number {
  if (typeof o.totalAmount === 'number' && Number.isFinite(o.totalAmount)) return o.totalAmount;
  if (
    o.quantityKg != null &&
    o.pricePerKg != null &&
    Number.isFinite(o.quantityKg) &&
    Number.isFinite(o.pricePerKg)
  ) {
    return o.quantityKg * o.pricePerKg;
  }
  return 0;
}

function isPoClosed(status: string | null | undefined): boolean {
  return (status ?? '').trim().toLowerCase() === 'closed';
}

type FarmLite = {
  id: string;
  code: string;
  country: string;
  region: string | null;
  mainCropAnnualOutputKg: number | null;
};

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isEmployee: true,
        isContractor: true,
        country: true,
        assignedCountries: { select: { country: true } },
      },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const fromJunction = user.assignedCountries.map((c) => norm(c.country)).filter(Boolean);
    const legacy = norm(user.country);
    const assignmentCountries = [...new Set([...fromJunction, ...(legacy ? [legacy] : [])])];

    const staffLike = Boolean(user.isEmployee) || Boolean(user.isContractor);
    const staffRestricted = staffLike && assignmentCountries.length > 0;

    const countryParam = typeof req.query.country === 'string' ? norm(req.query.country) : '';

    let selectedCountry: string | null = null;
    let allowedCountries: string[] = [];

    if (staffRestricted) {
      allowedCountries = [...assignmentCountries].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      if (countryParam) {
        const ok = allowedCountries.some((c) => countriesMatch(c, countryParam));
        if (!ok) {
          res.status(400).json({ error: 'Invalid country for your assignments' });
          return;
        }
        selectedCountry = allowedCountries.find((c) => countriesMatch(c, countryParam)) ?? countryParam;
      } else {
        selectedCountry = allowedCountries[0] ?? null;
      }
    } else {
      const distinct = await prisma.farm.findMany({
        select: { country: true },
        distinct: ['country'],
        orderBy: { country: 'asc' },
      });
      allowedCountries = distinct.map((r) => norm(r.country)).filter(Boolean);
      if (countryParam) {
        const farmsProbe = await prisma.farm.findFirst({
          where: { country: { equals: countryParam, mode: 'insensitive' } },
          select: { id: true },
        });
        if (!farmsProbe) {
          res.status(400).json({ error: 'No farms found for that country' });
          return;
        }
        selectedCountry =
          distinct.find((d) => countriesMatch(d.country, countryParam))?.country.trim() ?? countryParam;
      } else {
        selectedCountry = null;
      }
    }

    const farmWhere =
      selectedCountry === null
        ? {}
        : { country: { equals: selectedCountry, mode: 'insensitive' as const } };

    const farms: FarmLite[] = await prisma.farm.findMany({
      where: farmWhere,
      select: {
        id: true,
        code: true,
        country: true,
        region: true,
        mainCropAnnualOutputKg: true,
      },
      orderBy: { code: 'asc' },
    });
    const farmIds = farms.map((f) => f.id);
    const farmIdSet = new Set(farmIds);

    const [orders, samples, expenses] =
      farmIds.length === 0
        ? [[], [], await prisma.expense.findMany({
            where: { project: GLOBAL_VENDORS_PROJECT },
            select: { amount: true, purchaseOrderId: true },
          })]
        : await Promise.all([
            prisma.purchaseOrder.findMany({
              where: { farmId: { in: farmIds } },
              select: {
                id: true,
                farmId: true,
                status: true,
                quantityKg: true,
                pricePerKg: true,
                totalAmount: true,
                orderDate: true,
                createdAt: true,
              },
            }),
            prisma.sample.findMany({
              where: { farmId: { in: farmIds } },
              select: { farmId: true },
            }),
            prisma.expense.findMany({
              where: { project: GLOBAL_VENDORS_PROJECT },
              select: { amount: true, purchaseOrderId: true },
            }),
          ]);

    const expenseByPoId = new Map<string, number>();
    for (const e of expenses) {
      const pid = e.purchaseOrderId?.trim();
      if (!pid) continue;
      const amt = Number.isFinite(e.amount) ? e.amount : 0;
      expenseByPoId.set(pid, (expenseByPoId.get(pid) ?? 0) + amt);
    }

    const openOrders = orders.filter((o) => o.farmId && farmIdSet.has(o.farmId) && !isPoClosed(o.status));
    const openPoCount = openOrders.length;
    const openPoValue = openOrders.reduce((s, o) => s + poRevenue(o), 0);

    let totalEmployees = 0;
    if (selectedCountry !== null) {
      const staff = await prisma.user.findMany({
        where: { OR: [{ isEmployee: true }, { isContractor: true }] },
        select: { country: true, assignedCountries: { select: { country: true } } },
      });
      const sel = selectedCountry.toLowerCase();
      totalEmployees = staff.filter((u) => {
        const set = new Set<string>();
        for (const c of u.assignedCountries) set.add(norm(c.country).toLowerCase());
        const leg = norm(u.country).toLowerCase();
        if (leg) set.add(leg);
        return [...set].some((c) => c === sel);
      }).length;
    } else {
      totalEmployees = await prisma.user.count({
        where: { OR: [{ isEmployee: true }, { isContractor: true }] },
      });
    }

    const weightByFarm = new Map<string, number>();
    const revenueClosedByFarm = new Map<string, number>();
    const profitClosedByFarm = new Map<string, number>();
    const poCountByFarm = new Map<string, number>();
    const sampleCountByFarm = new Map<string, number>();

    for (const f of farms) {
      weightByFarm.set(f.id, 0);
      revenueClosedByFarm.set(f.id, 0);
      profitClosedByFarm.set(f.id, 0);
      poCountByFarm.set(f.id, 0);
      sampleCountByFarm.set(f.id, 0);
    }

    for (const o of orders) {
      if (!o.farmId || !farmIdSet.has(o.farmId)) continue;
      poCountByFarm.set(o.farmId, (poCountByFarm.get(o.farmId) ?? 0) + 1);
      const kg = o.quantityKg ?? 0;
      if (Number.isFinite(kg)) {
        weightByFarm.set(o.farmId, (weightByFarm.get(o.farmId) ?? 0) + kg);
      }
      if (isPoClosed(o.status)) {
        const rev = poRevenue(o);
        const cost = expenseByPoId.get(o.id) ?? 0;
        revenueClosedByFarm.set(o.farmId, (revenueClosedByFarm.get(o.farmId) ?? 0) + rev);
        profitClosedByFarm.set(o.farmId, (profitClosedByFarm.get(o.farmId) ?? 0) + (rev - cost));
      }
    }

    for (const s of samples) {
      if (s.farmId && farmIdSet.has(s.farmId)) {
        sampleCountByFarm.set(s.farmId, (sampleCountByFarm.get(s.farmId) ?? 0) + 1);
      }
    }

    const toBar = (m: Map<string, number>, label: (id: string) => string): { label: string; value: number }[] =>
      [...m.entries()]
        .map(([id, value]) => ({ label: label(id), value }))
        .filter((r) => r.value !== 0 || m.get(farms.find((f) => f.code === r.label)?.id ?? '') === 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 12);

    const farmById = new Map(farms.map((f) => [f.id, f] as const));

    const farmsByWeight = [...weightByFarm.entries()]
      .map(([id, value]) => ({ label: farmById.get(id)?.code ?? id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    const farmsByRevenue = [...revenueClosedByFarm.entries()]
      .map(([id, value]) => ({ label: farmById.get(id)?.code ?? id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    const farmsByProfit = [...profitClosedByFarm.entries()]
      .map(([id, value]) => ({ label: farmById.get(id)?.code ?? id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    const farmsByPoCount = [...poCountByFarm.entries()]
      .map(([id, value]) => ({ label: farmById.get(id)?.code ?? id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    const farmsBySample = [...sampleCountByFarm.entries()]
      .map(([id, value]) => ({ label: farmById.get(id)?.code ?? id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    const poPlacementMap = new Map<string, number>();
    for (const o of orders) {
      if (!o.farmId || !farmIdSet.has(o.farmId)) continue;
      const d = (o.orderDate ?? o.createdAt).toISOString().slice(0, 10);
      poPlacementMap.set(d, (poPlacementMap.get(d) ?? 0) + 1);
    }
    const poPlacementOverTime = [...poPlacementMap.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, count]) => ({ date, count }));

    const tableRows = farms.map((f) => ({
      farmId: f.code,
      country: f.country,
      region: f.region ?? '',
      weightKg: weightByFarm.get(f.id) ?? 0,
      revenue: revenueClosedByFarm.get(f.id) ?? 0,
      profit: profitClosedByFarm.get(f.id) ?? 0,
      samples: sampleCountByFarm.get(f.id) ?? 0,
    }));

    res.json({
      staffRestricted,
      allowedCountries,
      selectedCountry,
      kpis: {
        totalFarms: farms.length,
        totalEmployees,
        openPos: openPoCount,
        openPoValue,
      },
      graphs: {
        farmsByWeight: farmsByWeight,
        farmsByRevenue: farmsByRevenue,
        farmsByProfit: farmsByProfit,
        farmsByPoCount: farmsByPoCount,
        farmsBySample: farmsBySample,
        poPlacementOverTime,
      },
      tableRows,
    });
  })
);

export default router;
