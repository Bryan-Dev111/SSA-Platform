/**
 * Audits page: table (schedule, results, notes); only Admin/QE set result;
 * column with finding #s (clickable → Findings Record). Only Admin can delete.
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

interface AuditType {
  id: string;
  code: string;
  name: string | null;
}

interface Audit {
  id: string;
  code: string;
  supplierId: string;
  supplier: Supplier;
  auditTypeId: string | null;
  auditType: AuditType | null;
  auditDate: string;
  auditor: string | null;
  result: 'Passed' | 'Failed' | 'Cancelled' | null;
  notes: string | null;
  derivedStatus: string;
  findingCodes: string[];
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
  const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newAudit, setNewAudit] = useState({ supplierId: '', auditDate: '', auditTypeId: '', auditor: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** Pending audit result change — API runs only after Confirm in modal */
  const [resultConfirm, setResultConfirm] = useState<{
    auditId: string;
    result: 'Passed' | 'Failed' | 'Cancelled';
  } | null>(null);
  const roleNames = user?.roleNames ?? [];
  const isAdmin = roleNames.includes('Admin');
  const canSetResult = roleNames.includes('Admin') || roleNames.includes('QualityEngineer');
  const canCreateAudit = roleNames.includes('Admin') || roleNames.includes('QualityEngineer');

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(audits.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [audits.length, pageSize, page]);

  const totalCount = audits.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageSafe = Math.min(page, totalPages) || 1;
  const paginatedAudits = audits.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  useEffect(() => {
    if (!token) return;
    const q = supplierFilter ? `?supplierId=${encodeURIComponent(supplierFilter)}` : '';
    Promise.all([
      apiJson<Audit[]>(`/audits${q}`, { token }),
      apiJson<Supplier[]>('/suppliers', { token }),
      apiJson<AuditType[]>('/audits/types', { token }),
    ])
      .then(([a, s, t]) => {
        setAudits(a);
        setSuppliers(s);
        setAuditTypes(t);
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

  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newAudit.supplierId || !newAudit.auditDate) return;
    setSubmitting(true);
    try {
      const created = await apiJson<Audit>('/audits', {
        token,
        method: 'POST',
        body: JSON.stringify({
          supplierId: newAudit.supplierId,
          auditDate: newAudit.auditDate,
          auditTypeId: newAudit.auditTypeId || null,
          auditor: newAudit.auditor || null,
          notes: newAudit.notes || null,
        }),
      });
      setAudits((prev) => [created, ...prev]);
      setNewAudit({ supplierId: '', auditDate: '', auditTypeId: '', auditor: '', notes: '' });
      setShowNewForm(false);
      toast.success(`Audit ${created.code} created`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create audit';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
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
        <p className="page-description">
          Schedule and results. Set result (Passed/Failed/Cancelled) as Admin or Quality Engineer — confirmation required before
          saving.
        </p>
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
        {canCreateAudit && (
          <button type="button" className="btn btn-primary" onClick={() => setShowNewForm(!showNewForm)}>
            {showNewForm ? 'Cancel' : 'New audit'}
          </button>
        )}
      </div>

      {showNewForm && canCreateAudit && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: 'var(--text-lg)' }}>Schedule new audit</h2>
            <form onSubmit={handleCreateAudit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Supplier *</label>
                  <select
                    className="input"
                    value={newAudit.supplierId}
                    onChange={(e) => setNewAudit((p) => ({ ...p, supplierId: e.target.value }))}
                    required
                  >
                    <option value="">Select</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Audit date *</label>
                  <input
                    type="date"
                    className="input"
                    value={newAudit.auditDate}
                    onChange={(e) => setNewAudit((p) => ({ ...p, auditDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Audit type</label>
                  <select
                    className="input"
                    value={newAudit.auditTypeId}
                    onChange={(e) => setNewAudit((p) => ({ ...p, auditTypeId: e.target.value }))}
                  >
                    <option value="">—</option>
                    {auditTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.code} {t.name ? `— ${t.name}` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">Auditor</label>
                <input
                  type="text"
                  className="input"
                  value={newAudit.auditor}
                  onChange={(e) => setNewAudit((p) => ({ ...p, auditor: e.target.value }))}
                  placeholder="e.g. Brian"
                />
              </div>
              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">Notes</label>
                <input
                  type="text"
                  className="input"
                  value={newAudit.notes}
                  onChange={(e) => setNewAudit((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Save'}
              </button>
            </form>
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
                <th>Date</th>
                <th>Type</th>
                <th>Auditor</th>
                <th>Status</th>
                <th>Result</th>
                <th>Notes</th>
                <th>Findings</th>
                {isAdmin && <th>Delete</th>}
              </tr>
            </thead>
            <tbody>
              {audits.length === 0 ? (
                <tr>
                  <td colSpan={9 + (isAdmin ? 1 : 0)} className="table-empty">
                    No audits in scope.
                  </td>
                </tr>
              ) : (
                paginatedAudits.map((a) => (
                  <tr key={a.id} className={`audit-row audit-row--${getAuditStatusSlug(a.derivedStatus)}`}>
                    <td><strong>{a.code}</strong></td>
                    <td>{a.supplier.code} — {a.supplier.name}</td>
                    <td>{formatCalendarDate(a.auditDate)}</td>
                    <td>{a.auditType ? `${a.auditType.code}${a.auditType.name ? ` ${a.auditType.name}` : ''}` : '—'}</td>
                    <td>{a.auditor?.trim() ? a.auditor : '—'}</td>
                    <td>
                      <span className={`audit-status-badge audit-status-badge--${getAuditStatusSlug(a.derivedStatus)}`}>
                        {a.derivedStatus}
                      </span>
                    </td>
                    <td>
                      {canSetResult && a.derivedStatus !== 'Cancelled' && a.derivedStatus !== 'Complete' ? (
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
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.notes ?? ''}>
                      {a.notes ?? '—'}
                    </td>
                    <td>
                      {a.findingCodes.length === 0
                        ? '—'
                        : a.findingCodes.map((code) => (
                            <Link
                              key={code}
                              to={`/findings-record?findingId=${encodeURIComponent(code)}`}
                              style={{ display: 'block', marginBottom: 2 }}
                            >
                              {code}
                            </Link>
                          ))}
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
    </div>
  );
}
