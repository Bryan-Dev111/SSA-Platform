import { Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

type CountryValueRow = { country: string; value: number };
type TimePointRow = { date: string; count: number };

function normalizeCountry(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  return v || 'None';
}

function normalizeStatus(value: string | null | undefined): string {
  return (value ?? 'Open').trim().toLowerCase();
}

function normalizeCrop(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

const router = Router();
router.use(authMiddleware);
router.use(requirePageAccess('GlobalSupplyDashboard'));

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const [orders, expenses, samples] = await Promise.all([
      prisma.purchaseOrder.findMany({
        select: {
          status: true,
          destinationCountry: true,
          crop: true,
          quantityKg: true,
          pricePerKg: true,
          totalAmount: true,
          createdAt: true,
          farm: { select: { country: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.expense.findMany({
        where: { project: 'Global Vendors' },
        select: {
          amount: true,
          country: true,
        },
      }),
      prisma.sample.findMany({
        select: {
          farm: { select: { country: true } },
        },
      }),
    ]);

    const closedOrders = orders.filter((order) => normalizeStatus(order.status) === 'closed');
    const openOrders = orders.filter((order) => normalizeStatus(order.status) !== 'closed');

    const revenueByCountryMap = new Map<string, number>();
    const coffeeKgByCountryMap = new Map<string, number>();
    const cocoaKgByCountryMap = new Map<string, number>();
    /** Count of POs created per calendar day (all statuses) — “Purchase Order Creation” on Business Dashboard. */
    const poCreationOverTimeMap = new Map<string, number>();
    const expenseByCountryMap = new Map<string, number>();
    const sampleCountByCountryMap = new Map<string, number>();

    for (const sample of samples) {
      const country = normalizeCountry(sample.farm?.country);
      sampleCountByCountryMap.set(country, (sampleCountByCountryMap.get(country) ?? 0) + 1);
    }

    for (const order of closedOrders) {
      const country = normalizeCountry(order.farm?.country ?? order.destinationCountry);
      const revenue =
        order.totalAmount ??
        (order.quantityKg != null && order.pricePerKg != null
          ? order.quantityKg * order.pricePerKg
          : 0);
      revenueByCountryMap.set(country, (revenueByCountryMap.get(country) ?? 0) + revenue);

      const crop = normalizeCrop(order.crop);
      const quantityKg = order.quantityKg ?? 0;
      if (crop === 'coffee') {
        coffeeKgByCountryMap.set(
          country,
          (coffeeKgByCountryMap.get(country) ?? 0) + quantityKg
        );
      }
      if (crop === 'cocoa') {
        cocoaKgByCountryMap.set(
          country,
          (cocoaKgByCountryMap.get(country) ?? 0) + quantityKg
        );
      }
    }

    // Expenses table currently has no workflow status; dashboard uses recorded Global Supply expenses as closed/final.
    for (const expense of expenses) {
      const country = normalizeCountry(expense.country);
      expenseByCountryMap.set(country, (expenseByCountryMap.get(country) ?? 0) + expense.amount);
    }

    for (const order of orders) {
      const date = order.createdAt.toISOString().slice(0, 10);
      poCreationOverTimeMap.set(date, (poCreationOverTimeMap.get(date) ?? 0) + 1);
    }

    const revenueByCountry: CountryValueRow[] = [...revenueByCountryMap.entries()]
      .map(([country, value]) => ({ country, value }))
      .sort((a, b) => b.value - a.value);

    const profitByCountry: CountryValueRow[] = revenueByCountry.map((row) => ({
      country: row.country,
      value: row.value - (expenseByCountryMap.get(row.country) ?? 0),
    }));

    for (const [country, expenseValue] of expenseByCountryMap.entries()) {
      if (!revenueByCountryMap.has(country)) {
        profitByCountry.push({ country, value: -expenseValue });
      }
    }
    profitByCountry.sort((a, b) => b.value - a.value);

    const kgCountryCoffee: CountryValueRow[] = [...coffeeKgByCountryMap.entries()]
      .map(([country, value]) => ({ country, value }))
      .sort((a, b) => b.value - a.value);

    const kgCountryCocoa: CountryValueRow[] = [...cocoaKgByCountryMap.entries()]
      .map(([country, value]) => ({ country, value }))
      .sort((a, b) => b.value - a.value);

    const poCreationOverTimeOpen: TimePointRow[] = [...poCreationOverTimeMap.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, count]) => ({ date, count }));

    const sampleCountByCountry: CountryValueRow[] = [...sampleCountByCountryMap.entries()]
      .map(([country, value]) => ({ country, value }))
      .sort((a, b) => b.value - a.value);

    res.json({
      revenueByCountry,
      profitByCountry,
      kgCountryCoffee,
      kgCountryCocoa,
      poCreationOverTimeOpen,
      sampleCountByCountry,
    });
  })
);

export default router;
