/**
 * Findings page: stats (total Critical/Major, open, Waiting Approval),
 * chart (top defect codes), table, supplier filter.
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

interface Finding {
  id: string;
  code: string;
  supplierId: string;
  supplier: Supplier;
  audit: { id: string; code: string; auditDate: string };
  status: string;
  severity: string;
  summary: string;
  discrepancy: string;
  defectCode: string | null;
  updatedAt: string;
}

interface FindingsResponse {
  list: Finding[];
  stats: { totalCriticalMajor: number; openCriticalMajor: number; waitingApproval: number };
  defectCodeCounts: { code: string; count: number }[];
}

export function Findings() {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierFilter = searchParams.get('supplierId') ?? '';
  const [data, setData] = useState<FindingsResponse | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const roleNames = user?.roleNames ?? [];
  const canCreateFinding = roleNames.some((r) => ['Admin', 'QualityEngineer', 'Auditor'].includes(r));

  useEffect(() => {
    if (!token) return;
    const q = supplierFilter ? `?supplierId=${encodeURIComponent(supplierFilter)}` : '';
    Promise.all([
      apiJson<FindingsResponse>(`/findings${q}`, { token }),
      apiJson<Supplier[]>('/suppliers', { token }),
    ])
      .then(([d, s]) => {
        setData(d);
        setSuppliers(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, supplierFilter]);

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Findings</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading findings…</p>
        </div>
      </div>
    );
  }

  const list = data?.list ?? [];
  const stats = data?.stats ?? { totalCriticalMajor: 0, openCriticalMajor: 0, waitingApproval: 0 };
  const defectCodeCounts = data?.defectCodeCounts ?? [];

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Findings</h1>
        <p className="page-description">Findings (Waiting Disposition and beyond). Supplier filter for Buyers.</p>
      </header>

      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        {canCreateFinding && (
          <Link to="/findings-record" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            New finding
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
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Total (Critical/Major)</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stats.totalCriticalMajor}</div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Open (Critical/Major)</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stats.openCriticalMajor}</div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Waiting Approval</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stats.waitingApproval}</div>
        </div>
      </div>

      {defectCodeCounts.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: 'var(--text-lg)' }}>Top defect codes</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {defectCodeCounts.slice(0, 10).map(({ code, count }) => (
                <span
                  key={code}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: 'var(--color-border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  {code}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Supplier</th>
                <th>Audit</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Summary</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No findings in scope (or none past DRAFT yet).
                  </td>
                </tr>
              ) : (
                list.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link to={`/findings-record?id=${f.id}`}>{f.code}</Link>
                    </td>
                    <td>{f.supplier.code} — {f.supplier.name}</td>
                    <td>{f.audit.code}</td>
                    <td>{f.severity}</td>
                    <td>{f.status}</td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.summary}>
                      {f.summary}
                    </td>
                    <td>{new Date(f.updatedAt).toLocaleDateString()}</td>
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
