/**
 * Finding modal: create draft + view/edit + workflow (Update draft, Save, Process, Reverse, Approve, Reject).
 * Mirrors Finding Record page behavior on the Findings page (create, status change, edit, update draft, view details by code).
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';

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

export interface FindingModalProps {
  open: boolean;
  onClose: () => void;
  /** null = create new; string = view/edit that finding */
  findingId: string | null;
  onSuccess?: () => void;
}

export function FindingModal({ open, onClose, findingId, onSuccess }: FindingModalProps) {
  const { token, user } = useAuth();
  const toast = useToast();
  const [createdId, setCreatedId] = useState<string | null>(null);
  const viewId = findingId ?? createdId;

  const [finding, setFinding] = useState<Finding | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [audits, setAudits] = useState<AuditOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    supplierId: '',
    auditId: '',
    severity: 'Major' as string,
    summary: '',
    discrepancy: '',
    defectCode: '',
    containment: '',
    occurrenceRootCause: '',
    escapeRootCause: '',
    correctiveAction: '',
    verificationOfEffectiveness: '',
    closingComments: '',
  });
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(false);
  const justCreatedIdRef = useRef<string | null>(null);

  const initialForm = {
    supplierId: '',
    auditId: '',
    severity: 'Major' as string,
    summary: '',
    discrepancy: '',
    defectCode: '',
    containment: '',
    occurrenceRootCause: '',
    escapeRootCause: '',
    correctiveAction: '',
    verificationOfEffectiveness: '',
    closingComments: '',
  };

  const roleNames = user?.roleNames ?? [];
  const canEditDraft = roleNames.some((r) => ['Admin', 'QualityEngineer', 'Auditor'].includes(r));
  const canEdit = finding?.status === 'DRAFT' && canEditDraft;
  const canSave = finding?.status === 'DRAFT' && canEditDraft;
  const canProcess = canEditDraft && finding && finding.status !== 'DRAFT' && finding.status !== 'WaitingApproval' && finding.status !== 'Closed';
  const canReverse = canEditDraft && finding && finding.status !== 'DRAFT' && finding.status !== 'WaitingDisposition' && finding.status !== 'Closed';
  const canApproveReject = finding?.status === 'WaitingApproval' && roleNames.some((r) => ['Admin', 'QualityEngineer'].includes(r));
  const canCreateNew = canEditDraft;

  // Reset when modal opens: create mode (findingId null) = clear all and show empty form; view mode (findingId set) = clear finding so we load that one
  useEffect(() => {
    if (!open) return;
    if (findingId === null) {
      setCreatedId(null);
      setFinding(null);
      setForm(initialForm);
      setError(null);
      justCreatedIdRef.current = null;
    } else {
      justCreatedIdRef.current = null;
      setFinding(null);
    }
  }, [open, findingId]);

  // Load finding when viewId is set. Skip only if we just created this id (keep created finding, no flash). When opening by code (findingId set) we always load fresh.
  useEffect(() => {
    if (!open || !token || !viewId) return;
    if (justCreatedIdRef.current === viewId) {
      justCreatedIdRef.current = null;
      return;
    }
    setLoading(true);
    setError(null);
    apiJson<Finding>(`/findings/${viewId}`, { token })
      .then((f) => {
        setFinding(f);
        setForm({
          supplierId: f.supplierId,
          auditId: f.auditId,
          severity: f.severity,
          summary: f.summary,
          discrepancy: f.discrepancy,
          defectCode: f.defectCode ?? '',
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
  }, [open, token, viewId]);

  // Load suppliers and audits when modal opens (for create or view)
  useEffect(() => {
    if (!open || !token) return;
    apiJson<Supplier[]>('/suppliers', { token }).then(setSuppliers).catch(() => setSuppliers([]));
    apiJson<AuditOption[]>('/audits', { token }).then(setAudits).catch(() => setAudits([]));
  }, [open, token]);

  // When modal closes, clear state so reopening (e.g. by clicking code in table) always loads fresh
  useEffect(() => {
    if (!open) {
      setFinding(null);
      setLoading(false);
      setError(null);
      justCreatedIdRef.current = null;
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const applyFindingToForm = (f: Finding) => {
    setForm({
      supplierId: f.supplierId,
      auditId: f.auditId,
      severity: f.severity,
      summary: f.summary,
      discrepancy: f.discrepancy,
      defectCode: f.defectCode ?? '',
      containment: f.containment ?? '',
      occurrenceRootCause: f.occurrenceRootCause ?? '',
      escapeRootCause: f.escapeRootCause ?? '',
      correctiveAction: f.correctiveAction ?? '',
      verificationOfEffectiveness: f.verificationOfEffectiveness ?? '',
      closingComments: f.closingComments ?? '',
    });
  };

  const handlePatch = async () => {
    if (!token || !finding || finding.status !== 'DRAFT') return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiJson<Finding>(`/findings/${finding.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          severity: form.severity,
          summary: form.summary,
          discrepancy: form.discrepancy,
          defectCode: form.defectCode || null,
          containment: form.containment || null,
          occurrenceRootCause: form.occurrenceRootCause || null,
          escapeRootCause: form.escapeRootCause || null,
          correctiveAction: form.correctiveAction || null,
          verificationOfEffectiveness: form.verificationOfEffectiveness || null,
          closingComments: form.closingComments || null,
        }),
      });
      setFinding(updated);
      applyFindingToForm(updated);
      toast.info('Draft updated');
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!token || !finding) return;
    setActioning(true);
    setError(null);
    try {
      const updated = await apiJson<Finding>(`/findings/${finding.id}/save`, { token, method: 'POST' });
      setFinding(updated);
      applyFindingToForm(updated);
      toast.info('Finding saved');
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed (check required fields)');
    } finally {
      setActioning(false);
    }
  };

  const runAction = async (path: string, label: string) => {
    if (!token || !finding) return;
    setActioning(true);
    setError(null);
    try {
      const updated = await apiJson<Finding>(path, { token, method: 'POST' });
      setFinding(updated);
      applyFindingToForm(updated);
      toast.info(`${label} successful`);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setActioning(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.supplierId || !form.auditId || !form.severity || !form.summary.trim() || !form.discrepancy.trim()) return;
    setSaving(true);
    setError(null);
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
          containment: form.containment.trim() || null,
          occurrenceRootCause: form.occurrenceRootCause.trim() || null,
          escapeRootCause: form.escapeRootCause.trim() || null,
          correctiveAction: form.correctiveAction.trim() || null,
          verificationOfEffectiveness: form.verificationOfEffectiveness.trim() || null,
          closingComments: form.closingComments.trim() || null,
        }),
      });
      justCreatedIdRef.current = created.id;
      setFinding(created);
      setCreatedId(created.id);
      setForm({
        supplierId: created.supplierId,
        auditId: created.auditId,
        severity: created.severity,
        summary: created.summary,
        discrepancy: created.discrepancy,
        defectCode: created.defectCode ?? '',
        containment: created.containment ?? '',
        occurrenceRootCause: created.occurrenceRootCause ?? '',
        escapeRootCause: created.escapeRootCause ?? '',
        correctiveAction: created.correctiveAction ?? '',
        verificationOfEffectiveness: created.verificationOfEffectiveness ?? '',
        closingComments: created.closingComments ?? '',
      });
      toast.success('Finding created');
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const isCreateMode = !viewId;

  return (
    <div className="finding-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="finding-modal-title">
      <div className="finding-modal" onClick={(e) => e.stopPropagation()}>
        <div className="finding-modal-header">
          <h2 id="finding-modal-title" className="finding-modal-title">
            {isCreateMode ? 'New Finding' : finding ? `${finding.code} — Finding` : 'Finding'}
          </h2>
          <p className="finding-modal-subtitle">
            {isCreateMode ? 'Create a draft finding (Admin, QE, or Auditor).' : finding ? `Status: ${finding.status}` : ''}
          </p>
        </div>

        <div className="finding-modal-body">
          {error && (
            <div className="alert-error" role="alert" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {isCreateMode && !finding && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-body">
                {!canCreateNew ? (
                  <>
                    <p>Only Admin, Quality Engineer, or Auditor can create findings.</p>
                    <button type="button" className="btn btn-ghost" onClick={onClose} style={{ marginTop: '1rem' }}>Cancel</button>
                  </>
                ) : (
                  <form onSubmit={handleCreate}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
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
                        <select className="input" value={form.severity} onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}>
                          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
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
                    <div className="input-group">
                      <label className="input-label">Defect Code</label>
                      <input className="input" value={form.defectCode} onChange={(e) => setForm((p) => ({ ...p, defectCode: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving' : 'Save'}</button>
                      <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {viewId && loading && (
            <div className="loading-message">
              <div className="loading-spinner" />
              <p style={{ marginTop: 12 }}>Loading…</p>
            </div>
          )}

          {viewId && finding && !loading && (
            <>
              <div className="card" style={{ marginBottom: '1rem' }}>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    <div className="input-group">
                      <label className="input-label">Supplier</label>
                      <input className="input" value={finding.supplier?.code ?? ''} readOnly disabled />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Audit #</label>
                      <input className="input" value={finding.audit?.code ?? ''} readOnly disabled />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Severity</label>
                      <select className="input" value={form.severity} onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))} disabled={!canEdit}>
                        {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Summary</label>
                    <input className="input" value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} disabled={!canEdit} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Defect Code</label>
                    <input className="input" value={form.defectCode} onChange={(e) => setForm((p) => ({ ...p, defectCode: e.target.value }))} disabled={!canEdit} />
                  </div>
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

                  <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {canEdit && (
                      <button type="button" className="btn btn-ghost" onClick={handlePatch} disabled={saving}>{saving ? 'Saving…' : 'Update draft'}</button>
                    )}
                    {canSave && (
                      <button type="button" className="btn btn-primary" onClick={handleSave} disabled={actioning}>{actioning ? 'Saving…' : 'Save (DRAFT → Waiting Disposition)'}</button>
                    )}
                    {canProcess && (
                      <button type="button" className="btn btn-primary" onClick={() => runAction(`/findings/${finding.id}/process`, 'Process')} disabled={actioning}>Process</button>
                    )}
                    {canReverse && (
                      <button type="button" className="btn btn-ghost" onClick={() => runAction(`/findings/${finding.id}/reverse`, 'Reverse')} disabled={actioning}>Reverse</button>
                    )}
                    {canApproveReject && (
                      <>
                        <button type="button" className="btn btn-primary" onClick={() => runAction(`/findings/${finding.id}/approve`, 'Approve')} disabled={actioning}>Approve</button>
                        <button type="button" className="btn btn-ghost" onClick={() => runAction(`/findings/${finding.id}/reject`, 'Reject')} disabled={actioning}>Reject</button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-body">
                  <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: 'var(--text-base)' }}>Status history</h3>
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
        </div>

        {!isCreateMode && (
          <div className="finding-modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
