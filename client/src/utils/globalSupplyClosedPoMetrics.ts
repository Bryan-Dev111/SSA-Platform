/**
 * Shared rules for Global Supply closed PO revenue/profit (aligned with Profit tab widgets).
 */

export const GLOBAL_VENDORS_PROJECT = 'Global Vendors';

export type PurchaseOrderFinancialRow = {
  id: string;
  status: string | null;
  quantityKg: number | null;
  pricePerKg: number | null;
  totalAmount: number | null;
};

export type ExpenseFinancialRow = {
  amount: number;
  project: string;
  purchaseOrderId?: string | null;
};

export function poRevenue(row: PurchaseOrderFinancialRow): number {
  if (typeof row.totalAmount === 'number' && Number.isFinite(row.totalAmount)) return row.totalAmount;
  if (
    row.quantityKg != null &&
    row.pricePerKg != null &&
    Number.isFinite(row.quantityKg) &&
    Number.isFinite(row.pricePerKg)
  ) {
    return row.quantityKg * row.pricePerKg;
  }
  return 0;
}

export function isPurchaseOrderClosed(status: string | null | undefined): boolean {
  return (status ?? '').trim().toLowerCase() === 'closed';
}

export function filterGlobalVendorsExpenses(expenses: ExpenseFinancialRow[]): ExpenseFinancialRow[] {
  return expenses.filter((e) => e.project === GLOBAL_VENDORS_PROJECT);
}

/** Linked Global Vendors expense totals by purchase order id. */
export function expenseTotalsByPurchaseOrderId(expenses: ExpenseFinancialRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of expenses) {
    const pid = e.purchaseOrderId?.trim();
    if (!pid) continue;
    const amt = Number.isFinite(e.amount) ? e.amount : 0;
    m.set(pid, (m.get(pid) ?? 0) + amt);
  }
  return m;
}

export type ClosedPoFinancialSummary = {
  closedCount: number;
  totalRevenue: number;
  totalProfit: number;
  averageRevenuePerClosedPo: number;
  averageProfitPerClosedPo: number;
};

export function computeClosedPurchaseOrderFinancials(
  orders: PurchaseOrderFinancialRow[],
  globalVendorsExpenses: ExpenseFinancialRow[]
): ClosedPoFinancialSummary {
  const byPo = expenseTotalsByPurchaseOrderId(globalVendorsExpenses);
  const closed = orders.filter((o) => isPurchaseOrderClosed(o.status));
  let totalRevenue = 0;
  let totalProfit = 0;
  for (const po of closed) {
    const rev = poRevenue(po);
    const cost = byPo.get(po.id) ?? 0;
    totalRevenue += rev;
    totalProfit += rev - cost;
  }
  const n = closed.length;
  return {
    closedCount: n,
    totalRevenue,
    totalProfit,
    averageRevenuePerClosedPo: n > 0 ? totalRevenue / n : 0,
    averageProfitPerClosedPo: n > 0 ? totalProfit / n : 0,
  };
}
