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
  type: 'risk' | 'opportunity';
  description: string;
  likelihood: 'VeryUnlikely' | 'Unlikely' | 'Possible' | 'Likely' | 'VeryLikely' | null;
  severity: 'Negligible' | 'Minor' | 'Moderate' | 'Significant' | 'Severe' | null;
  riskLevel: 'Low' | 'Medium' | 'High' | null;
  status: 'Open' | 'Mitigated' | 'Closed';
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
  const [newType, setNewType] = useState<'risk' | 'opportunity'>('risk');
  const [newSupplierId, setNewSupplierId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLikelihood, setNewLikelihood] = useState<'VeryUnlikely' | 'Unlikely' | 'Possible' | 'Likely' | 'VeryLikely'>('Possible');
  const [newSeverity, setNewSeverity] = useState<'Negligible' | 'Minor' | 'Moderate' | 'Significant' | 'Severe'>('Moderate');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<'risk' | 'opportunity'>('risk');
  const [editDescription, setEditDescription] = useState('');
  const [editLikelihood, setEditLikelihood] = useState<'VeryUnlikely' | 'Unlikely' | 'Possible' | 'Likely' | 'VeryLikely'>('Possible');
  const [editSeverity, setEditSeverity] = useState<'Negligible' | 'Minor' | 'Moderate' | 'Significant' | 'Severe'>('Moderate');
  const [editStatus, setEditStatus] = useState<'Open' | 'Mitigated' | 'Closed'>('Open');

  const roleNames = user?.roleNames ?? [];
  const canEditRiskItems =
    roleNames.includes('Admin') || roleNames.includes('QualityEngineer') || roleNames.includes('Buyer');

  const load = async (showLoader = true) => {
    if (!token) return;
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const currentQ = filterSupplierId ? `?supplierId=${encodeURIComponent(filterSupplierId)}` : '';
      const listQ = filterSupplierId ? `?supplierId=${encodeURIComponent(filterSupplierId)}` : '';
      const [supplierList, currentList, allItems] = await Promise.all([
        apiJson<Supplier[]>('/suppliers', { token }),
        apiJson<RiskCurrent[]>(`/risk-snapshots/current${currentQ}`, { token }),
        apiJson<OpportunityRow[]>(`/opportunities${listQ}`, { token }),
      ]);
      setSuppliers(supplierList);
      setCurrents(currentList);
      setItems(allItems.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
      if (!newSupplierId && supplierList.length === 1) {
        setNewSupplierId(supplierList[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load risk data');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterSupplierId]);

  const stats = useMemo(() => {
    const rows = currents;
    const avgScore =
      rows.length === 0 ? 0 : Math.round((rows.reduce((sum, r) => sum + r.score, 0) / rows.length) * 100) / 100;
    const openRisks = items.filter((x) => x.type === 'risk' && x.status === 'Open').length;
    const mitigatedRisks = items.filter((x) => x.type === 'risk' && x.status === 'Mitigated').length;
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
  const maxTopRiskScore = Math.max(1, ...topRiskSuppliers.map((r) => r.score));
  const topRiskTotalScore = topRiskSuppliers.reduce((sum, r) => sum + r.score, 0);
  const topRiskPareto = topRiskSuppliers.map((row, idx) => {
    const cumulative = topRiskSuppliers.slice(0, idx + 1).reduce((sum, r) => sum + r.score, 0);
    return {
      ...row,
      cumulativePercent: topRiskTotalScore > 0 ? Math.round((cumulative / topRiskTotalScore) * 100) : 0,
    };
  });

  const distributionSlices = [
    { label: 'Low', count: distribution.low, color: '#22c55e' },
    { label: 'Medium', count: distribution.medium, color: '#f59e0b' },
    { label: 'High', count: distribution.high, color: '#ef4444' },
  ] as const;
  const distributionTotal = distributionSlices.reduce((sum, s) => sum + s.count, 0);
  const distributionPieSegments = distributionSlices.reduce<{ color: string; start: number; end: number }[]>((acc, s) => {
    const start = acc.length > 0 ? acc[acc.length - 1].end : 0;
    const pct = distributionTotal > 0 ? (s.count / distributionTotal) * 100 : 0;
    const end = start + pct;
    acc.push({ color: s.color, start, end });
    return acc;
  }, []);
  const distributionPieBackground =
    distributionTotal === 0
      ? 'conic-gradient(#e5e7eb 0deg, #e5e7eb 360deg)'
      : `conic-gradient(${distributionPieSegments.map((s) => `${s.color} ${s.start}% ${s.end}%`).join(', ')})`;

  const matchesActiveFilters = (row: OpportunityRow): boolean => !filterSupplierId || row.supplierId === filterSupplierId;

  const createItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newSupplierId || !newDescription.trim()) return;
    setSaving(true);
    try {
      const created = await apiJson<OpportunityRow>('/opportunities', {
        token,
        method: 'POST',
        body: JSON.stringify({
          supplierId: newSupplierId,
          description: newDescription.trim(),
          type: newType,
          ...(newType === 'risk' ? { likelihood: newLikelihood, severity: newSeverity } : {}),
        }),
      });
      setNewSupplierId('');
      setNewType('risk');
      setNewDescription('');
      setNewLikelihood('Possible');
      setNewSeverity('Moderate');
      toast.success('Risk/opportunity item added');
      if (matchesActiveFilters(created)) {
        setItems((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
      } else {
        await load(false);
      }
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
      const updated = await apiJson<OpportunityRow>(`/opportunities/${editingId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          description: editDescription.trim(),
          type: editType,
          status: editStatus,
          ...(editType === 'risk' ? { likelihood: editLikelihood, severity: editSeverity } : {}),
        }),
      });
      setEditingId(null);
      toast.success('Risk/opportunity item updated');
      if (matchesActiveFilters(updated)) {
        setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      } else {
        setItems((prev) => prev.filter((row) => row.id !== updated.id));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const closeEditModal = () => {
    if (saving) return;
    setEditingId(null);
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div
                aria-label="Risk distribution pie chart"
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: '50%',
                  background: distributionPieBackground,
                  border: '1px solid var(--color-border)',
                  flex: '0 0 auto',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 160 }}>
                {distributionSlices.map((s) => (
                  <div
                    key={s.label}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', fontSize: 'var(--text-sm)' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                      {s.label}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Top risk suppliers</h2>
            {topRiskSuppliers.length === 0 ? (
              <p className="table-empty">No data.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {topRiskPareto.map((r) => (
                  <div key={r.supplier.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4, gap: '0.75rem' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.supplier.code} — {r.supplier.name}
                      </span>
                      <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {r.score} ({r.cumulativePercent}% cumulative)
                      </span>
                    </div>
                    <div
                      style={{
                        height: 8,
                        background: 'var(--color-border-subtle)',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${(r.score / maxTopRiskScore) * 100}%`,
                          height: '100%',
                          background: '#4f46e5',
                          borderRadius: 4,
                          minWidth: r.score > 0 ? 4 : 0,
                          transition: 'width 0.2s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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

      <div className="card" style={{ marginBottom: '1rem' }}>
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
                    <th>Likelihood</th>
                    <th>Severity</th>
                    <th>Risk level</th>
                    <th>Status</th>
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
                      <td>{row.description}</td>
                      <td>{row.likelihood ?? '—'}</td>
                      <td>{row.severity ?? '—'}</td>
                      <td>{row.riskLevel ?? '—'}</td>
                      <td>{row.status}</td>
                      <td>{new Date(row.createdAt).toLocaleString()}</td>
                      {canEditRiskItems ? (
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => {
                              setEditingId(row.id);
                              setEditType(row.type === 'opportunity' ? 'opportunity' : 'risk');
                              setEditDescription(row.description);
                              setEditStatus(row.status);
                              setEditLikelihood(row.likelihood ?? 'Possible');
                              setEditSeverity(row.severity ?? 'Moderate');
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

      {canEditRiskItems && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Add risk/opportunity</h2>
            <form onSubmit={createItem} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr auto', gap: '0.75rem' }}>
              <select className="input" value={newSupplierId} onChange={(e) => setNewSupplierId(e.target.value)} required>
                <option value="">Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
              <select className="input" value={newType} onChange={(e) => setNewType(e.target.value as 'risk' | 'opportunity')}>
                <option value="risk">Risk</option>
                <option value="opportunity">Opportunity</option>
              </select>
              <input
                className="input"
                placeholder="Description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                required
              />
              {newType === 'risk' ? (
                <>
                  <select className="input" value={newLikelihood} onChange={(e) => setNewLikelihood(e.target.value as 'VeryUnlikely' | 'Unlikely' | 'Possible' | 'Likely' | 'VeryLikely')}>
                    <option value="VeryUnlikely">Very Unlikely</option>
                    <option value="Unlikely">Unlikely</option>
                    <option value="Possible">Possible</option>
                    <option value="Likely">Likely</option>
                    <option value="VeryLikely">Very Likely</option>
                  </select>
                  <select className="input" value={newSeverity} onChange={(e) => setNewSeverity(e.target.value as 'Negligible' | 'Minor' | 'Moderate' | 'Significant' | 'Severe')}>
                    <option value="Negligible">Negligible</option>
                    <option value="Minor">Minor</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Significant">Significant</option>
                    <option value="Severe">Severe</option>
                  </select>
                </>
              ) : (
                <>
                  <div />
                  <div />
                </>
              )}
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </form>
          </div>
        </div>
      )}

      {editingId && (
        <div className="confirm-dialog-overlay" onClick={closeEditModal} role="dialog" aria-modal="true" aria-labelledby="risk-edit-title">
          <div className="confirm-dialog" style={{ maxWidth: 920 }} onClick={(e) => e.stopPropagation()}>
            <h3 id="risk-edit-title" className="confirm-dialog-title">Edit risk/opportunity</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <select className="input" value={editType} onChange={(e) => setEditType(e.target.value as 'risk' | 'opportunity')}>
                <option value="risk">Risk</option>
                <option value="opportunity">Opportunity</option>
              </select>
              <input className="input" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              {editType === 'risk' ? (
                <>
                  <select className="input" value={editLikelihood} onChange={(e) => setEditLikelihood(e.target.value as 'VeryUnlikely' | 'Unlikely' | 'Possible' | 'Likely' | 'VeryLikely')}>
                    <option value="VeryUnlikely">Very Unlikely</option>
                    <option value="Unlikely">Unlikely</option>
                    <option value="Possible">Possible</option>
                    <option value="Likely">Likely</option>
                    <option value="VeryLikely">Very Likely</option>
                  </select>
                  <select className="input" value={editSeverity} onChange={(e) => setEditSeverity(e.target.value as 'Negligible' | 'Minor' | 'Moderate' | 'Significant' | 'Severe')}>
                    <option value="Negligible">Negligible</option>
                    <option value="Minor">Minor</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Significant">Significant</option>
                    <option value="Severe">Severe</option>
                  </select>
                </>
              ) : (
                <>
                  <div />
                  <div />
                </>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem' }}>
              <select className="input" value={editStatus} onChange={(e) => setEditStatus(e.target.value as 'Open' | 'Mitigated' | 'Closed')}>
                <option value="Open">Open</option>
                <option value="Mitigated">Mitigated</option>
                <option value="Closed">Closed</option>
              </select>
              <button className="btn btn-primary" type="button" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={closeEditModal} disabled={saving}>
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
