/**
 * Global Supply — Internal Management → Profit: PO vs expense rollup (open + closed),
 * widgets for closed POs only (total revenue, total profit).
 */
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { apiJson } from '../../api/client';
import { MetricCard } from '../../components/MetricCard';
import { formatUsd } from '../../utils/formatUsd';
import { parseApiError } from '../../utils/apiHelpers';
import {
  GLOBAL_VENDORS_PROJECT,
  computeClosedPurchaseOrderFinancials,
  poRevenue,
} from '../../utils/globalSupplyClosedPoMetrics';

type PurchaseOrderRow = {
  id: string;
  code: string;
  status: string | null;
  quantityKg: number | null;
  pricePerKg: number | null;
  totalAmount: number | null;
};

type ExpenseRow = {
  id: string;
  code: string;
  amount: number;
  project: string;
  type?: string;
  description?: string;
  status?: string | null;
  purchaseOrderId?: string | null;
};

function expenseHoverTitle(e: ExpenseRow): string {
  const type = (e.type ?? '').trim() || '—';
  const desc = (e.description ?? '').trim() || '—';
  // Single line: many browsers ignore newlines in native `title` tooltips.
  return `Type: ${type} — Description: ${desc}`;
}

function expNumericSuffix(code: string): number {
  const m = /^EXP-(\d+)$/i.exec(code.trim());
  return m ? Number(m[1]) : 0;
}

/** Higher EXP-##### first (matches reference layout). */
function sortExpensesForGroup(expenses: ExpenseRow[]): ExpenseRow[] {
  return [...expenses].sort((a, b) => {
    const na = expNumericSuffix(a.code);
    const nb = expNumericSuffix(b.code);
    if (na !== nb) return nb - na;
    return b.code.localeCompare(a.code);
  });
}

function poNumericSuffix(code: string): number {
  const m = /^PO-(\d+)$/i.exec(code.trim());
  return m ? Number(m[1]) : 0;
}

function sortPurchaseOrdersDesc(orders: PurchaseOrderRow[]): PurchaseOrderRow[] {
  return [...orders].sort((a, b) => {
    const na = poNumericSuffix(a.code);
    const nb = poNumericSuffix(b.code);
    if (na !== nb) return nb - na;
    return b.code.localeCompare(a.code);
  });
}

export function GlobalSupplyProfitTab({ token }: { token: string | null }) {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [poDenied, setPoDenied] = useState(false);
  const [expenseDenied, setExpenseDenied] = useState(false);

  const gvExpenses = useMemo(
    () => expenses.filter((e) => e.project === GLOBAL_VENDORS_PROJECT),
    [expenses]
  );

  const load = useCallback(async () => {
    if (!token) {
      setOrders([]);
      setExpenses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setPoDenied(false);
    setExpenseDenied(false);

    const poP = apiJson<PurchaseOrderRow[]>('/purchase-orders', { token }).catch(() => {
      setPoDenied(true);
      return [] as PurchaseOrderRow[];
    });
    const exP = apiJson<{ list: ExpenseRow[] }>('/expenses', { token }).catch(() => {
      setExpenseDenied(true);
      return { list: [] as ExpenseRow[] };
    });

    try {
      const [poRows, exRes] = await Promise.all([poP, exP]);
      setOrders(poRows);
      setExpenses(exRes.list);
    } catch (e) {
      setError(parseApiError(e));
      setOrders([]);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const expensesByPoId = useMemo(() => {
    const m = new Map<string, ExpenseRow[]>();
    for (const e of gvExpenses) {
      const pid = e.purchaseOrderId?.trim();
      if (!pid) continue;
      if (!m.has(pid)) m.set(pid, []);
      m.get(pid)!.push(e);
    }
    return m;
  }, [gvExpenses]);

  const unlinkedExpenses = useMemo(
    () => sortExpensesForGroup(gvExpenses.filter((e) => !e.purchaseOrderId?.trim())),
    [gvExpenses]
  );

  const closedPoWidgets = useMemo(
    () => computeClosedPurchaseOrderFinancials(orders, gvExpenses),
    [orders, gvExpenses]
  );

  const tableGroups = useMemo(() => {
    const sortedPos = sortPurchaseOrdersDesc(orders);
    const groups: {
      key: string;
      po: PurchaseOrderRow | null;
      revenue: number;
      expenses: ExpenseRow[];
    }[] = sortedPos.map((po) => ({
      key: po.id,
      po,
      revenue: poRevenue(po),
      expenses: sortExpensesForGroup(expensesByPoId.get(po.id) ?? []),
    }));
    if (unlinkedExpenses.length > 0) {
      groups.push({
        key: 'unlinked',
        po: null,
        revenue: 0,
        expenses: unlinkedExpenses,
      });
    }
    return groups;
  }, [orders, expensesByPoId, unlinkedExpenses]);

  const cellBorder: CSSProperties = {
    border: '1px solid var(--color-border, #cbd5e1)',
    padding: '0.5rem 0.65rem',
    verticalAlign: 'middle',
  };

  return (
    <div>
      <div
        className="dashboard-metric-grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          marginBottom: '1rem',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <MetricCard
          title="Total Revenue"
          value={loading ? '—' : formatUsd(closedPoWidgets.totalRevenue)}
        />
        <MetricCard
          title="Total Profit"
          value={loading ? '—' : formatUsd(closedPoWidgets.totalProfit)}
        />
      </div>

      {(poDenied || expenseDenied) && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          {poDenied && 'Purchase orders could not be loaded (permission or network). '}
          {expenseDenied && 'Expenses could not be loaded (permission or network). '}
          The table may be incomplete until both succeed.
        </p>
      )}

      {error && <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Purchase orders &amp; expenses</h2>
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            {loading ? (
              <p className="table-empty">Loading…</p>
            ) : tableGroups.length === 0 ? (
              <p className="table-empty">No purchase orders and no unlinked expenses yet.</p>
            ) : (
              <table
                className="table"
                style={{
                  borderCollapse: 'collapse',
                  width: '100%',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <thead>
                  <tr>
                    <th style={cellBorder}>{t('table.col.purchaseOrder')}</th>
                    <th style={cellBorder}>{t('table.col.revenue')}</th>
                    <th style={cellBorder}>{t('table.col.expense')}</th>
                    <th style={cellBorder}>{t('table.col.amount')}</th>
                    <th style={cellBorder}>{t('table.col.profit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tableGroups.map((group) => {
                    const rows =
                      group.expenses.length > 0
                        ? group.expenses.map((e) => ({ kind: 'expense' as const, expense: e }))
                        : [{ kind: 'placeholder' as const, expense: null }];
                    const rowCount = rows.length;
                    return rows.map((row, i) => {
                      const amounts = group.expenses.map((e) => (Number.isFinite(e.amount) ? e.amount : 0));
                      const suffixFromI =
                        group.expenses.length === 0
                          ? 0
                          : amounts.slice(i).reduce((s, x) => s + x, 0);
                      const revBase = group.po ? group.revenue : 0;
                      const profitVal = revBase - suffixFromI;
                      const isFirst = i === 0;
                      const isClosedPo = (group.po?.status ?? 'Open').trim().toLowerCase() === 'closed';
                      return (
                        <tr
                          key={`${group.key}-${row.kind === 'placeholder' ? 'ph' : row.expense!.id}`}
                          style={isClosedPo ? { backgroundColor: 'var(--color-surface-2, #f3f4f6)' } : undefined}
                        >
                          {isFirst ? (
                            <>
                              <td rowSpan={rowCount} style={{ ...cellBorder, fontWeight: 600 }}>
                                {group.po ? group.po.code : 'None'}
                              </td>
                              <td rowSpan={rowCount} style={cellBorder}>
                                {group.po ? formatUsd(group.revenue) : '—'}
                              </td>
                            </>
                          ) : null}
                          <td
                            style={{
                              ...cellBorder,
                              ...(row.expense ? { cursor: 'help' as const } : {}),
                            }}
                            title={row.expense ? expenseHoverTitle(row.expense) : undefined}
                          >
                            {row.expense ? row.expense.code : '—'}
                          </td>
                          <td style={cellBorder}>{row.expense ? formatUsd(row.expense.amount) : '—'}</td>
                          <td style={{ ...cellBorder, fontWeight: isFirst ? 700 : 400 }}>{formatUsd(profitVal)}</td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
