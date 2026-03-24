/**
 * Findings page: stats, chart, table, supplier filter.
 * "New finding" and opening a finding navigate to Findings Record page (no sidebar tab for Record).
 */
import { useEffect, useMemo, useState } from 'react';
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

interface Finding {
  id: string;
  code: string;
  supplierId: string;
  supplier: Supplier;
  audit: { id: string; code: string; auditDate: string } | null;
  status: string;
  severity: string;
  summary: string;
  discrepancy: string;
  defectCode: string | null;
  createdAt: string;
  updatedAt: string;
  correctiveActions?: { id: string; code: string; status: string }[];
}

function formatFindingCreatedAt(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

interface FindingsResponse {
  list: Finding[];
  stats?: {
    totalAll?: number;
    openAll?: number;
    criticalMajor?: number;
    totalCriticalMajor?: number;
    openCriticalMajor?: number;
  };
  defectCodeCounts: { code: string; count: number }[];
}

export function Findings() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierFilter = searchParams.get('supplierId') ?? '';
  const [data, setData] = useState<FindingsResponse | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const roleNames = user?.roleNames ?? [];
  const canCreateFinding = roleNames.some((r) => ['Admin', 'QualityEngineer', 'Auditor'].includes(r));
  /** Admin, QE, Buyer can create CARs (matches server POST /cars). */
  const canCreateCar = roleNames.some((r) => ['Admin', 'QualityEngineer', 'Buyer'].includes(r));
  const isAdmin = roleNames.includes('Admin');

  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<
    'code' | 'supplier' | 'createdAt' | 'audit' | 'severity' | 'status' | 'summary' | 'defectCode'
  >('code');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const list = data?.list ?? [];
  const statsFromApi = data?.stats;
  const stats = {
    totalAll:
      statsFromApi?.totalAll ??
      list.length,
    openAll:
      statsFromApi?.openAll ??
      list.filter((f) => f.status !== 'Closed').length,
    criticalMajor:
      statsFromApi?.criticalMajor ??
      statsFromApi?.totalCriticalMajor ??
      list.filter((f) => f.severity === 'Critical' || f.severity === 'Major').length,
  };
  const defectCodeCounts = data?.defectCodeCounts ?? [];
  const topDefectCodes = defectCodeCounts.slice(0, 10);
  const maxDefectCount = Math.max(1, ...defectCodeCounts.map((d) => d.count));

  const fetchData = () => {
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
  };

  useEffect(() => {
    if (!token) return;
    const isRefreshingList = refreshKey > 0;
    if (!isRefreshingList) setLoading(true);
    fetchData();
  }, [token, supplierFilter, refreshKey]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(list.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [list.length, pageSize, page]);

  const severityRank: Record<string, number> = { Critical: 3, Major: 2, Minor: 1 };
  const statusRank: Record<string, number> = { New: 1, DRAFT: 2, WaitingDisposition: 3, WaitingApproval: 4, Closed: 5 };
  const sortedList = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const getValue = (f: Finding): string | number => {
      switch (sortBy) {
        case 'code': return f.code;
        case 'supplier': return `${f.supplier.code} ${f.supplier.name}`;
        case 'createdAt':
          return f.createdAt ? new Date(f.createdAt).getTime() : 0;
        case 'audit': return f.audit?.code ?? '';
        case 'severity': return severityRank[f.severity] ?? 0;
        case 'status': return statusRank[f.status] ?? 999;
        case 'summary': return f.summary;
        case 'defectCode': return f.defectCode ?? '';
      }
    };
    return [...list].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [list, sortBy, sortDir]);
  const onSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('asc');
    }
    setPage(1);
  };
  const sortIndicator = (key: typeof sortBy) => (sortBy !== key ? '▲▼' : sortDir === 'asc' ? '↑' : '↓');

  const totalCount = sortedList.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageSafe = Math.min(page, totalPages) || 1;
  const paginatedList = sortedList.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const handleDelete = async (findingId: string) => {
    if (!token || !isAdmin) return;
    setDeleteConfirmId(null);
    setDeletingId(findingId);
    try {
      await apiJson(`/findings/${findingId}`, { token, method: 'DELETE' });
      setRefreshKey((k) => k + 1);
      toast.warning('Finding deleted');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  /** Maps API status to a slug for status-badge CSS (readable, color-coded). */
  const getStatusBadgeSlug = (status: string) => {
    const s = status.replace(/\s+/g, '-').toLowerCase();
    if (s === 'new' || s === 'draft') return 'new';
    if (s === 'waitingdisposition') return 'waiting-disposition';
    if (s === 'waitingapproval') return 'waiting-approval';
    if (s === 'closed') return 'closed';
    return s || 'unknown';
  };

  if (loading && data === null) {
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

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Findings</h1>
        <p className="page-description">
          Findings (past New). Use the finding code to open the record for status workflow. Supplier filter for Buyers.
        </p>
      </header>

      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        {canCreateFinding && (
          <Link to="/findings-record" className="btn btn-primary">
            FINDING RECORDS
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
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Total (All)</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stats.totalAll}</div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Open (All)</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stats.openAll}</div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Critical/Major</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stats.criticalMajor}</div>
        </div>
      </div>

      {defectCodeCounts.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: 'var(--text-lg)' }}>Top defect codes</h2>
            <div
              aria-label="Top defect codes bar chart"
              style={{
                minHeight: 210,
                borderLeft: '1px solid var(--color-border)',
                borderBottom: '1px solid var(--color-border)',
                display: 'grid',
                gridTemplateColumns: `repeat(${topDefectCodes.length}, minmax(0, 1fr))`,
                alignItems: 'flex-end',
                gap: '0.75rem',
                padding: '0.5rem 0.5rem 0 0.5rem',
                background:
                  'linear-gradient(to top, transparent 24%, rgba(148,163,184,0.12) 25%, transparent 26%, transparent 49%, rgba(148,163,184,0.12) 50%, transparent 51%, transparent 74%, rgba(148,163,184,0.12) 75%, transparent 76%)',
              }}
            >
              {topDefectCodes.map(({ code, count }) => (
                <div key={code} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1 }}>
                    {count}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      height: `${Math.max(8, (count / maxDefectCount) * 140)}px`,
                      background: '#4f46e5',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.2s ease',
                    }}
                    title={`${code}: ${count}`}
                  />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                    {code}
                  </span>
                </div>
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
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('code')}>Code {sortIndicator('code')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('supplier')}>Supplier {sortIndicator('supplier')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('audit')}>Audit {sortIndicator('audit')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('severity')}>Severity {sortIndicator('severity')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('status')}>Status {sortIndicator('status')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('summary')}>Summary {sortIndicator('summary')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('defectCode')}>Defect Code {sortIndicator('defectCode')}</th>
                <th>CAR</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('createdAt')}>Date created {sortIndicator('createdAt')}</th>
                {isAdmin && <th>Delete</th>}
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={9 + (isAdmin ? 1 : 0)} className="table-empty">
                    No findings in scope (or none past New yet).
                  </td>
                </tr>
              ) : (
                paginatedList.map((f) => (
                  <tr key={f.id} className={`finding-row finding-row--${getStatusBadgeSlug(f.status)}`}>
                    <td>
                      <Link
                        to={`/findings-record?id=${encodeURIComponent(f.id)}`}
                        className="finding-code-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {f.code}
                      </Link>
                    </td>
                    <td>{f.supplier.code} — {f.supplier.name}</td>
                    <td>{f.audit?.code ?? 'None'}</td>
                    <td>{f.severity}</td>
                    <td>
                      <span className={`findings-status-badge findings-status-badge--${getStatusBadgeSlug(f.status)}`}>
                        {f.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.summary}>
                      {f.summary}
                    </td>
                    <td>{f.defectCode?.trim() ? f.defectCode : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                        {(f.correctiveActions ?? []).length === 0 ? (
                          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>—</span>
                        ) : (
                          (f.correctiveActions ?? []).map((c) => (
                            <Link
                              key={c.id}
                              to={`/car-record?id=${encodeURIComponent(c.id)}`}
                              className="finding-code-link"
                              style={{ fontSize: 'var(--text-sm)' }}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {c.code}
                              <span style={{ color: 'var(--color-text-muted)', marginLeft: 4 }}>({c.status})</span>
                            </Link>
                          ))
                        )}
                        {canCreateCar && (
                          <Link
                            to={`/car-record?findingId=${encodeURIComponent(f.id)}`}
                            className="btn btn-ghost"
                            style={{ fontSize: 'var(--text-sm)', padding: '0.2rem 0.5rem' }}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            + New CAR
                          </Link>
                        )}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 'var(--text-sm)' }} title={f.createdAt}>
                      {formatFindingCreatedAt(f.createdAt)}
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}
                          onClick={() => setDeleteConfirmId(f.id)}
                          disabled={deletingId !== null}
                          title="Delete finding (Admin only)"
                        >
                          {deletingId === f.id ? 'Deleting…' : 'Delete'}
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
        title="Delete finding"
        message="Delete this finding? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
