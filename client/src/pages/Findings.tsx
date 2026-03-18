/**
 * Findings page: stats, chart, table, supplier filter.
 * "New finding" and opening a finding from the list use a modal (no redirect to Finding Record).
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { FindingModal } from '../components/FindingModal';
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
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierFilter = searchParams.get('supplierId') ?? '';
  const [data, setData] = useState<FindingsResponse | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const roleNames = user?.roleNames ?? [];
  const canCreateFinding = roleNames.some((r) => ['Admin', 'QualityEngineer', 'Auditor'].includes(r));
  const canChangeStatus = canCreateFinding; // Admin, QE, Auditor can Process/Reverse; Approve/Reject is Admin, QE only (handled per action)
  const canApproveReject = roleNames.some((r) => ['Admin', 'QualityEngineer'].includes(r));
  const isAdmin = roleNames.includes('Admin');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalFindingId, setModalFindingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const list = data?.list ?? [];
  const stats = data?.stats ?? { totalCriticalMajor: 0, openCriticalMajor: 0, waitingApproval: 0 };
  const defectCodeCounts = data?.defectCodeCounts ?? [];

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

  const totalCount = list.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageSafe = Math.min(page, totalPages) || 1;
  const paginatedList = list.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const runStatusAction = async (findingId: string, action: 'save' | 'process' | 'reverse' | 'approve' | 'reject') => {
    if (!token) return;
    setActioningId(findingId);
    try {
      const path = action === 'save' ? `/findings/${findingId}/save` : `/findings/${findingId}/${action}`;
      await apiJson(path, { token, method: 'POST' });
      setRefreshKey((k) => k + 1);
      toast.success('Status updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : `Action failed`);
    } finally {
      setActioningId(null);
    }
  };

  const handleStatusChange = (findingId: string, _findingStatus: string, value: string) => {
    if (!value) return;
    if (value === 'process') runStatusAction(findingId, 'process');
    else if (value === 'reverse') runStatusAction(findingId, 'reverse');
    else if (value === 'approve') runStatusAction(findingId, 'approve');
    else if (value === 'reject') runStatusAction(findingId, 'reject');
  };

  const handleDelete = async (findingId: string) => {
    if (!token || !isAdmin) return;
    setDeleteConfirmId(null);
    setDeletingId(findingId);
    try {
      await apiJson(`/findings/${findingId}`, { token, method: 'DELETE' });
      setRefreshKey((k) => k + 1);
      toast.success('Finding deleted');
      if (modalFindingId === findingId) {
        setModalOpen(false);
        setModalFindingId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  /** Maps API status to a slug for status-badge CSS (readable, color-coded). */
  const getStatusBadgeSlug = (status: string) => {
    const s = status.replace(/\s+/g, '-').toLowerCase();
    if (s === 'draft') return 'draft';
    if (s === 'waitingdisposition') return 'waiting-disposition';
    if (s === 'waitingapproval') return 'waiting-approval';
    if (s === 'closed') return 'closed';
    return s || 'unknown';
  };

  const getStatusOptions = (status: string) => {
    const opts: { value: string; label: string }[] = [{ value: '', label: status }];
    if (!canChangeStatus) return opts;
    if (status === 'WaitingDisposition') {
      opts.push({ value: 'process', label: '→ Process' });
    }
    if (status === 'WaitingApproval') {
      if (canApproveReject) {
        opts.push({ value: 'approve', label: '→ Approve' });
        opts.push({ value: 'reject', label: '→ Reject' });
      }
      opts.push({ value: 'reverse', label: '→ Reverse' });
    }
    return opts;
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
        <p className="page-description">Findings (Waiting Disposition and beyond). Supplier filter for Buyers.</p>
      </header>

      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        {canCreateFinding && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setModalFindingId(null);
              setModalOpen(true);
            }}
          >
            New finding
          </button>
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
                <th>Change status</th>
                {isAdmin && <th>Delete</th>}
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="table-empty">
                    No findings in scope (or none past DRAFT yet).
                  </td>
                </tr>
              ) : (
                paginatedList.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <button
                        type="button"
                        className="finding-code-link"
                        onClick={() => {
                          setModalFindingId(f.id);
                          setModalOpen(true);
                        }}
                      >
                        {f.code}
                      </button>
                    </td>
                    <td>{f.supplier.code} — {f.supplier.name}</td>
                    <td>{f.audit.code}</td>
                    <td>{f.severity}</td>
                    <td>
                      <span className={`finding-status-badge finding-status-badge--${getStatusBadgeSlug(f.status)}`}>
                        {f.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.summary}>
                      {f.summary}
                    </td>
                    <td>{new Date(f.updatedAt).toLocaleDateString()}</td>
                    <td>
                      <select
                        className="input"
                        value=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) handleStatusChange(f.id, f.status, v);
                          e.target.value = '';
                        }}
                        disabled={actioningId !== null}
                        style={{ minWidth: 120, fontSize: 'var(--text-sm)' }}
                        title="Change status"
                      >
                        {getStatusOptions(f.status).map((o) => (
                          <option key={o.value || 'current'} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      {actioningId === f.id && <span style={{ marginLeft: 4, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>…</span>}
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

      <FindingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        findingId={modalFindingId}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
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
