/**
 * Findings Record: form (Supplier, Audit #, Severity, Summary, Defect Code, Discrepancy,
 * Containment, Occurrence/Escape Root Cause, Corrective Action, VOE, Closing Comments);
 * approval/status history; workflow buttons Save, Process, Reverse, Approve, Reject.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link, Navigate } from 'react-router-dom';
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
  auditId: string;
  supplierId: string;
  supplier: Supplier;
  audit: Audit;
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
}

const SEVERITIES = ['Critical', 'Major', 'Minor'] as const;

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
    defectCode: '',
    dispositionCode: '',
    containment: '',
    occurrenceRootCause: '',
    escapeRootCause: '',
    correctiveAction: '',
    verificationOfEffectiveness: '',
    closingComments: '',
  });
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [defectCodeOptions, setDefectCodeOptions] = useState<ReferenceCodeOption[]>([]);
  const [dispositionCodeOptions, setDispositionCodeOptions] = useState<ReferenceCodeOption[]>([]);
  const roleNames = user?.roleNames ?? [];
  const canEditDraft = roleNames.some((r) => ['Admin', 'QualityEngineer', 'Auditor'].includes(r));
  const canEdit = finding?.status === 'DRAFT' && canEditDraft;
  const canSave = finding?.status === 'DRAFT' && canEditDraft;
  const canProcess = canEditDraft && !!finding && finding.status !== 'DRAFT' && finding.status !== 'WaitingApproval' && finding.status !== 'Closed';
  const canReverse = canEditDraft && !!finding && finding.status !== 'DRAFT' && finding.status !== 'WaitingDisposition' && finding.status !== 'Closed';
  const canApproveReject = finding?.status === 'WaitingApproval' && roleNames.some((r) => ['Admin', 'QualityEngineer'].includes(r));
  // Requirement: Admin, QE, Auditor can initiate and edit; Viewer/Buyer read-only (open existing from list only).
  const canCreateNew = canEditDraft;

  useEffect(() => {
    if (!token) return;
    if (!idParam && !codeParam) {
      setLoading(false);
      apiJson<Supplier[]>('/suppliers', { token }).then(setSuppliers).catch(() => setSuppliers([]));
      return;
    }
    const url = idParam ? `/findings/${idParam}` : `/findings/by-code/${encodeURIComponent(codeParam!)}`;
    apiJson<Finding>(url, { token })
      .then((f) => {
        setFinding(f);
        setForm({
          supplierId: f.supplierId,
          auditId: f.auditId,
          severity: f.severity,
          summary: f.summary,
          discrepancy: f.discrepancy,
          defectCode: f.defectCode ?? '',
          dispositionCode: f.dispositionCode ?? '',
          containment: f.containment ?? '',
          occurrenceRootCause: f.occurrenceRootCause ?? '',
          escapeRootCause: f.escapeRootCause ?? '',
          correctiveAction: f.correctiveAction ?? '',
          verificationOfEffectiveness: f.verificationOfEffectiveness ?? '',
          closingComments: f.closingComments ?? '',
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));

    apiJson<Supplier[]>('/suppliers', { token }).then(setSuppliers).catch(() => {});
  }, [token, idParam, codeParam]);

  useEffect(() => {
    if (!token) return;
    apiJson<AuditOption[]>('/audits', { token })
      .then((list) => setAudits(list))
      .catch(() => setAudits([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    apiJson<{ list: ReferenceCodeOption[] }>('/defect-codes', { token })
      .then((r) => setDefectCodeOptions(r.list))
      .catch(() => setDefectCodeOptions([]));
    apiJson<{ list: ReferenceCodeOption[] }>('/disposition-codes', { token })
      .then((r) => setDispositionCodeOptions(r.list))
      .catch(() => setDispositionCodeOptions([]));
  }, [token]);

  const handlePatch = async () => {
    if (!token || !finding || finding.status !== 'DRAFT') return;
    setSaving(true);
    try {
      const updated = await apiJson<Finding>(`/findings/${finding.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          severity: form.severity,
          summary: form.summary,
          discrepancy: form.discrepancy,
          defectCode: form.defectCode || null,
          dispositionCode: form.dispositionCode || null,
          containment: form.containment || null,
          occurrenceRootCause: form.occurrenceRootCause || null,
          escapeRootCause: form.escapeRootCause || null,
          correctiveAction: form.correctiveAction || null,
          verificationOfEffectiveness: form.verificationOfEffectiveness || null,
          closingComments: form.closingComments || null,
        }),
      });
      setFinding(updated);
      setError(null);
      toast.info('Draft updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!token || !finding) return;
    setActioning(true);
    try {
      const updated = await apiJson<Finding>(`/findings/${finding.id}/save`, { token, method: 'POST' });
      setFinding(updated);
      setError(null);
      toast.info('Finding saved');
      // Ensure the record is addressable and reloadable after save/refresh.
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
    if (!token || !form.supplierId || !form.auditId || !form.severity || !form.summary.trim() || !form.discrepancy.trim()) return;
    setSaving(true);
    try {
      const created = await apiJson<Finding>('/findings', {
        token,
        method: 'POST',
        body: JSON.stringify({
          supplierId: form.supplierId,
          auditId: form.auditId,
          severity: form.severity,
          summary: form.summary.trim(),
          discrepancy: form.discrepancy.trim(),
          defectCode: form.defectCode.trim() || null,
          dispositionCode: form.dispositionCode.trim() || null,
          containment: form.containment.trim() || null,
          occurrenceRootCause: form.occurrenceRootCause.trim() || null,
          escapeRootCause: form.escapeRootCause.trim() || null,
          correctiveAction: form.correctiveAction.trim() || null,
          verificationOfEffectiveness: form.verificationOfEffectiveness.trim() || null,
          closingComments: form.closingComments.trim() || null,
        }),
      });
      setFinding(created);
      setForm((p) => ({
        ...p,
        summary: '',
        discrepancy: '',
        defectCode: '',
        dispositionCode: '',
        containment: '',
        occurrenceRootCause: '',
        escapeRootCause: '',
        correctiveAction: '',
        verificationOfEffectiveness: '',
        closingComments: '',
      }));
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

  const isNew = !finding && !idParam && !codeParam;

  // Viewer/Buyer are read-only: do not show the "New finding" create form (redirect to list)
  if (!loading && isNew && !canCreateNew) {
    return <Navigate to="/findings" replace />;
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">
          {finding ? `${finding.code} — Finding` : isNew ? 'New Finding' : 'Findings Record'}
        </h1>
        <p className="page-description">
          {finding ? `Status: ${finding.status}` : isNew ? 'Create a draft finding (Admin, QE, or Auditor).' : 'Finding not found.'}
        </p>
        <p style={{ marginTop: 4 }}>
          <Link to="/findings" style={{ textDecoration: 'none' }}>← Back to Findings</Link>
        </p>
      </header>

      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      {isNew && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Create draft finding</h2>
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
                  <label className="input-label">Audit *</label>
                  <select
                    className="input"
                    value={form.auditId}
                    onChange={(e) => setForm((p) => ({ ...p, auditId: e.target.value }))}
                    required
                  >
                    <option value="">Select</option>
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
                <input className="input" value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} required />
              </div>
              <div className="input-group">
                <label className="input-label">Discrepancy *</label>
                <textarea className="input" rows={2} value={form.discrepancy} onChange={(e) => setForm((p) => ({ ...p, discrepancy: e.target.value }))} required />
              </div>
              <ReferenceCodeSelect
                label="Defect Code"
                value={form.defectCode}
                onChange={(v) => setForm((p) => ({ ...p, defectCode: v }))}
                options={defectCodeOptions}
              />
              <ReferenceCodeSelect
                label="Disposition Code"
                value={form.dispositionCode}
                onChange={(v) => setForm((p) => ({ ...p, dispositionCode: v }))}
                options={dispositionCodeOptions}
              />
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </form>
          </div>
        </div>
      )}

      {finding && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Supplier</label>
                  <input className="input" value={finding.supplier?.code ?? ''} readOnly disabled />
                </div>
                <div className="input-group">
                  <label className="input-label">Audit #</label>
                  <Link to="/audits" className="finding-code-link" style={{ display: 'inline-block', marginTop: 4 }}>
                    {finding.audit?.code ?? ''}
                  </Link>
                </div>
                <div className="input-group">
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
              </div>
              <div className="input-group">
                <label className="input-label">Summary</label>
                <input className="input" value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} disabled={!canEdit} />
              </div>
              <ReferenceCodeSelect
                label="Defect Code"
                value={form.defectCode}
                onChange={(v) => setForm((p) => ({ ...p, defectCode: v }))}
                options={defectCodeOptions}
                disabled={!canEdit}
              />
              <ReferenceCodeSelect
                label="Disposition Code"
                value={form.dispositionCode}
                onChange={(v) => setForm((p) => ({ ...p, dispositionCode: v }))}
                options={dispositionCodeOptions}
                disabled={!canEdit}
              />
              <div className="input-group">
                <label className="input-label">Discrepancy</label>
                <textarea className="input" rows={2} value={form.discrepancy} onChange={(e) => setForm((p) => ({ ...p, discrepancy: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="input-group">
                <label className="input-label">Containment</label>
                <textarea className="input" rows={2} value={form.containment} onChange={(e) => setForm((p) => ({ ...p, containment: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="input-group">
                <label className="input-label">Occurrence Root Cause</label>
                <textarea className="input" rows={2} value={form.occurrenceRootCause} onChange={(e) => setForm((p) => ({ ...p, occurrenceRootCause: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="input-group">
                <label className="input-label">Escape Root Cause</label>
                <textarea className="input" rows={2} value={form.escapeRootCause} onChange={(e) => setForm((p) => ({ ...p, escapeRootCause: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="input-group">
                <label className="input-label">Corrective Action</label>
                <textarea className="input" rows={2} value={form.correctiveAction} onChange={(e) => setForm((p) => ({ ...p, correctiveAction: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="input-group">
                <label className="input-label">Verification of Effectiveness</label>
                <textarea className="input" rows={2} value={form.verificationOfEffectiveness} onChange={(e) => setForm((p) => ({ ...p, verificationOfEffectiveness: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="input-group">
                <label className="input-label">Closing Comments</label>
                <textarea className="input" rows={2} value={form.closingComments} onChange={(e) => setForm((p) => ({ ...p, closingComments: e.target.value }))} disabled={!canEdit} />
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {canEdit && (
                  <button type="button" className="btn btn-ghost" onClick={handlePatch} disabled={saving}>
                    {saving ? 'Saving…' : 'Update draft'}
                  </button>
                )}
                {canSave && (
                  <button type="button" className="btn btn-primary" onClick={handleSave} disabled={actioning}>
                    {actioning ? 'Saving…' : 'Save (DRAFT → Waiting Disposition)'}
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
          </div>

          <div className="card">
            <div className="card-body">
              <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--text-lg)' }}>Status history</h2>
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
                    <td>{finding.status}</td>
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
