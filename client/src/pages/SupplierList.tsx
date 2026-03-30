/**
 * Supplier List: GET /suppliers (scope: Admin all; Buyer assigned; Supplier own).
 * Commodity type is read-only here; Admin sets it when creating a supplier (Admin → Buyers & Suppliers).
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiJson } from '../api/client';

interface Supplier {
  id: string;
  code: string;
  name: string;
  city: string | null;
  country: string | null;
  status: string;
  commodityTypeId: string | null;
  commodityType: { id: string; name: string } | null;
  createdAt: string;
}

interface RiskCurrentRow {
  supplier: { id: string };
  level: 'Low' | 'Medium' | 'High';
  score: number;
}

function supplierStatusLabel(status: string | undefined): string {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'inactive') return 'Inactive';
  return 'Active';
}

export function SupplierList() {
  const { token } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskBySupplierId, setRiskBySupplierId] = useState<Record<string, { level: string; score: number }>>({});

  useEffect(() => {
    if (!token) return;
    apiJson<Supplier[]>('/suppliers', { token })
      .then(setSuppliers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    apiJson<RiskCurrentRow[]>('/risk-snapshots/current', { token })
      .then((rows) => {
        const map: Record<string, { level: string; score: number }> = {};
        for (const row of rows) {
          map[row.supplier.id] = { level: row.level, score: row.score };
        }
        setRiskBySupplierId(map);
      })
      .catch(() => setRiskBySupplierId({}));
  }, [token]);

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Approved Supplier List</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading suppliers…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Approved Supplier List</h1>
        </header>
        <div className="alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Approved Supplier List</h1>
      </header>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>City</th>
                <th>Country</th>
                <th>Risk level</th>
                <th>Commodity</th>
                <th>Created date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-empty">
                    No suppliers in scope.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.code}</strong></td>
                    <td>{s.name}</td>
                    <td>{s.city ?? '—'}</td>
                    <td>{s.country ?? '—'}</td>
                    <td>
                      {riskBySupplierId[s.id]
                        ? `${riskBySupplierId[s.id].level} (${riskBySupplierId[s.id].score})`
                        : '—'}
                    </td>
                    <td>{s.commodityType?.name ?? '—'}</td>
                    <td>{s.createdAt ? s.createdAt.slice(0, 10) : '—'}</td>
                    <td>
                      <span
                        className={supplierStatusLabel(s.status) === 'Inactive' ? 'audit-status-badge audit-status-badge--cancelled' : 'audit-status-badge audit-status-badge--complete'}
                        style={{ fontSize: 'var(--text-xs)' }}
                        title={supplierStatusLabel(s.status)}
                      >
                        {supplierStatusLabel(s.status)}
                      </span>
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
