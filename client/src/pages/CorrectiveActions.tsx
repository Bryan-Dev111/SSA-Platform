/**
 * Corrective Actions page: stats (Open, Overdue, Waiting Approval, AVG Closure Time),
 * table of CARs, supplier filter. Click CAR code → CAR Record.
 * Pagination, Admin-only delete, status-based row colors.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';

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
  createdAt: string;
  updatedAt: string;
}

interface CARsResponse {
  list: CAR[];
  stats: { open: number; overdue: number; waitingApproval: number; avgClosureDays: number };
  defectCodeCounts: { code: string; count: number }[];
  severityCounts: { severity: string; count: number }[];
}

export function CorrectiveActions() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierFilter = searchParams.get('supplierId') ?? '';
  const [data, setData] = useState<CARsResponse | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roleNames = user?.roleNames ?? [];
  const canCreateCAR = roleNames.some((r) => ['Admin', 'QualityEngineer', 'Buyer'].includes(r));
  const isAdmin = roleNames.includes('Admin');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const list = data?.list ?? [];
  const stats = data?.stats ?? { open: 0, overdue: 0, waitingApproval: 0, avgClosureDays: 0 };
  const defectCodeCounts = data?.defectCodeCounts ?? [];
  const severityCounts = data?.severityCounts ?? [
    { severity: 'Critical', count: 0 },
    { severity: 'Major', count: 0 },
    { severity: 'Minor', count: 0 },
  ];
  const maxSeverityCount = Math.max(1, ...severityCounts.map((s) => s.count));
  const statusLabels = ['RCCA', 'WaitingApproval', 'FollowUp', 'Closed'] as const;
  const statusColorMap: Record<(typeof statusLabels)[number], string> = {
    RCCA: '#0ea5e9',
    WaitingApproval: '#f59e0b',
    FollowUp: '#8b5cf6',
    Closed: '#22c55e',
  };
  const statusCounts = statusLabels.map((status) => ({
    status,
    count: list.filter((c) => c.status === status).length,
    color: statusColorMap[status],
  }));
  const totalStatusCount = statusCounts.reduce((sum, s) => sum + s.count, 0);
  const pieSegments = statusCounts.reduce<{ color: string; start: number; end: number; count: number; status: string }[]>(
    (acc, item) => {
      const start = acc.length > 0 ? acc[acc.length - 1].end : 0;
      const pct = totalStatusCount > 0 ? (item.count / totalStatusCount) * 100 : 0;
      const end = start + pct;
      acc.push({ color: item.color, start, end, count: item.count, status: item.status });
      return acc;
    },
    []
  );
  const pieBackground =
    totalStatusCount === 0
      ? 'conic-gradient(#e5e7eb 0deg, #e5e7eb 360deg)'
      : `conic-gradient(${pieSegments
          .map((s) => `${s.color} ${s.start}% ${s.end}%`)
          .join(', ')})`;

  const ageBucketDefs = [
    { label: '0-30 days', min: 0, max: 30 },
    { label: '31-60 days', min: 31, max: 60 },
    { label: '61-90 days', min: 61, max: 90 },
    { label: '90+ days', min: 91, max: Number.POSITIVE_INFINITY },
  ] as const;
  const nowMs = Date.now();
  const ageBuckets = ageBucketDefs.map((bucket) => ({
    label: bucket.label,
    count: list.filter((c) => {
      const createdMs = new Date(c.createdAt).getTime();
      if (Number.isNaN(createdMs)) return false;
      const ageDays = Math.floor((nowMs - createdMs) / (1000 * 60 * 60 * 24));
      return ageDays >= bucket.min && ageDays <= bucket.max;
    }).length,
  }));
  const maxAgeBucketCount = Math.max(1, ...ageBuckets.map((b) => b.count));

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(list.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [list.length, pageSize, page]);

  const totalCount = list.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageSafe = Math.min(page, totalPages) || 1;
  const paginatedList = list.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

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

  const handleDelete = async (carId: string) => {
    if (!token || !isAdmin) return;
    setDeleteConfirmId(null);
    setDeletingId(carId);
    try {
      await apiJson(`/cars/${carId}`, { token, method: 'DELETE' });
      fetchData();
      toast.success('CAR deleted');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

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

      {(defectCodeCounts.length > 0 || list.length > 0) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          {defectCodeCounts.length > 0 && (
            <div className="card">
              <div className="card-body">
                <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: 'var(--text-lg)' }}>Top defect codes (CARs)</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {defectCodeCounts.map(({ code, count }) => (
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
          {list.length > 0 && (
            <div className="card">
              <div className="card-body">
                <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: 'var(--text-lg)' }}>CARs by severity</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {severityCounts.map(({ severity, count }) => (
                    <div key={severity}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4 }}>
                        <span>{severity}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{count}</span>
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
                            width: `${(count / maxSeverityCount) * 100}%`,
                            height: '100%',
                            background:
                              severity === 'Critical'
                                ? '#dc2626'
                                : severity === 'Major'
                                  ? '#ea580c'
                                  : '#ca8a04',
                            borderRadius: 4,
                            minWidth: count > 0 ? 4 : 0,
                            transition: 'width 0.2s ease',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {list.length > 0 && (
            <div className="card">
              <div className="card-body">
                <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: 'var(--text-lg)' }}>CARs by status</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div
                    aria-label="CAR status distribution pie chart"
                    style={{
                      width: 140,
                      height: 140,
                      borderRadius: '50%',
                      background: pieBackground,
                      border: '1px solid var(--color-border)',
                      flex: '0 0 auto',
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 160 }}>
                    {statusCounts.map((s) => (
                      <div key={s.status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', fontSize: 'var(--text-sm)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                          {s.status}
                        </span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {list.length > 0 && (
            <div className="card">
              <div className="card-body">
                <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: 'var(--text-lg)' }}>CAR age distribution</h2>
                <div
                  aria-label="CAR age distribution bar chart"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr',
                    gap: '0.75rem',
                    alignItems: 'stretch',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-muted)',
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                    }}
                  >
                    Number of CARs
                  </div>
                  <div>
                    <div
                      style={{
                        height: 180,
                        borderLeft: '1px solid var(--color-border)',
                        borderBottom: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-around',
                        gap: '0.75rem',
                        padding: '0.5rem 0.5rem 0 0.5rem',
                        background:
                          'linear-gradient(to top, transparent 24%, rgba(148,163,184,0.12) 25%, transparent 26%, transparent 49%, rgba(148,163,184,0.12) 50%, transparent 51%, transparent 74%, rgba(148,163,184,0.12) 75%, transparent 76%)',
                      }}
                    >
                      {ageBuckets.map((bucket) => (
                        <div key={bucket.label} style={{ width: '22%', maxWidth: 80, minWidth: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1 }}>
                            {bucket.count}
                          </span>
                          <div
                            style={{
                              width: '100%',
                              height: `${Math.max(8, (bucket.count / maxAgeBucketCount) * 125)}px`,
                              background: '#4f46e5',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.2s ease',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', gap: '0.75rem', padding: '0.35rem 0.5rem 0 0.5rem' }}>
                      {ageBuckets.map((bucket) => (
                        <span key={`${bucket.label}-axis`} style={{ width: '22%', maxWidth: 80, minWidth: 44, textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          {bucket.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
                <th>Finding</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Summary</th>
                <th>Created</th>
                <th>Updated</th>
                {isAdmin && <th>Delete</th>}
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={9 + (isAdmin ? 1 : 0)} className="table-empty">
                    No CARs in scope (or none past DRAFT yet).
                  </td>
                </tr>
              ) : (
                paginatedList.map((c) => (
                  <tr key={c.id} className={`car-row car-row--${getCarStatusSlug(c.status)}`}>
                    <td>
                      <Link to={`/car-record?id=${encodeURIComponent(c.id)}`} className="finding-code-link">
                        {c.code}
                      </Link>
                    </td>
                    <td>{c.supplier.code} — {c.supplier.name}</td>
                    <td>
                      <Link
                        to={`/audit-record?id=${encodeURIComponent(c.audit.id)}`}
                        className="finding-code-link"
                      >
                        {c.audit.code}
                      </Link>
                    </td>
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
                    <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td>{new Date(c.updatedAt).toLocaleDateString()}</td>
                    {isAdmin && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}
                          onClick={() => setDeleteConfirmId(c.id)}
                          disabled={deletingId !== null}
                          title="Delete CAR (Admin only)"
                        >
                          {deletingId === c.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {list.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', padding: '1rem', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, totalCount)} of {totalCount}
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)' }}>
              Rows per page:
              <select
                className="input"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{ width: 'auto' }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={pageSafe <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span style={{ alignSelf: 'center', fontSize: 'var(--text-sm)' }}>
                Page {pageSafe} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={pageSafe >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete CAR"
        message="Delete this CAR? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
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
