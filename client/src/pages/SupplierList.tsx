/**
 * Supplier List: GET /suppliers (scope: Admin all; Buyer assigned; Supplier own).
 * Admin: assign commodity type (classification) via PATCH /suppliers/:id.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';

interface CommodityType {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  code: string;
  name: string;
  city: string | null;
  country: string | null;
  commodityTypeId: string | null;
  commodityType: { id: string; name: string } | null;
}

interface RiskCurrentRow {
  supplier: { id: string };
  level: 'Low' | 'Medium' | 'High';
  score: number;
}

export function SupplierList() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [commodityTypes, setCommodityTypes] = useState<CommodityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [riskBySupplierId, setRiskBySupplierId] = useState<Record<string, { level: string; score: number }>>({});
  const isAdmin = user?.roleNames?.includes('Admin') ?? false;

  useEffect(() => {
    if (!token) return;
    apiJson<Supplier[]>('/suppliers', { token })
      .then(setSuppliers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    apiJson<{ list: CommodityType[] }>('/commodity-types', { token })
      .then((r) => setCommodityTypes(r.list))
      .catch(() => setCommodityTypes([]));
  }, [token, isAdmin]);

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

  const setCommodity = async (supplierId: string, commodityTypeId: string | null) => {
    if (!token || !isAdmin) return;
    setSavingId(supplierId);
    try {
      const updated = await apiJson<Supplier>(`/suppliers/${supplierId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ commodityTypeId }),
      });
      setSuppliers((rows) => rows.map((s) => (s.id === supplierId ? { ...s, ...updated } : s)));
      toast.success('Commodity type updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Approved Supplier List</h1>
          <p className="page-description">Suppliers in your scope.</p>
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
        <p className="page-description">
          Admin sees all; Buyer sees assigned suppliers; Supplier sees own record.
          {isAdmin && ' Admins set commodity type for classification (Admin → Commodity types).'}
        </p>
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
                {isAdmin && <th>Commodity type</th>}
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="table-empty">
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
                    {isAdmin && (
                      <td>
                        <select
                          className="input"
                          style={{ minWidth: 160 }}
                          value={s.commodityTypeId ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            void setCommodity(s.id, v === '' ? null : v);
                          }}
                          disabled={savingId === s.id}
                        >
                          <option value="">— None —</option>
                          {commodityTypes.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                    )}
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
