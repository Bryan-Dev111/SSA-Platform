/**
 * Findings Record: identify issue (Summary, Discrepancy, Disposition after create, Closing Comments).
 * Header layout aligned with CAR record; workflow Save / Process / Reverse / Approve / Reject.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { ReferenceCodeSelect, type ReferenceCodeOption } from '../components/ReferenceCodeSelect';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface Audit {
  id: string;
  code: string;
  auditDate: string;
}

interface AuditOption extends Audit {
  supplierId: string;
}

interface Finding {
  id: string;
  code: string;
  auditId: string | null;
  supplierId: string;
  supplier: Supplier;
  audit: Audit | null;
  status: string;
  severity: string;
  summary: string;
  discrepancy: string;
  defectCode: string | null;
  dispositionCode: string | null;
  containment: string | null;
  occurrenceRootCause: string | null;
  escapeRootCause: string | null;
  correctiveAction: string | null;
  verificationOfEffectiveness: string | null;
  closingComments: string | null;
  createdAt: string;
  updatedAt: string;
  correctiveActions?: { id: string; code: string; status: string }[];
}

const SEVERITIES = ['Critical', 'Major', 'Minor'] as const;

/** Human-readable labels for Prisma enum-style status strings */
function formatFindingStatus(status: string): string {
  if (status === 'New' || status === 'DRAFT') return 'New';
  if (status === 'WaitingDisposition') return 'Waiting Disposition';
  if (status === 'WaitingApproval') return 'Waiting Approval';
  return status;
}

function isFindingNotFoundErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase().replace(/\s+/g, '');
  return (
    normalized.includes('findingnotfound') ||
    normalized.includes('"error":"findingnotfound"') ||
    normalized.includes("{\"error\":\"findingnotfound\"}")
  );
}

function formStateFromFinding(f: Finding) {
  return {
    supplierId: f.supplierId,
    auditId: f.auditId ?? '',
    severity: f.severity,
    summary: f.summary,
    discrepancy: f.discrepancy,
    dispositionCode: f.dispositionCode ?? '',
    closingComments: f.closingComments ?? '',
  };
}

export function FindingsRecord() {
  const { token, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idParam = searchParams.get('id');
  const codeParam = searchParams.get('findingId');
  const [finding, setFinding] = useState<Finding | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [audits, setAudits] = useState<AuditOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    supplierId: '',
    auditId: '',
    severity: 'Major' as string,
    summary: '',
    discrepancy: '',
    dispositionCode: '',
    closingComments: '',
  });
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [findingQuery, setFindingQuery] = useState(codeParam ?? '');
  const [searching, setSearching] = useState(false);
  const [searchMissNoCreate, setSearchMissNoCreate] = useState(false);
  const activeLoadIdRef = useRef(0);
  const [dispositionCodeOptions, setDispositionCodeOptions] = useState<ReferenceCodeOption[]>([]);
  const roleNames = user?.roleNames ?? [];
  const canEditDraft = roleNames.some((r) => ['Admin', 'QualityEngineer', 'Auditor'].includes(r));
  const isEditableFindingStatus =
    !!finding && ['New', 'DRAFT', 'WaitingDisposition'].includes(finding.status);
  const canEdit = isEditableFindingStatus && canEditDraft;
  const canSave = canEdit;
  const canProcess = canEditDraft && !!finding && (finding.status === 'New' || finding.status === 'DRAFT' || finding.status === 'WaitingDisposition');
  const canReverse = canEditDraft && !!finding && finding.status !== 'New' && finding.status !== 'DRAFT' && finding.status !== 'WaitingDisposition' && finding.status !== 'Closed';
  const canApproveReject = finding?.status === 'WaitingApproval' && roleNames.some((r) => ['Admin', 'QualityEngineer'].includes(r));
  // Requirement: Admin, QE, Auditor can initiate and edit; Viewer/Buyer read-only (open existing from list only).
  const canCreateNew = canEditDraft;

  const resetCreateForm = () => {
    setForm({
      supplierId: '',
      auditId: '',
      severity: 'Major',
      summary: '',
      discrepancy: '',
      dispositionCode: '',
      closingComments: '',
    });
  };

  const fetchFindingByQuery = async (queryRaw: string) => {
    const query = queryRaw.trim();
    if (!query) throw new Error('Enter a Finding id or code to search.');
    const tryById = async (): Promise<Finding | null> => {
      try {
        return await apiJson<Finding>(`/findings/${encodeURIComponent(query)}`, { token: token! });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isFindingNotFoundErrorMessage(message)) return null;
        throw err;
      }
    };
    const tryByCode = async (): Promise<Finding | null> =>
      apiJson<Finding | null>(`/findings/by-code/${encodeURIComponent(query.toUpperCase())}`, { token: token! });

    const looksLikeFindingCode = /^fin[-\s]?\d+/i.test(query);
    if (looksLikeFindingCode) {
      const byCode = await tryByCode();
      if (byCode) return byCode;
      const byId = await tryById();
      if (byId) return byId;
      throw new Error('Finding not found');
    }
    const byId = await tryById();
    if (byId) return byId;
    const byCode = await tryByCode();
    if (byCode) return byCode;
    throw new Error('Finding not found');
  };

  useEffect(() => {
    setFindingQuery(codeParam ?? '');
  }, [codeParam]);

  useEffect(() => {
    if (!token) return;
    const loadId = ++activeLoadIdRef.current;
    const isActive = () => activeLoadIdRef.current === loadId;
    if (!idParam && !codeParam) {
      setLoading(false);
      setError(null);
      setFinding(null);
      setSearchMissNoCreate(false);
      apiJson<Supplier[]>('/suppliers', { token }).then((rows) => { if (isActive()) setSuppliers(rows); }).catch(() => { if (isActive()) setSuppliers([]); });
      return;
    }
    setLoading(true);
    setError(null);
    setSearchMissNoCreate(false);
    const loadFinding = async () => (idParam ? apiJson<Finding>(`/findings/${encodeURIComponent(idParam.trim())}`, { token }) : fetchFindingByQuery(codeParam ?? ''));
    loadFinding()
      .then((f) => {
        if (!isActive()) return;
        setFinding(f);
        setForm(formStateFromFinding(f));
      })
      .catch((e) => {
        if (!isActive()) return;
        setFinding(null);
        const message = e instanceof Error ? e.message : 'Failed to load';
        const isNotFound = isFindingNotFoundErrorMessage(message);
        setError(isNotFound ? null : message);
        setSearchMissNoCreate(isNotFound);
      })
      .finally(() => {
        if (isActive()) setLoading(false);
      });

    apiJson<Supplier[]>('/suppliers', { token }).then((rows) => { if (isActive()) setSuppliers(rows); }).catch(() => {});
  }, [token, idParam, codeParam]);

  useEffect(() => {
    if (!token) return;
    apiJson<AuditOption[]>('/audits', { token })
      .then((list) => setAudits(list))
      .catch(() => setAudits([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    apiJson<{ list: ReferenceCodeOption[] }>('/disposition-codes', { token })
      .then((r) => setDispositionCodeOptions(r.list))
      .catch(() => setDispositionCodeOptions([]));
  }, [token]);

  const handleSave = async () => {
    if (!token || !finding) return;
    setActioning(true);
    try {
      const patched = await apiJson<Finding>(`/findings/${finding.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          severity: form.severity,
          summary: form.summary,
          discrepancy: form.discrepancy,
          dispositionCode: form.dispositionCode.trim() || null,
          closingComments: form.closingComments.trim() || null,
        }),
      });
      /** POST /save only applies to New/DRAFT (assigns FIN code). WaitingDisposition etc. use PATCH only. */
      const updated =
        finding.status === 'New' || finding.status === 'DRAFT'
          ? await apiJson<Finding>(`/findings/${finding.id}/save`, { token, method: 'POST' })
          : patched;
      setFinding(updated);
      setForm(formStateFromFinding(updated));
      setError(null);
      toast.info('Finding saved');
      navigate(`/findings-record?id=${encodeURIComponent(updated.id)}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed (check required fields)');
    } finally {
      setActioning(false);
    }
  };

  const handleProcess = async () => {
    if (!token || !finding) return;
    setActioning(true);
    try {
      const updated = await apiJson<Finding>(`/findings/${finding.id}/process`, { token, method: 'POST' });
      setFinding(updated);
      setForm(formStateFromFinding(updated));
      setError(null);
      toast.info('Process successful');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Process failed');
    } finally {
      setActioning(false);
    }
  };

  const handleReverse = async () => {
    if (!token || !finding) return;
    setActioning(true);
    try {
      const updated = await apiJson<Finding>(`/findings/${finding.id}/reverse`, { token, method: 'POST' });
      setFinding(updated);
      setForm(formStateFromFinding(updated));
      setError(null);
      toast.info('Reverse successful');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reverse failed');
    } finally {
      setActioning(false);
    }
  };

  const handleApprove = async () => {
    if (!token || !finding) return;
    setActioning(true);
    try {
      const updated = await apiJson<Finding>(`/findings/${finding.id}/approve`, { token, method: 'POST' });
      setFinding(updated);
      setForm(formStateFromFinding(updated));
      setError(null);
      toast.info('Approved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setActioning(false);
    }
  };

  const handleReject = async () => {
    if (!token || !finding) return;
    setActioning(true);
    try {
      const updated = await apiJson<Finding>(`/findings/${finding.id}/reject`, { token, method: 'POST' });
      setFinding(updated);
      setForm(formStateFromFinding(updated));
      setError(null);
      toast.info('Rejected');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setActioning(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.supplierId || !form.severity || !form.summary.trim() || !form.discrepancy.trim()) return;
    setSaving(true);
    try {
      const created = await apiJson<Finding>('/findings', {
        token,
        method: 'POST',
        body: JSON.stringify({
          supplierId: form.supplierId,
          auditId: form.auditId || null,
          severity: form.severity,
          summary: form.summary.trim(),
          discrepancy: form.discrepancy.trim(),
        }),
      });
      setFinding(created);
      setForm(formStateFromFinding(created));
      setError(null);
      toast.success('Finding created');
      // Move to a stable URL so refresh/navigation keeps showing the saved record.
      navigate(`/findings-record?id=${encodeURIComponent(created.id)}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = findingQuery.trim();
    if (!q) {
      toast.info('Enter a Finding id or code to search.');
      return;
    }
    if (!token) return;
    const loadId = ++activeLoadIdRef.current;
    const isActive = () => activeLoadIdRef.current === loadId;
    setSearching(true);
    setError(null);
    setSearchMissNoCreate(false);
    try {
      const found = await fetchFindingByQuery(q);
      if (!isActive()) return;
      setFinding(found);
      setForm(formStateFromFinding(found));
    } catch (err) {
      if (!isActive()) return;
      setFinding(null);
      const message = err instanceof Error ? err.message : 'Failed to load';
      const isNotFound = isFindingNotFoundErrorMessage(message);
      setError(isNotFound ? null : message);
      setSearchMissNoCreate(isNotFound);
    } finally {
      if (isActive()) setSearching(false);
    }
  };

  const handleStartCreateFinding = () => {
    setFinding(null);
    setError(null);
    setSearching(false);
    setSearchMissNoCreate(false);
    setFindingQuery('');
    resetCreateForm();
    navigate('/findings-record');
  };

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Findings Record</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading…</p>
        </div>
      </div>
    );
  }

  const isNew = !finding && !idParam && !codeParam && !searchMissNoCreate;

  // Viewer/Buyer are read-only: do not show the "New finding" create form (redirect to list)
  if (!loading && isNew && !canCreateNew) {
    return <Navigate to="/findings" replace />;
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">
          {finding ? `${finding.code} — Finding` : 'Finding Record'}
        </h1>
        <p className="page-description">
          {finding
            ? `Status: ${formatFindingStatus(finding.status)}`
            : isNew
              ? 'Create a new finding (Admin, QE, or Auditor).'
              : 'Finding not found.'}
        </p>
        <p style={{ marginTop: 4 }}>
          <Link to="/findings" style={{ textDecoration: 'none' }}>← Back to Findings</Link>
        </p>
        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap', flex: '1 1 auto' }}>
            <input
              className="input"
              value={findingQuery}
              onChange={(e) => setFindingQuery(e.target.value)}
              placeholder="Search by Finding id or code"
              style={{ width: 320, minWidth: 320, maxWidth: 320 }}
            />
            <button type="submit" className="btn btn-ghost" disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </button>
            {canCreateNew && (
              <button type="button" className="btn btn-primary" onClick={handleStartCreateFinding}>
                Create Finding
              </button>
            )}
          </form>
        </div>
      </header>

      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      {isNew && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Create finding</h2>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Supplier *</label>
                  <select
                    className="input"
                    value={form.supplierId}
                    onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value, auditId: '' }))}
                    required
                  >
                    <option value="">Select</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Audit</label>
                  <select
                    className="input"
                    value={form.auditId}
                    onChange={(e) => setForm((p) => ({ ...p, auditId: e.target.value }))}
                  >
                    <option value="">None / N/A</option>
                    {audits.filter((a) => a.supplierId === form.supplierId).map((a) => (
                      <option key={a.id} value={a.id}>{a.code}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Severity *</label>
                  <select
                    className="input"
                    value={form.severity}
                    onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Summary *</label>
                <p style={{ margin: '0 0 0.35rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Brief description of the issue</p>
                <input className="input" value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} required />
              </div>
              <div className="input-group">
                <label className="input-label">Discrepancy *</label>
                <p style={{ margin: '0 0 0.35rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>What went wrong</p>
                <textarea className="input" rows={2} value={form.discrepancy} onChange={(e) => setForm((p) => ({ ...p, discrepancy: e.target.value }))} required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </form>
          </div>
        </div>
      )}

      {finding && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: '0.75rem 1rem',
                  alignItems: 'flex-end',
                }}
              >
                <div className="input-group" style={{ marginBottom: 0, flex: '0 1 8.5rem', minWidth: '7rem' }}>
                  <label className="input-label">Finding #</label>
                  <input className="input" value={finding.code} readOnly disabled />
                </div>
                <div className="input-group" style={{ marginBottom: 0, flex: '1 1 12rem', minWidth: '10rem' }}>
                  <label className="input-label">Supplier</label>
                  <input
                    className="input"
                    value={finding.supplier ? `${finding.supplier.code} — ${finding.supplier.name}` : ''}
                    readOnly
                    disabled
                    title={finding.supplier ? `${finding.supplier.code} — ${finding.supplier.name}` : undefined}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0, flex: '0 1 7rem', minWidth: '6rem' }}>
                  <label className="input-label">Audit #</label>
                  {finding.audit?.code ? (
                    <Link to="/audits" className="finding-code-link" style={{ display: 'inline-block', marginTop: 4 }}>
                      {finding.audit.code}
                    </Link>
                  ) : (
                    <span style={{ display: 'inline-block', marginTop: 4, color: 'var(--color-text-muted)' }}>None</span>
                  )}
                </div>
                <div className="input-group" style={{ marginBottom: 0, flex: '0 1 8rem', minWidth: '7rem' }}>
                  <label className="input-label">Severity</label>
                  <select
                    className="input"
                    value={form.severity}
                    onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
                    disabled={!canEdit}
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    alignItems: 'center',
                    flex: '0 0 auto',
                    marginLeft: 'auto',
                  }}
                >
                  {canSave && (
                    <button type="button" className="btn btn-primary" onClick={handleSave} disabled={actioning}>
                      {actioning ? 'Saving…' : 'Save'}
                    </button>
                  )}
                  {canProcess && (
                    <button type="button" className="btn btn-primary" onClick={handleProcess} disabled={actioning}>
                      Process
                    </button>
                  )}
                  {canReverse && (
                    <button type="button" className="btn btn-ghost" onClick={handleReverse} disabled={actioning}>
                      Reverse
                    </button>
                  )}
                  {canApproveReject && (
                    <>
                      <button type="button" className="btn btn-primary" onClick={handleApprove} disabled={actioning}>
                        Approve
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={handleReject} disabled={actioning}>
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="input-group" style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-border, #e5e7eb)' }}>
                <label className="input-label">Summary</label>
                <p style={{ margin: '0 0 0.35rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Brief description of the issue</p>
                <input className="input" value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="input-group">
                <label className="input-label">Discrepancy</label>
                <p style={{ margin: '0 0 0.35rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>What went wrong</p>
                <textarea className="input" rows={2} value={form.discrepancy} onChange={(e) => setForm((p) => ({ ...p, discrepancy: e.target.value }))} disabled={!canEdit} />
              </div>
              <p style={{ margin: '0 0 0.35rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Decision or action taken</p>
              <ReferenceCodeSelect
                label="Disposition"
                value={form.dispositionCode}
                onChange={(v) => setForm((p) => ({ ...p, dispositionCode: v }))}
                options={dispositionCodeOptions}
                disabled={!canEdit}
              />
              <div className="input-group">
                <label className="input-label">Closing Comments</label>
                <textarea className="input" rows={2} value={form.closingComments} onChange={(e) => setForm((p) => ({ ...p, closingComments: e.target.value }))} disabled={!canEdit} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--text-lg)' }}>Record snapshot</h2>
              <p style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                Current status and timestamps (full approval history can be added in a later iteration).
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{formatFindingStatus(finding.status)}</td>
                    <td>{new Date(finding.createdAt).toLocaleString()}</td>
                    <td>{new Date(finding.updatedAt).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!finding && !isNew && (
        <div className="placeholder-empty">
          <strong>Finding not found</strong>
          Use a valid id or code from the Findings list or Audits page.
        </div>
      )}
    </div>
  );
}
