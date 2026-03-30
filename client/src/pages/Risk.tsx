import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { RiskDistributionCard } from '../components/RiskDistributionCard';
import { apiJson } from '../api/client';
import { downloadTableXlsx, type ExportRow } from '../utils/exportExcel';
import { computeRiskRegisterDistribution } from '../utils/riskDistribution';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface OpportunityRow {
  id: string;
  code: string;
  supplierId: string;
  supplier: Supplier;
  createdBy?: { id: string; name: string | null; email: string } | null;
  type: 'risk' | 'opportunity';
  description: string;
  likelihood: 'VeryUnlikely' | 'Unlikely' | 'Possible' | 'Likely' | 'VeryLikely' | null;
  severity: 'Negligible' | 'Minor' | 'Moderate' | 'Significant' | 'Severe' | null;
  riskLevel: 'Low' | 'Medium' | 'High' | null;
  status: 'Open' | 'Mitigated' | 'Closed' | 'Realized';
  createdAt: string;
}

interface RiskSnapshotRow {
  id: string;
  supplierId: string;
  score: number | null;
  createdAt: string;
}

interface RiskActionRow {
  id: string;
  code: string;
  supplierId: string;
  supplier: Supplier;
  riskId: string;
  risk: { id: string; code: string; description: string; riskLevel: 'Low' | 'Medium' | 'High' | null };
  description: string;
  owner: string | null;
  dueDate: string | null;
  status: 'Open' | 'Closed';
  residualLikelihood: 'VeryUnlikely' | 'Unlikely' | 'Possible' | 'Likely' | 'VeryLikely' | null;
  residualSeverity: 'Negligible' | 'Minor' | 'Moderate' | 'Significant' | 'Severe' | null;
  residualRiskLevel: 'Low' | 'Medium' | 'High' | null;
  createdBy?: { id: string; name: string | null; email: string } | null;
  createdAt: string;
}

type RiskLikelihood = NonNullable<OpportunityRow['likelihood']>;
type RiskSeverity = NonNullable<OpportunityRow['severity']>;

function levelWeight(level: string | null): number {
  if (level === 'High') return 90;
  if (level === 'Medium') return 60;
  if (level === 'Low') return 30;
  return 0;
}

export function Risk() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [snapshots, setSnapshots] = useState<RiskSnapshotRow[]>([]);
  const [items, setItems] = useState<OpportunityRow[]>([]);
  const [actions, setActions] = useState<RiskActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newType, setNewType] = useState<'risk' | 'opportunity'>('risk');
  const [newSupplierId, setNewSupplierId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLikelihood, setNewLikelihood] = useState<RiskLikelihood>('Possible');
  const [newSeverity, setNewSeverity] = useState<RiskSeverity>('Moderate');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<'risk' | 'opportunity'>('risk');
  const [editDescription, setEditDescription] = useState('');
  const [editLikelihood, setEditLikelihood] = useState<RiskLikelihood>('Possible');
  const [editSeverity, setEditSeverity] = useState<RiskSeverity>('Moderate');
  const [editStatus, setEditStatus] = useState<OpportunityRow['status']>('Open');

  const [newActionSupplierId, setNewActionSupplierId] = useState('');
  const [newActionRiskId, setNewActionRiskId] = useState('');
  const [newActionDescription, setNewActionDescription] = useState('');
  const [newActionOwner, setNewActionOwner] = useState('');
  const [newActionDueDate, setNewActionDueDate] = useState('');
  const [newActionStatus, setNewActionStatus] = useState<'Open' | 'Closed'>('Open');
  const [newResidualLikelihood, setNewResidualLikelihood] = useState<RiskLikelihood>('Possible');
  const [newResidualSeverity, setNewResidualSeverity] = useState<RiskSeverity>('Moderate');

  const roleNames = user?.roleNames ?? [];
  const canEditRiskItems =
    roleNames.includes('Admin') ||
    roleNames.includes('QualityEngineer') ||
    roleNames.includes('QualityManager') ||
    roleNames.includes('Buyer');

  const load = async (showLoader = true) => {
    if (!token) return;
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const q = filterSupplierId ? `?supplierId=${encodeURIComponent(filterSupplierId)}` : '';
      const [supplierList, snapshotList, allItems, allActions] = await Promise.all([
        apiJson<Supplier[]>('/suppliers', { token }),
        apiJson<RiskSnapshotRow[]>(`/risk-snapshots${q}`, { token }),
        apiJson<OpportunityRow[]>(`/opportunities${q}`, { token }),
        apiJson<RiskActionRow[]>(`/risk-actions${q}`, { token }),
      ]);
      setSuppliers(supplierList);
      setSnapshots(snapshotList);
      setItems(allItems.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
      setActions(allActions.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
      if (!newSupplierId && supplierList.length === 1) setNewSupplierId(supplierList[0].id);
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

  const latestActionByRisk = useMemo(() => {
    const m = new Map<string, RiskActionRow>();
    for (const action of actions) {
      if (!m.has(action.riskId)) m.set(action.riskId, action);
    }
    return m;
  }, [actions]);

  const effectiveRisks = useMemo(() => {
    return items
      .filter((r) => r.type === 'risk')
      .map((r) => {
        const action = latestActionByRisk.get(r.id);
        const useResidual =
          action?.status === 'Closed' && !!action.residualLikelihood && !!action.residualSeverity && !!action.residualRiskLevel;
        return {
          ...r,
          effectiveLikelihood: (useResidual ? action!.residualLikelihood : r.likelihood) as OpportunityRow['likelihood'],
          effectiveSeverity: (useResidual ? action!.residualSeverity : r.severity) as OpportunityRow['severity'],
          effectiveRiskLevel: useResidual ? action!.residualRiskLevel : r.riskLevel,
        };
      });
  }, [items, latestActionByRisk]);

  const distribution = useMemo(() => computeRiskRegisterDistribution(items, actions), [items, actions]);

  const trendBySupplier = useMemo(() => {
    const grouped = new Map<string, RiskSnapshotRow[]>();
    for (const row of snapshots) {
      const existing = grouped.get(row.supplierId) ?? [];
      existing.push(row);
      grouped.set(row.supplierId, existing);
    }
    const result = new Map<string, number | null>();
    for (const [supplierId, rows] of grouped.entries()) {
      const sorted = [...rows]
        .filter((r) => typeof r.score === 'number')
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      if (sorted.length < 2 || !sorted[0].score || !sorted[1].score) {
        result.set(supplierId, null);
        continue;
      }
      const latest = Number(sorted[0].score);
      const previous = Number(sorted[1].score);
      if (previous === 0) {
        result.set(supplierId, null);
        continue;
      }
      const pct = ((latest - previous) / previous) * 100;
      result.set(supplierId, Math.round(pct * 100) / 100);
    }
    return result;
  }, [snapshots]);

  const avgTrendPercent = useMemo(() => {
    const rows = Array.from(trendBySupplier.values()).filter((v): v is number => typeof v === 'number');
    if (rows.length === 0) return null;
    const avg = rows.reduce((sum, v) => sum + v, 0) / rows.length;
    return Math.round(avg * 100) / 100;
  }, [trendBySupplier]);

  const stats = useMemo(() => {
    const now = new Date();
    const avgScore =
      effectiveRisks.length === 0
        ? 0
        : Math.round((effectiveRisks.reduce((sum, r) => sum + levelWeight(r.effectiveRiskLevel), 0) / effectiveRisks.length) * 100) / 100;
    const openRisks = effectiveRisks.filter((x) => x.status === 'Open').length;
    const mitigatedRisks = actions.filter((x) => x.status === 'Closed').length;
    const openActions = actions.filter((x) => x.status === 'Open').length;
    const overdueActions = actions.filter((x) => x.status === 'Open' && x.dueDate && new Date(x.dueDate) < now).length;
    const opportunities = items.filter((x) => x.type === 'opportunity').length;
    return { avgScore, openRisks, mitigatedRisks, openActions, overdueActions, opportunities };
  }, [effectiveRisks, actions, items]);

  const topRiskSuppliers = useMemo(() => {
    const bySupplier = new Map<string, { supplier: Supplier; score: number }>();
    for (const risk of effectiveRisks) {
      const existing = bySupplier.get(risk.supplierId) ?? { supplier: risk.supplier, score: 0 };
      existing.score += levelWeight(risk.effectiveRiskLevel);
      bySupplier.set(risk.supplierId, existing);
    }
    return [...bySupplier.values()].sort((a, b) => b.score - a.score).slice(0, 5);
  }, [effectiveRisks]);
  const maxTopRiskScore = Math.max(1, ...topRiskSuppliers.map((r) => r.score));
  const topRiskTotalScore = topRiskSuppliers.reduce((sum, r) => sum + r.score, 0);
  const topRiskPareto = topRiskSuppliers.map((row, idx) => {
    const cumulative = topRiskSuppliers.slice(0, idx + 1).reduce((sum, r) => sum + r.score, 0);
    return { ...row, cumulativePercent: topRiskTotalScore > 0 ? Math.round((cumulative / topRiskTotalScore) * 100) : 0 };
  });

  const matrixLikelihoodOrder: Array<OpportunityRow['likelihood']> = ['VeryLikely', 'Likely', 'Possible', 'Unlikely', 'VeryUnlikely'];
  const matrixSeverityOrder: Array<OpportunityRow['severity']> = ['Negligible', 'Minor', 'Moderate', 'Significant', 'Severe'];
  const matrixLabelGrid: string[][] = [
    ['Low Med', 'Medium', 'Med Hi', 'High', 'High'],
    ['Low', 'Low Med', 'Medium', 'Med Hi', 'High'],
    ['Low', 'Low Med', 'Medium', 'Med Hi', 'Med Hi'],
    ['Low', 'Low Med', 'Low Med', 'Medium', 'Med Hi'],
    ['Low', 'Low', 'Low Med', 'Medium', 'Medium'],
  ];
  const matrixColorByLabel: Record<string, string> = {
    Low: '#22c55e',
    'Low Med': '#9ad950',
    Medium: '#f6ea23',
    'Med Hi': '#f7c81e',
    High: '#f0142f',
  };

  const riskPinsByCell = useMemo(() => {
    const map = new Map<string, typeof effectiveRisks>();
    for (const row of effectiveRisks) {
      if (!row.effectiveLikelihood || !row.effectiveSeverity) continue;
      const key = `${row.effectiveLikelihood}|${row.effectiveSeverity}`;
      const existing = map.get(key) ?? [];
      existing.push(row);
      map.set(key, existing);
    }
    return map;
  }, [effectiveRisks]);

  const matchesActiveFilters = (row: OpportunityRow): boolean => !filterSupplierId || row.supplierId === filterSupplierId;

  const handleExportRiskTable = () => {
    try {
      const rows: ExportRow[] = items.map((row) => ({
        ID: row.code,
        Supplier: `${row.supplier.code} - ${row.supplier.name}`,
        Type: row.type,
        Description: row.description,
        Likelihood: row.likelihood ?? '—',
        Severity: row.severity ?? '—',
        'Risk level': row.riskLevel ?? '—',
        Status: row.status,
        Created: new Date(row.createdAt).toLocaleString(),
      }));
      if (rows.length === 0) return;
      const supplierSuffix =
        suppliers.find((s) => s.id === filterSupplierId)?.code?.replace(/[^A-Za-z0-9_-]/g, '_') ?? 'All';
      downloadTableXlsx(`Risk_Table_${supplierSuffix}`, 'Risk Table', rows);
      toast.success('Exported to Excel');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

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
      if (matchesActiveFilters(created)) setItems((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
      else await load(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  const createAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newActionSupplierId || !newActionRiskId || !newActionDescription.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        supplierId: newActionSupplierId,
        riskId: newActionRiskId,
        description: newActionDescription.trim(),
        owner: newActionOwner.trim() || null,
        dueDate: newActionDueDate || null,
        status: newActionStatus,
      };
      if (newActionStatus === 'Closed') {
        payload.residualLikelihood = newResidualLikelihood;
        payload.residualSeverity = newResidualSeverity;
      }
      const created = await apiJson<RiskActionRow>('/risk-actions', {
        token,
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setActions((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
      setNewActionSupplierId('');
      setNewActionRiskId('');
      setNewActionDescription('');
      setNewActionOwner('');
      setNewActionDueDate('');
      setNewActionStatus('Open');
      toast.success('Action added');
      await load(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create action');
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
      if (matchesActiveFilters(updated)) setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      else setItems((prev) => prev.filter((row) => row.id !== updated.id));
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
          <p style={{ marginTop: 12 }}>Loading risk data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Risk</h1>
      </header>

      {error && <div className="alert-error">{error}</div>}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <label>
          <span style={{ marginRight: 8, fontSize: 'var(--text-sm)' }}>Supplier filter:</span>
          <select className="input" style={{ minWidth: 220, width: 'auto' }} value={filterSupplierId} onChange={(e) => setFilterSupplierId(e.target.value)}>
            <option value="">All in scope</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} - {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="risk-kpi-grid">
        <MetricCard
          title="Risk score (avg)"
          value={String(stats.avgScore)}
          trend={{ pct: avgTrendPercent }}
        />
        <MetricCard
          title="Open risks"
          value={String(stats.openRisks)}
          subtitle={
            stats.mitigatedRisks === 0
              ? 'No completed mitigations'
              : `${stats.mitigatedRisks} mitigated`
          }
        />
        <MetricCard
          title="Open actions"
          value={String(stats.openActions)}
          subtitle={`${stats.overdueActions} overdue action${stats.overdueActions === 1 ? '' : 's'}`}
        />
        <MetricCard title="Open opportunities" value={String(stats.opportunities)} />
      </div>

      <div className="risk-overview-two-col">
        <RiskDistributionCard distribution={distribution} />
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
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.supplier.code} - {r.supplier.name}</span>
                      <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {r.score}
                      </span>
                    </div>
                    <div style={{ height: 8, background: 'var(--color-border-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(r.score / maxTopRiskScore) * 100}%`, height: '100%', background: '#4f46e5', borderRadius: 4, minWidth: r.score > 0 ? 4 : 0, transition: 'width 0.2s ease' }} />
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
          <h2 style={{ marginTop: 0 }}>Risk matrix</h2>
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 840 }}>
              <thead>
                <tr>
                  <th>Likelihood \ Impact</th>
                  {matrixSeverityOrder.map((severity) => (
                    <th key={severity}>{severity}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixLikelihoodOrder.map((likelihood, rowIndex) => (
                  <tr key={likelihood}>
                    <td style={{ whiteSpace: 'nowrap' }}>{likelihood?.replace('Very', 'Very ')}</td>
                    {matrixSeverityOrder.map((severity, colIndex) => {
                      const cellLabel = matrixLabelGrid[rowIndex][colIndex];
                      const cellColor = matrixColorByLabel[cellLabel] ?? '#e5e7eb';
                      const cellKey = `${likelihood}|${severity}`;
                      const cellRisks = riskPinsByCell.get(cellKey) ?? [];
                      const riskCodes = cellRisks.slice(0, 8).map((r) => r.code);
                      const moreSuffix = cellRisks.length > 8 ? ` +${cellRisks.length - 8} more` : '';
                      const hoverText = riskCodes.length > 0 ? `Risks: ${riskCodes.join(', ')}${moreSuffix}` : '';
                      return (
                        <td
                          key={`${likelihood}-${severity}`}
                          style={{ background: cellColor, color: cellLabel === 'High' ? '#ffffff' : '#111827', fontWeight: 700, minWidth: 120, verticalAlign: 'top' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span>{cellLabel}</span>
                            {cellRisks.length > 0 ? (
                              <span
                                title={hoverText}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  borderRadius: 999,
                                  padding: '0.05rem 0.45rem',
                                  background: 'rgba(17, 24, 39, 0.18)',
                                  color: cellLabel === 'High' ? '#ffffff' : '#111827',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                }}
                              >
                                {cellRisks.length}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* <p style={{ marginBottom: 0, marginTop: '0.75rem', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Hover the pins (counts) to see the related risks.
          </p> */}
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
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
              <select className="input" value={newType} onChange={(e) => setNewType(e.target.value as 'risk' | 'opportunity')}>
                <option value="risk">Risk</option>
                <option value="opportunity">Opportunity</option>
              </select>
              <input className="input" placeholder="Description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} required />
              {newType === 'risk' ? (
                <>
                  <select className="input" value={newLikelihood} onChange={(e) => setNewLikelihood(e.target.value as RiskLikelihood)}>
                    <option value="VeryUnlikely">Very Unlikely</option>
                    <option value="Unlikely">Unlikely</option>
                    <option value="Possible">Possible</option>
                    <option value="Likely">Likely</option>
                    <option value="VeryLikely">Very Likely</option>
                  </select>
                  <select className="input" value={newSeverity} onChange={(e) => setNewSeverity(e.target.value as RiskSeverity)}>
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
                {saving ? 'Saving...' : 'Add'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Risks and opportunities</h2>
            <button type="button" className="btn btn-ghost" onClick={handleExportRiskTable} disabled={items.length === 0}>
              Export to Excel
            </button>
          </div>
          <div className="table-wrap">
            {items.length === 0 ? (
              <p className="table-empty">No rows.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
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
                      <td>{row.code}</td>
                      <td>{row.supplier.code} - {row.supplier.name}</td>
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
            <h2 style={{ marginTop: 0 }}>Add action</h2>
            <form onSubmit={createAction} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr 1fr auto', gap: '0.75rem' }}>
              <select className="input" value={newActionSupplierId} onChange={(e) => setNewActionSupplierId(e.target.value)} required>
                <option value="">Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
              <select className="input" value={newActionRiskId} onChange={(e) => setNewActionRiskId(e.target.value)} required>
                <option value="">Related Risk</option>
                {items
                  .filter((i) => i.type === 'risk' && (!newActionSupplierId || i.supplierId === newActionSupplierId))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code}
                    </option>
                  ))}
              </select>
              <input className="input" placeholder="Action description" value={newActionDescription} onChange={(e) => setNewActionDescription(e.target.value)} required />
              <input className="input" placeholder="Owner" value={newActionOwner} onChange={(e) => setNewActionOwner(e.target.value)} />
              <input className="input" type="date" value={newActionDueDate} onChange={(e) => setNewActionDueDate(e.target.value)} />
              <select className="input" value={newActionStatus} onChange={(e) => setNewActionStatus(e.target.value as 'Open' | 'Closed')}>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
              </select>
              {newActionStatus === 'Closed' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <select className="input" value={newResidualLikelihood} onChange={(e) => setNewResidualLikelihood(e.target.value as RiskLikelihood)}>
                    <option value="VeryUnlikely">Very Unlikely</option>
                    <option value="Unlikely">Unlikely</option>
                    <option value="Possible">Possible</option>
                    <option value="Likely">Likely</option>
                    <option value="VeryLikely">Very Likely</option>
                  </select>
                  <select className="input" value={newResidualSeverity} onChange={(e) => setNewResidualSeverity(e.target.value as RiskSeverity)}>
                    <option value="Negligible">Negligible</option>
                    <option value="Minor">Minor</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Significant">Significant</option>
                    <option value="Severe">Severe</option>
                  </select>
                </div>
              ) : (
                <div />
              )}
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Create Action'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Actions table</h2>
          <div className="table-wrap" style={{ marginBottom: '1rem' }}>
            {actions.length === 0 ? (
              <p className="table-empty">No actions yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Risk</th>
                    <th>Description</th>
                    <th>Risk Level</th>
                    <th>Action</th>
                    <th>Owner</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Residual Likelihood</th>
                    <th>Residual Severity</th>
                    <th>Residual Risk Level</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((row) => (
                    <tr key={row.id}>
                      <td>{row.supplier.code} - {row.supplier.name}</td>
                      <td>{row.risk.code}</td>
                      <td>{row.risk.description}</td>
                      <td>{row.risk.riskLevel ?? 'TBD'}</td>
                      <td>{row.description}</td>
                      <td>{row.owner || row.createdBy?.name || row.createdBy?.email || 'Unassigned'}</td>
                      <td>{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—'}</td>
                      <td>{row.status}</td>
                      <td>{row.residualLikelihood ?? '—'}</td>
                      <td>{row.residualSeverity ?? '—'}</td>
                      <td>{row.residualRiskLevel ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

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
                  <select className="input" value={editLikelihood} onChange={(e) => setEditLikelihood(e.target.value as RiskLikelihood)}>
                    <option value="VeryUnlikely">Very Unlikely</option>
                    <option value="Unlikely">Unlikely</option>
                    <option value="Possible">Possible</option>
                    <option value="Likely">Likely</option>
                    <option value="VeryLikely">Very Likely</option>
                  </select>
                  <select className="input" value={editSeverity} onChange={(e) => setEditSeverity(e.target.value as RiskSeverity)}>
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
              <select className="input" value={editStatus} onChange={(e) => setEditStatus(e.target.value as OpportunityRow['status'])}>
                <option value="Open">Open</option>
                <option value="Mitigated">Mitigated</option>
                <option value="Closed">Closed</option>
                <option value="Realized">Realized</option>
              </select>
              <button className="btn btn-primary" type="button" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
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

function MetricCard({
  title,
  value,
  subtitle,
  trend,
}: {
  title: string;
  value: string;
  subtitle?: ReactNode;
  trend?: { pct: number | null };
}) {
  return (
    <div className="card">
      <div className="card-body metric-card-body">
        <div className="metric-card-title">{title}</div>
        <div className="metric-card-value">{value}</div>
        {subtitle != null && subtitle !== '' ? <div className="metric-card-subtitle">{subtitle}</div> : null}
        {trend ? <TrendFooter pct={trend.pct} /> : null}
      </div>
    </div>
  );
}

function TrendSpark({ kind }: { kind: 'up' | 'down' | 'flat' }) {
  const s = 'currentColor';
  if (kind === 'flat') {
    return (
      <svg className="risk-metric-spark" width="22" height="10" viewBox="0 0 22 10" aria-hidden>
        <path d="M2 5h18" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  if (kind === 'up') {
    return (
      <svg className="risk-metric-spark" width="22" height="10" viewBox="0 0 22 10" aria-hidden>
        <path d="M2 8 L11 2 L20 8" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }
  return (
    <svg className="risk-metric-spark" width="22" height="10" viewBox="0 0 22 10" aria-hidden>
      <path d="M2 2 L11 8 L20 2" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Snapshot score change: up = worse (red), down = better (green). */
function TrendFooter({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <div className="risk-metric-trend risk-metric-trend--neutral">
        <TrendSpark kind="flat" />
        <span>— vs previous month</span>
      </div>
    );
  }
  const rounded = Math.round(pct * 100) / 100;
  if (Math.abs(rounded) < 0.005) {
    return (
      <div className="risk-metric-trend risk-metric-trend--neutral">
        <TrendSpark kind="flat" />
        <span>0% vs previous month</span>
      </div>
    );
  }
  const worse = rounded > 0;
  return (
    <div className={`risk-metric-trend ${worse ? 'risk-metric-trend--bad' : 'risk-metric-trend--good'}`}>
      <TrendSpark kind={worse ? 'up' : 'down'} />
      <span>
        {rounded > 0 ? '+' : ''}
        {rounded}% vs previous month
      </span>
    </div>
  );
}
