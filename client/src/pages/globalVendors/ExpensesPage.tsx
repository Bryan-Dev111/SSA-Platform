/**
 * Global Vendors — Expenses page.
 * Reuses the shared `/expenses` API but scopes rows to the Global Vendors project.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiJson } from '../../api/client';

type ExpenseRow = {
  id: string;
  code: string;
  type: string;
  description: string;
  project: string;
  amount: number;
  expenseDate: string;
  createdAt: string;
  updatedAt: string;
};

const GLOBAL_VENDORS_PROJECT = 'Global Vendors';

function todayDateInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Shared body for Global Supply expenses (standalone page + Admin tab). */
export function GlobalSupplyExpensesSection() {
  const { token } = useAuth();
  const toast = useToast();
  const [allExpenses, setAllExpenses] = useState<ExpenseRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayDateInputValue);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await apiJson<{ list: ExpenseRow[] }>('/expenses', { token });
      setAllExpenses(r.list ?? []);
    } catch (e) {
      setAllExpenses([]);
      toast.error(
        e instanceof Error ? e.message : 'Failed to load expenses'
      );
    }
  }, [token, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () =>
      allExpenses.filter((row) =>
        row.project === GLOBAL_VENDORS_PROJECT
      ),
    [allExpenses]
  );

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + r.amount, 0),
    [rows]
  );

  const add = async () => {
    if (!token) return;
    const amountNum = Number(price);
    if (!description.trim() || !Number.isFinite(amountNum) || !expenseDate.trim()) {
      toast.error('Description, expense date, and numeric price are required');
      return;
    }
    setBusy(true);
    try {
      await apiJson('/expenses', {
        token,
        method: 'POST',
        body: JSON.stringify({
          type: GLOBAL_VENDORS_PROJECT,
          description: description.trim(),
          project: GLOBAL_VENDORS_PROJECT,
          amount: amountNum,
          expenseDate,
        }),
      });
      setDescription('');
      setPrice('');
      setExpenseDate(todayDateInputValue());
      toast.success('Expense added');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add expense');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-body">
        <p
          style={{
            marginTop: 0,
            marginBottom: '0.75rem',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Track Sentinel Global Supply expenses. Total reflects only rows whose project is{' '}
          <strong>{GLOBAL_VENDORS_PROJECT}</strong>.
        </p>

        <div
          className="dashboard-metric-grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            marginBottom: '0.75rem',
          }}
        >
          <div className="card metric-card">
            <div className="metric-card-label">Total spent</div>
            <div className="metric-card-value">
              ${total.toFixed(2)}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '0.6rem',
            marginBottom: '1rem',
          }}
        >
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Description</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Sample shipping, QC lab fee"
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Expense date</label>
            <input
              className="input"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Price</label>
            <input
              className="input"
              type="number"
              step={0.01}
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={add}
              disabled={busy}
            >
              Add expense
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table table--sticky-header">
            <thead>
              <tr>
                <th>EXP ID</th>
                <th>Description</th>
                <th>Price</th>
                <th>Expense date</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No expenses for this project yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.code}</td>
                    <td>{r.description}</td>
                    <td>${r.amount.toFixed(2)}</td>
                    <td>
                      {r.expenseDate
                        ? new Date(r.expenseDate).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ExpensesPage() {
  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Expenses</h1>
      </header>
      <GlobalSupplyExpensesSection />
    </div>
  );
}

