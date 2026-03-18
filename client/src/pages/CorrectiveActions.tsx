/**
 * Corrective Actions page: stats (Open, Overdue, Waiting Approval, AVG Closure Time),
 * table of CARs, supplier filter. Click CAR code → CAR Record.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiJson } from '../api/client';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface CAR {
  id: string;
  code: string;
  supplierId: string;
  supplier: Supplier;
  audit: { id: string; code: string; auditDate: string };
  finding: { id: string; code: string };
  status: string;
  severity: string;
  summary: string;
  carOwner: string | null;
  targetCompletionDate: string | null;
  updatedAt: string;
}

interface CARsResponse {
  list: CAR[];
  stats: { open: number; overdue: number; waitingApproval: number; avgClosureDays: number };
}

export function CorrectiveActions() {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierFilter = searchParams.get('supplierId') ?? '';
  const [data, setData] = useState<CARsResponse | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roleNames = user?.roleNames ?? [];
  const canCreateCAR = roleNames.some((r) => ['Admin', 'QualityEngineer', 'Buyer'].includes(r));
  const list = data?.list ?? [];
  const stats = data?.stats ?? { open: 0, overdue: 0, waitingApproval: 0, avgClosureDays: 0 };

  const fetchData = () => {
    if (!token) return;
    const q = supplierFilter ? `?supplierId=${encodeURIComponent(supplierFilter)}` : '';
    Promise.all([
      apiJson<CARsResponse>(`/cars${q}`, { token }),
      apiJson<Supplier[]>('/suppliers', { token }),
    ])
      .then(([d, s]) => {
        setData(d);
        setSuppliers(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchData();
  }, [token, supplierFilter]);

  if (loading && data === null) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Corrective Actions</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Corrective Actions</h1>
        <p className="page-description">CARs (RCCA and beyond). Supplier filter for Buyers.</p>
      </header>

      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        {canCreateCAR && (
          <Link to="/car-record" className="btn btn-primary">
            New CAR
          </Link>
        )}
        <label>
          <span style={{ marginRight: 8, fontSize: 'var(--text-sm)' }}>Supplier filter:</span>
          <select
            className="input"
            value={supplierFilter}
            onChange={(e) => {
              const v = e.target.value;
              if (v) setSearchParams({ supplierId: v });
              else setSearchParams({});
            }}
            style={{ width: 'auto', minWidth: 180 }}
          >
            <option value="">All</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Open CARs</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stats.open}</div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Overdue</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stats.overdue}</div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Waiting Approval</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stats.waitingApproval}</div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>AVG Closure (days)</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stats.avgClosureDays}</div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Supplier</th>
                <th>Audit</th>
                <th>Finding</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Summary</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-empty">
                    No CARs in scope (or none past DRAFT yet).
                  </td>
                </tr>
              ) : (
                list.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/car-record?id=${encodeURIComponent(c.id)}`} className="finding-code-link">
                        {c.code}
                      </Link>
                    </td>
                    <td>{c.supplier.code} — {c.supplier.name}</td>
                    <td>{c.audit.code}</td>
                    <td>
                      <Link to={`/findings-record?findingId=${encodeURIComponent(c.finding.code)}`} className="finding-code-link" style={{ fontSize: 'var(--text-sm)' }}>
                        {c.finding.code}
                      </Link>
                    </td>
                    <td>{c.severity}</td>
                    <td>
                      <span className={`finding-status-badge finding-status-badge--${getCarStatusSlug(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.summary}>
                      {c.summary}
                    </td>
                    <td>{new Date(c.updatedAt).toLocaleDateString()}</td>
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

function getCarStatusSlug(status: string): string {
  const s = status.replace(/\s+/g, '-').toLowerCase();
  if (s === 'draft') return 'draft';
  if (s === 'rcca') return 'waiting-disposition';
  if (s === 'waitingapproval') return 'waiting-approval';
  if (s === 'followup') return 'follow-up';
  if (s === 'closed') return 'closed';
  return s || 'unknown';
}
