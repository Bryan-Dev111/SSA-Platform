/**
 * Audits page: table (schedule, results, notes); only assigned Auditor/Admin/QE set result;
 * column with finding #s (clickable → Findings Record). Only Admin can delete.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { downloadWithAuthProgress, parseApiError } from '../utils/apiHelpers';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface Audit {
  id: string;
  code: string;
  supplierId: string;
  supplier: Supplier;
  auditTypeId: string | null;
  auditType: { id: string; code: string; name: string | null } | null;
  auditDate: string;
  auditor: string | null;
  result: 'Passed' | 'Failed' | 'Cancelled' | null;
  summary: string | null;
  scope: string | null;
  notes: string | null;
  derivedStatus: string;
  findingCodes: string[];
  records: Array<{ id: string; name: string; hasFile: boolean }>;
}

/** Format ISO/YYYY-MM-DD date as locale date string without timezone shift */
function formatCalendarDate(isoOrDateStr: string): string {
  const ymd = isoOrDateStr.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return isoOrDateStr;
  return new Date(ymd + 'T12:00:00').toLocaleDateString();
}

/** Slug for audit row CSS by derivedStatus */
function getAuditStatusSlug(status: string): string {
  const s = status.replace(/\s+/g, '-').toLowerCase();
  if (s === 'scheduled') return 'scheduled';
  if (s === 'in-process' || s === 'inprocess') return 'in-process';
  if (s === 'overdue') return 'overdue';
  if (s === 'complete') return 'complete';
  if (s === 'cancelled') return 'cancelled';
  return s || 'unknown';
}

export function Audits() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierFilter = searchParams.get('supplierId') ?? '';
  const [audits, setAudits] = useState<Audit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [summaryModal, setSummaryModal] = useState<{ code: string; summary: string } | null>(null);
  const [downloadingRecord, setDownloadingRecord] = useState<Record<string, boolean>>({});
  /** Pending audit result change — API runs only after Confirm in modal */
  const [resultConfirm, setResultConfirm] = useState<{
    auditId: string;
    result: 'Passed' | 'Failed' | 'Cancelled';
  } | null>(null);
  const [sortBy, setSortBy] = useState<
    'code' | 'supplier' | 'date' | 'type' | 'auditor' | 'status' | 'result' | 'findings' | 'summary' | 'records'
  >('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const roleNames = user?.roleNames ?? [];
  const isAdmin = roleNames.includes('Admin');
  const canCreateFinding = roleNames.some((r) => ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor'].includes(r));
  const canAttachRecord =
    !roleNames.includes('Supplier') &&
    roleNames.some((r) => ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'].includes(r));
  const canSetResultForAudit = (audit: Audit): boolean => {
    if (roleNames.includes('Admin') || roleNames.includes('QualityEngineer') || roleNames.includes('QualityManager')) return true;
    if (!roleNames.includes('Auditor')) return false;
    const target = (audit.auditor ?? '').trim().toLowerCase();
    if (!target) return false;
    const email = (user?.email ?? '').trim().toLowerCase();
    const name = (user?.name ?? '').trim().toLowerCase();
    const emailLocal = email.includes('@') ? email.split('@')[0] : email;
    return target === email || target === name || target === emailLocal;
  };

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(audits.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [audits.length, pageSize, page]);

  const statusRank: Record<string, number> = {
    Scheduled: 1,
    'In Process': 2,
    Overdue: 3,
    Complete: 4,
    Cancelled: 5,
  };
  const resultRank: Record<string, number> = { Passed: 1, Failed: 2, Cancelled: 3, '': 999 };
  const sortedAudits = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const getValue = (a: Audit): string | number => {
      switch (sortBy) {
        case 'code': return a.code;
        case 'supplier': return `${a.supplier.code} ${a.supplier.name}`;
        case 'date': return new Date(a.auditDate).getTime();
        case 'type': return a.auditType?.name ?? '';
        case 'auditor': return a.auditor ?? '';
        case 'status': return statusRank[a.derivedStatus] ?? 999;
        case 'result': return resultRank[a.result ?? ''] ?? 999;
        case 'findings': return a.findingCodes.join(',');
        case 'summary': return a.summary ?? '';
        case 'records': return a.records.length;
      }
    };
    return [...audits].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [audits, sortBy, sortDir]);
  const onSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('asc');
    }
    setPage(1);
  };
  const sortIndicator = (key: typeof sortBy) => (sortBy !== key ? '▲▼' : sortDir === 'asc' ? '↑' : '↓');

  const totalCount = sortedAudits.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageSafe = Math.min(page, totalPages) || 1;
  const paginatedAudits = sortedAudits.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);
  const auditsBySupplier = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const a of audits) {
      const current = map.get(a.supplierId) ?? { label: `${a.supplier.code} — ${a.supplier.name}`, count: 0 };
      current.count += 1;
      map.set(a.supplierId, current);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 12);
  }, [audits]);
  const maxAuditsBySupplier = Math.max(1, ...auditsBySupplier.map((x) => x.count));

  useEffect(() => {
    if (!token) return;
    const q = supplierFilter ? `?supplierId=${encodeURIComponent(supplierFilter)}` : '';
    Promise.all([
      apiJson<Audit[]>(`/audits${q}`, { token }),
      apiJson<Supplier[]>('/suppliers', { token }),
    ])
      .then(([a, s]) => {
        setAudits(a);
        setSuppliers(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, supplierFilter]);

  const refetchAudits = () => {
    if (!token) return;
    const q = supplierFilter ? `?supplierId=${encodeURIComponent(supplierFilter)}` : '';
    apiJson<Audit[]>(`/audits${q}`, { token })
      .then(setAudits)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  };

  const handleDelete = async (auditId: string) => {
    if (!token || !isAdmin) return;
    setDeleteConfirmId(null);
    setDeletingId(auditId);
    try {
      await apiJson(`/audits/${auditId}`, { token, method: 'DELETE' });
      refetchAudits();
      toast.success('Audit deleted');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const applyAuditResult = async (auditId: string, result: 'Passed' | 'Failed' | 'Cancelled') => {
    if (!token) return;
    setUpdatingId(auditId);
    try {
      const updated = await apiJson<Audit>(`/audits/${auditId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ result }),
      });
      setAudits((prev) => prev.map((a) => (a.id === auditId ? updated : a)));
      toast.success(`Audit ${updated.code} marked ${result}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update';
      setError(msg);
      toast.error(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmApplyAuditResult = () => {
    if (!resultConfirm) return;
    const { auditId, result } = resultConfirm;
    setResultConfirm(null);
    void applyAuditResult(auditId, result);
  };

  const downloadRecord = async (recordId: string, recordName: string) => {
    if (!token) return;
    try {
      setDownloadingRecord((prev) => ({ ...prev, [recordId]: true }));
      await downloadWithAuthProgress(`/records/${recordId}/download`, token, recordName, () => {});
      toast.success('Record download completed');
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDownloadingRecord((prev) => {
        const next = { ...prev };
        delete next[recordId];
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Audits</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading audits…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Audits</h1>
      </header>

      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
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
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Audits by supplier</h2>
          {auditsBySupplier.length === 0 ? (
            <p className="table-empty">No audits in scope.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {auditsBySupplier.map((row) => (
                <div key={row.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4, gap: '0.75rem' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
                    <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{row.count}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--color-border-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${(row.count / maxAuditsBySupplier) * 100}%`,
                        height: '100%',
                        background: '#2563eb',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('code')}>Code {sortIndicator('code')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('supplier')}>Supplier {sortIndicator('supplier')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('date')}>Date {sortIndicator('date')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('type')}>Type {sortIndicator('type')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('auditor')}>Auditor {sortIndicator('auditor')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('status')}>Status {sortIndicator('status')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('result')}>Result {sortIndicator('result')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('findings')}>Findings {sortIndicator('findings')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('summary')}>Summary {sortIndicator('summary')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('records')}>Records {sortIndicator('records')}</th>
                {isAdmin && <th>Delete</th>}
              </tr>
            </thead>
            <tbody>
              {audits.length === 0 ? (
                <tr>
                  <td colSpan={10 + (isAdmin ? 1 : 0)} className="table-empty">
                    No audits in scope.
                  </td>
                </tr>
              ) : (
                paginatedAudits.map((a) => (
                  <tr key={a.id} className={`audit-row audit-row--${getAuditStatusSlug(a.derivedStatus)}`}>
                    <td><strong>{a.code}</strong></td>
                    <td>{a.supplier.code} — {a.supplier.name}</td>
                    <td>{formatCalendarDate(a.auditDate)}</td>
                    <td>{a.auditType?.name?.trim() ? a.auditType.name : '—'}</td>
                    <td>{a.auditor?.trim() ? a.auditor : '—'}</td>
                    <td>
                      <span className={`audit-status-badge audit-status-badge--${getAuditStatusSlug(a.derivedStatus)}`}>
                        {a.derivedStatus}
                      </span>
                    </td>
                    <td>
                      {canSetResultForAudit(a) && a.derivedStatus !== 'Cancelled' && a.derivedStatus !== 'Complete' ? (
                        <select
                          className="input"
                          value={
                            resultConfirm?.auditId === a.id ? resultConfirm.result : (a.result ?? '')
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v !== 'Passed' && v !== 'Failed' && v !== 'Cancelled') return;
                            setResultConfirm({ auditId: a.id, result: v });
                          }}
                          disabled={updatingId === a.id}
                          style={{ width: 'auto', minWidth: 100 }}
                        >
                          <option value="">—</option>
                          <option value="Passed">Passed</option>
                          <option value="Failed">Failed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      ) : (
                        a.result ?? '—'
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                        {a.findingCodes.length === 0 ? (
                          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>—</span>
                        ) : (
                          a.findingCodes.map((code) => (
                            <Link
                              key={code}
                              to={`/findings-record?findingId=${encodeURIComponent(code)}`}
                              style={{ display: 'block', marginBottom: 2 }}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {code}
                            </Link>
                          ))
                        )}
                        {canCreateFinding && (
                          <Link
                            to={`/findings/create?auditId=${encodeURIComponent(a.code)}&supplierId=${encodeURIComponent(a.supplierId)}`}
                            className="btn btn-ghost"
                            style={{ fontSize: 'var(--text-sm)', padding: '0.2rem 0.5rem' }}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            + New Finding
                          </Link>
                        )}
                      </div>
                    </td>
                    <td style={{ maxWidth: 280, whiteSpace: 'normal', verticalAlign: 'top' }}>
                      {(a.summary ?? '').length > 120 ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setSummaryModal({ code: a.code, summary: a.summary ?? '' })}
                          style={{
                            padding: 0,
                            textAlign: 'left',
                            lineHeight: 1.35,
                            color: 'inherit',
                            width: '100%',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                          title="Click to view full summary"
                        >
                          {a.summary}
                        </button>
                      ) : (
                        <div style={{ lineHeight: 1.35 }}>{a.summary ?? '—'}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                        {(a.records?.length ?? 0) === 0 ? (
                          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>—</span>
                        ) : (
                          (a.records ?? []).map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              className="btn btn-ghost"
                              style={{
                                display: 'block',
                                padding: 0,
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--color-primary)',
                                textDecoration: 'underline',
                                marginBottom: 2,
                                cursor: r.hasFile ? 'pointer' : 'default',
                              }}
                              disabled={!r.hasFile || Boolean(downloadingRecord[r.id])}
                              onClick={() => r.hasFile && downloadRecord(r.id, r.name)}
                              title={r.hasFile ? 'Download record file' : 'No file attached'}
                            >
                              {downloadingRecord[r.id] ? 'Downloading…' : r.name}
                            </button>
                          ))
                        )}
                        {canAttachRecord && (
                          <Link
                            to={`/records?auditId=${encodeURIComponent(a.id)}&supplierId=${encodeURIComponent(a.supplierId)}`}
                            className="btn btn-ghost"
                            style={{ fontSize: 'var(--text-sm)', padding: '0.2rem 0.5rem' }}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            + Add record
                          </Link>
                        )}
                      </div>
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}
                          onClick={() => setDeleteConfirmId(a.id)}
                          disabled={deletingId !== null}
                          title="Delete audit (Admin only)"
                        >
                          {deletingId === a.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {audits.length > 0 && (
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
        title="Delete audit"
        message="Delete this audit? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <ConfirmDialog
        open={resultConfirm !== null}
        title="Confirm audit result"
        message={
          resultConfirm
            ? `Are you sure you want to mark this audit as "${resultConfirm.result}"?`
            : ''
        }
        confirmLabel="Confirm"
        variant="default"
        onConfirm={confirmApplyAuditResult}
        onCancel={() => setResultConfirm(null)}
      />

      {summaryModal && (
        <div
          className="confirm-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-summary-title"
          onClick={() => setSummaryModal(null)}
        >
          <div className="confirm-dialog" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <h3 id="audit-summary-title" className="confirm-dialog-title">
              Audit Summary - {summaryModal.code}
            </h3>
            <p style={{ marginBottom: '1rem', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{summaryModal.summary}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={() => setSummaryModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
