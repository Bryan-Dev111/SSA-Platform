import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface RiskCurrent {
  supplier: Supplier;
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

interface OpportunityRow {
  id: string;
  supplierId: string;
  supplier: Supplier;
  description: string | null;
  type: string;
  createdAt: string;
}

export function Risk() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [currents, setCurrents] = useState<RiskCurrent[]>([]);
  const [items, setItems] = useState<OpportunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [newType, setNewType] = useState<'risk' | 'opportunity' | 'mitigated'>('risk');
  const [newSupplierId, setNewSupplierId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<'risk' | 'opportunity' | 'mitigated'>('risk');
  const [editDescription, setEditDescription] = useState('');

  const roleNames = user?.roleNames ?? [];
  const isBuyer = roleNames.includes('Buyer');
  const canEditRiskItems =
    roleNames.includes('Admin') || roleNames.includes('QualityEngineer') || roleNames.includes('Buyer');

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const q = filterSupplierId ? `?supplierId=${encodeURIComponent(filterSupplierId)}` : '';
      const [supplierList, currentList, riskList, oppList] = await Promise.all([
        apiJson<Supplier[]>('/suppliers', { token }),
        apiJson<RiskCurrent[]>(`/risk-snapshots/current${q}`, { token }),
        apiJson<OpportunityRow[]>(`/opportunities?type=risk${q ? `&supplierId=${encodeURIComponent(filterSupplierId)}` : ''}`, { token }),
        apiJson<OpportunityRow[]>(`/opportunities?type=opportunity${q ? `&supplierId=${encodeURIComponent(filterSupplierId)}` : ''}`, { token }),
      ]);
      setSuppliers(supplierList);
      setCurrents(currentList);
      setItems([...riskList, ...oppList].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
      if (!newSupplierId && supplierList.length === 1) {
        setNewSupplierId(supplierList[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load risk data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterSupplierId]);

  const stats = useMemo(() => {
    const rows = currents;
    const avgScore =
      rows.length === 0 ? 0 : Math.round((rows.reduce((sum, r) => sum + r.score, 0) / rows.length) * 100) / 100;
    const openRisks = items.filter((x) => x.type === 'risk').length;
    const mitigatedRisks = items.filter((x) => x.type === 'mitigated').length;
    const opportunities = items.filter((x) => x.type === 'opportunity').length;
    return { avgScore, openRisks, mitigatedRisks, opportunities };
  }, [currents, items]);

  const distribution = useMemo(() => {
    const low = currents.filter((r) => r.level === 'Low').length;
    const medium = currents.filter((r) => r.level === 'Medium').length;
    const high = currents.filter((r) => r.level === 'High').length;
    return { low, medium, high };
  }, [currents]);

  const topRiskSuppliers = useMemo(
    () => [...currents].sort((a, b) => b.score - a.score).slice(0, 5),
    [currents]
  );

  const createItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newSupplierId || !newDescription.trim()) return;
    setSaving(true);
    try {
      await apiJson('/opportunities', {
        token,
        method: 'POST',
        body: JSON.stringify({
          supplierId: newSupplierId,
          description: newDescription.trim(),
          type: newType,
        }),
      });
      setNewSupplierId('');
      setNewType('risk');
      setNewDescription('');
      toast.success('Risk/opportunity item added');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!token || !editingId || !editDescription.trim()) return;
    setSaving(true);
    try {
      await apiJson(`/opportunities/${editingId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          description: editDescription.trim(),
          type: editType,
        }),
      });
      setEditingId(null);
      toast.success('Risk/opportunity item updated');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const recalculate = async () => {
    if (!token) return;
    setRecalcLoading(true);
    try {
      await apiJson('/risk-snapshots/recalculate', {
        token,
        method: 'POST',
        body: JSON.stringify(filterSupplierId ? { supplierId: filterSupplierId } : {}),
      });
      toast.success('Risk snapshots recalculated');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to recalculate');
    } finally {
      setRecalcLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Risk</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading risk data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Risk</h1>
        <p className="page-description">
          Supplier risk score, distribution, and risk/opportunity tracking. Buyers see assigned suppliers only.
        </p>
      </header>

      {error && <div className="alert-error">{error}</div>}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <label>
          <span style={{ marginRight: 8, fontSize: 'var(--text-sm)' }}>Supplier filter:</span>
          <select
            className="input"
            style={{ minWidth: 220, width: 'auto' }}
            value={filterSupplierId}
            onChange={(e) => setFilterSupplierId(e.target.value)}
          >
            <option value="">All in scope</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
        {!isBuyer && (
          <button className="btn btn-secondary" type="button" onClick={recalculate} disabled={recalcLoading}>
            {recalcLoading ? 'Recalculating…' : 'Recalculate risk'}
          </button>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          marginBottom: '1rem',
        }}
      >
        <MetricCard title="Risk score (avg)" value={String(stats.avgScore)} />
        <MetricCard title="Open risks" value={String(stats.openRisks)} />
        <MetricCard title="Mitigated risks" value={String(stats.mitigatedRisks)} />
        <MetricCard title="Open opportunities" value={String(stats.opportunities)} />
      </div>

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          marginBottom: '1rem',
        }}
      >
        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Risk distribution</h2>
            <p style={{ margin: 0 }}>Low: {distribution.low}</p>
            <p style={{ margin: 0 }}>Medium: {distribution.medium}</p>
            <p style={{ margin: 0 }}>High: {distribution.high}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Top risk suppliers</h2>
            {topRiskSuppliers.length === 0 ? (
              <p className="table-empty">No data.</p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {topRiskSuppliers.map((r) => (
                  <li key={r.supplier.id}>
                    {r.supplier.code} — {r.supplier.name} ({r.level}, {r.score})
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      {canEditRiskItems && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Add risk/opportunity</h2>
            <form onSubmit={createItem} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: '0.75rem' }}>
              <select className="input" value={newSupplierId} onChange={(e) => setNewSupplierId(e.target.value)} required>
                <option value="">Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
              <select className="input" value={newType} onChange={(e) => setNewType(e.target.value as 'risk' | 'opportunity' | 'mitigated')}>
                <option value="risk">Risk</option>
                <option value="mitigated">Mitigated risk</option>
                <option value="opportunity">Opportunity</option>
              </select>
              <input
                className="input"
                placeholder="Description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                required
              />
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Risk scores by supplier</h2>
          <div className="table-wrap">
            {currents.length === 0 ? (
              <p className="table-empty">No suppliers in scope.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Score</th>
                    <th>Level</th>
                    <th>Quality</th>
                    <th>Audit</th>
                    <th>Delivery</th>
                    <th>CAR closure</th>
                    <th>Documentation</th>
                  </tr>
                </thead>
                <tbody>
                  {currents.map((r) => (
                    <tr key={r.supplier.id}>
                      <td>
                        {r.supplier.code} — {r.supplier.name}
                      </td>
                      <td>{r.score}</td>
                      <td>{r.level}</td>
                      <td>{r.factors.quality}</td>
                      <td>{r.factors.audit}</td>
                      <td>{r.factors.delivery}</td>
                      <td>{r.factors.carClosure}</td>
                      <td>{r.factors.documentation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Risks and opportunities</h2>
          <div className="table-wrap">
            {items.length === 0 ? (
              <p className="table-empty">No rows.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Created</th>
                    {canEditRiskItems ? <th>Action</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.supplier.code} — {row.supplier.name}
                      </td>
                      <td>{row.type}</td>
                      <td>{row.description ?? '—'}</td>
                      <td>{new Date(row.createdAt).toLocaleString()}</td>
                      {canEditRiskItems ? (
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => {
                              setEditingId(row.id);
                              setEditType(
                                row.type === 'mitigated' ? 'mitigated' : row.type === 'opportunity' ? 'opportunity' : 'risk'
                              );
                              setEditDescription(row.description ?? '');
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {editingId && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Edit item</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto auto', gap: '0.75rem' }}>
              <select className="input" value={editType} onChange={(e) => setEditType(e.target.value as 'risk' | 'opportunity' | 'mitigated')}>
                <option value="risk">Risk</option>
                <option value="mitigated">Mitigated risk</option>
                <option value="opportunity">Opportunity</option>
              </select>
              <input className="input" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              <button className="btn btn-primary" type="button" onClick={saveEdit} disabled={saving}>
                Save
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setEditingId(null)} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="card">
      <div className="card-body" style={{ padding: '0.9rem' }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{title}</div>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  );
}
