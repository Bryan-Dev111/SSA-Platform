/**
 * CAR Record: form (Supplier, Audit #, Finding #, Severity, CAR Owner, Target Completion Date,
 * Summary, Defect Code, Discrepancy, Containment, Occurrence/Escape Root Cause, Corrective Action,
 * VOE, Closing Comments); status history; workflow Save (DRAFT → RCCA), Process, Reverse, Approve, Reject.
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

interface AuditOption {
  id: string;
  code: string;
  auditDate: string;
  supplierId: string;
}

interface FindingOption {
  id: string;
  code: string;
  auditId: string;
  supplierId: string;
  severity: string;
}

interface CAR {
  id: string;
  code: string;
  findingId: string | null;
  auditId: string;
  supplierId: string;
  supplier: Supplier;
  audit: { id: string; code: string; auditDate: string };
  finding: { id: string; code: string; severity: string } | null;
  status: string;
  severity: string;
  carOwner: string | null;
  targetCompletionDate: string | null;
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
  approvalLogs?: Array<{
    id: string;
    action: 'Approved' | 'Rejected' | string;
    comment: string | null;
    createdAt: string;
    user: { id: string; name: string | null; email: string | null } | null;
  }>;
}

interface StatusHistoryEntry {
  id: string;
  status: string;
  note: string;
  at: string;
}

const SEVERITIES = ['Critical', 'Major', 'Minor'] as const;

function buildCarStatusHistory(car: CAR): StatusHistoryEntry[] {
  const approvalEvents = (car.approvalLogs ?? [])
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((log) => {
      const actor = log.user?.name || log.user?.email || 'Unknown';
      const normalizedAction = log.action.trim().toLowerCase();
      const statusFromAction = normalizedAction === 'approved' ? 'FollowUp' : normalizedAction === 'rejected' ? 'RCCA' : car.status;
      const commentPart = log.comment?.trim() ? ` Comment: ${log.comment.trim()}` : '';
      return {
        id: `approval-${log.id}`,
        status: statusFromAction,
        note: `${log.action} by ${actor}.${commentPart}`.trim(),
        at: log.createdAt,
      } satisfies StatusHistoryEntry;
    });

  const seed: StatusHistoryEntry[] = [
    {
      id: `created-${car.id}`,
      status: 'DRAFT',
      note: 'CAR created.',
      at: car.createdAt,
    },
    ...approvalEvents,
  ];

  const latest = seed[seed.length - 1];
  if (!latest || latest.status !== car.status) {
    seed.push({
      id: `current-${car.id}`,
      status: car.status,
      note: 'Latest status.',
      at: car.updatedAt,
    });
  }

  return seed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function CARRecord() {
  const { token, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idParam = searchParams.get('id');
  const codeParam = searchParams.get('carId');
  const findingIdFromUrl = searchParams.get('findingId');
  const [car, setCar] = useState<CAR | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [findings, setFindings] = useState<FindingOption[]>([]);
  const [audits, setAudits] = useState<AuditOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    findingId: '',
    auditId: '',
    supplierId: '',
    severity: 'Major' as string,
    carOwner: '',
    targetCompletionDate: '',
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
  const [editMode, setEditMode] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [defectCodeOptions, setDefectCodeOptions] = useState<ReferenceCodeOption[]>([]);
  const roleNames = user?.roleNames ?? [];
  const canEditDraft = roleNames.some((r) => ['Admin', 'QualityEngineer', 'Buyer'].includes(r));
  const canEdit = !!car && editMode && canEditDraft && car.status === 'DRAFT';
  const canSave = car?.status === 'DRAFT' && canEditDraft;
  const canProcess = canEditDraft && !!car && car.status !== 'DRAFT' && car.status !== 'WaitingApproval' && car.status !== 'Closed';
  const canReverse = canEditDraft && !!car && car.status !== 'DRAFT' && car.status !== 'RCCA' && car.status !== 'Closed';
  const canApproveReject = car?.status === 'WaitingApproval' && roleNames.some((r) => ['Admin', 'QualityEngineer', 'Buyer'].includes(r));
  const canCreateNew = canEditDraft;
  const statusHistory = car ? buildCarStatusHistory(car) : [];

  const syncFormFromCar = (c: CAR) => {
    setForm((p) => ({
      ...p,
      findingId: c.findingId ?? '',
      auditId: c.auditId,
      supplierId: c.supplierId,
      severity: c.severity,
      carOwner: c.carOwner ?? '',
      targetCompletionDate: c.targetCompletionDate ? c.targetCompletionDate.slice(0, 10) : '',
      summary: c.summary,
      discrepancy: c.discrepancy,
      defectCode: c.defectCode ?? '',
      containment: c.containment ?? '',
      occurrenceRootCause: c.occurrenceRootCause ?? '',
      escapeRootCause: c.escapeRootCause ?? '',
      correctiveAction: c.correctiveAction ?? '',
      verificationOfEffectiveness: c.verificationOfEffectiveness ?? '',
      closingComments: c.closingComments ?? '',
    }));
  };

  useEffect(() => {
    if (!token) return;
    if (!idParam && !codeParam) {
      setLoading(false);
      apiJson<Supplier[]>('/suppliers', { token }).then(setSuppliers).catch(() => setSuppliers([]));
      apiJson<{ list: Array<{ id: string; code: string; auditId: string; supplierId: string; severity: string }> }>('/findings', { token })
        .then((r) => setFindings(r.list.map((f) => ({ id: f.id, code: f.code, auditId: f.auditId, supplierId: f.supplierId, severity: f.severity }))))
        .catch(() => setFindings([]));
      apiJson<AuditOption[]>('/audits', { token }).then(setAudits).catch(() => setAudits([]));
      return;
    }
    const url = idParam ? `/cars/${idParam}` : `/cars/by-code/${encodeURIComponent(codeParam!)}`;
    apiJson<CAR>(url, { token })
      .then((c) => {
        setCar(c);
        setForm({
          findingId: c.findingId ?? '',
          auditId: c.auditId,
          supplierId: c.supplierId,
          severity: c.severity,
          carOwner: c.carOwner ?? '',
          targetCompletionDate: c.targetCompletionDate ? c.targetCompletionDate.slice(0, 10) : '',
          summary: c.summary,
          discrepancy: c.discrepancy,
          defectCode: c.defectCode ?? '',
          containment: c.containment ?? '',
          occurrenceRootCause: c.occurrenceRootCause ?? '',
          escapeRootCause: c.escapeRootCause ?? '',
          correctiveAction: c.correctiveAction ?? '',
          verificationOfEffectiveness: c.verificationOfEffectiveness ?? '',
          closingComments: c.closingComments ?? '',
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));

    apiJson<Supplier[]>('/suppliers', { token }).then(setSuppliers).catch(() => setSuppliers([]));
    apiJson<{ list: unknown[] }>('/findings', { token }).then((r) => setFindings(r.list as FindingOption[])).catch(() => setFindings([]));
    apiJson<AuditOption[]>('/audits', { token }).then(setAudits).catch(() => setAudits([]));
  }, [token, idParam, codeParam]);

  useEffect(() => {
    if (!token) return;
    apiJson<{ list: ReferenceCodeOption[] }>('/defect-codes', { token })
      .then((r) => setDefectCodeOptions(r.list))
      .catch(() => setDefectCodeOptions([]));
  }, [token]);

  /** Deep-link from Findings / Findings Record: prefill Finding # (works for DRAFT findings not on GET /findings list). */
  useEffect(() => {
    if (!token || idParam || codeParam || !findingIdFromUrl) return;
    apiJson<{ id: string; code: string; auditId: string; supplierId: string; severity: string }>(
      `/findings/${findingIdFromUrl}`,
      { token }
    )
      .then((f) => {
        setForm((p) => ({
          ...p,
          findingId: f.id,
          auditId: f.auditId,
          supplierId: f.supplierId,
          severity: f.severity,
        }));
        setFindings((prev) =>
          prev.some((x) => x.id === f.id)
            ? prev
            : [...prev, { id: f.id, code: f.code, auditId: f.auditId, supplierId: f.supplierId, severity: f.severity }]
        );
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load finding for new CAR'));
  }, [token, idParam, codeParam, findingIdFromUrl]);

  const handleSave = async () => {
    if (!token || !car) return;
    setActioning(true);
    try {
      const patched = await apiJson<CAR>(`/cars/${car.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          severity: form.severity,
          carOwner: form.carOwner || null,
          targetCompletionDate: form.targetCompletionDate || null,
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
      setCar(patched);
      syncFormFromCar(patched);

      const updated = await apiJson<CAR>(`/cars/${car.id}/save`, { token, method: 'POST' });
      setCar(updated);
      syncFormFromCar(updated);
      setEditMode(false);
      setError(null);
      toast.info('CAR saved');
      navigate(`/car-record?id=${encodeURIComponent(updated.id)}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed (check required fields)');
    } finally {
      setActioning(false);
    }
  };

  const runAction = async (path: string, label: string) => {
    if (!token || !car) return;
    setActioning(true);
    setError(null);
    try {
      const updated = await apiJson<CAR>(path, { token, method: 'POST' });
      setCar(updated);
      syncFormFromCar(updated);
      toast.info(`${label} successful`);
    } catch (e) {
      setError(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setActioning(false);
    }
  };

  const runApprovalAction = async (path: string, label: 'Approve' | 'Reject') => {
    if (!token || !car) return;
    setActioning(true);
    setError(null);
    try {
      const updated = await apiJson<CAR>(path, {
        token,
        method: 'POST',
        body: JSON.stringify({ comment: approvalComment.trim() || null }),
      });
      setCar(updated);
      syncFormFromCar(updated);
      setApprovalComment('');
      toast.info(`${label} successful`);
    } catch (e) {
      setError(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setActioning(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.auditId || !form.supplierId || !form.severity || !form.summary.trim() || !form.discrepancy.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await apiJson<CAR>('/cars', {
        token,
        method: 'POST',
        body: JSON.stringify({
          findingId: form.findingId || null,
          auditId: form.auditId,
          supplierId: form.supplierId,
          severity: form.severity,
          carOwner: form.carOwner.trim() || null,
          targetCompletionDate: form.targetCompletionDate || null,
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
      setCar(created);
      setForm({
        findingId: '',
        auditId: '',
        supplierId: '',
        severity: 'Major',
        carOwner: '',
        targetCompletionDate: '',
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
      toast.success('CAR created');
      navigate(`/car-record?id=${encodeURIComponent(created.id)}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const onFindingSelect = (findingId: string) => {
    if (!findingId) {
      setForm((p) => ({ ...p, findingId }));
      return;
    }
    const f = findings.find((x) => x.id === findingId);
    if (f) {
      setForm((p) => ({
        ...p,
        findingId,
        auditId: f.auditId,
        supplierId: f.supplierId,
        severity: f.severity,
      }));
    }
  };

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">CAR Record</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading…</p>
        </div>
      </div>
    );
  }

  const isNew = !car && !idParam && !codeParam;

  if (!loading && isNew && !canCreateNew) {
    // Viewer/Auditor cannot create CARs, so redirect to the list page.
    return <Navigate to="/corrective-actions" replace />;
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">
          {car ? `${car.code} — CAR` : isNew ? 'New CAR' : 'CAR Record'}
        </h1>
        <p className="page-description">
          {car ? `Status: ${car.status}` : isNew ? 'Create a draft CAR (Admin, QE, or Buyer).' : 'CAR not found.'}
        </p>
        <p style={{ marginTop: 4 }}>
          <Link to="/corrective-actions" style={{ textDecoration: 'none' }}>← Back to Corrective Actions</Link>
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
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Create CAR</h2>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Finding #</label>
                  <select
                    className="input"
                    value={form.findingId}
                    onChange={(e) => {
                      const v = e.target.value;
                      onFindingSelect(v);
                    }}
                  >
                    <option value="">None / N/A</option>
                    {findings.map((f) => (
                      <option key={f.id} value={f.id}>{f.code}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Supplier *</label>
                  <select
                    className="input"
                    value={form.supplierId}
                    onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value, auditId: '' }))}
                    required
                    disabled={!!form.findingId}
                  >
                    <option value="">Select</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Audit # *</label>
                  <select
                    className="input"
                    value={form.auditId}
                    onChange={(e) => setForm((p) => ({ ...p, auditId: e.target.value }))}
                    required
                    disabled={!form.supplierId || !!form.findingId}
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
                <div className="input-group">
                  <label className="input-label">CAR Owner</label>
                  <input className="input" value={form.carOwner} onChange={(e) => setForm((p) => ({ ...p, carOwner: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Target Completion Date</label>
                  <input className="input" type="date" value={form.targetCompletionDate} onChange={(e) => setForm((p) => ({ ...p, targetCompletionDate: e.target.value }))} />
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
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </form>
          </div>
        </div>
      )}

      {car && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {canSave && (
                  <button type="button" className="btn btn-primary" onClick={handleSave} disabled={actioning}>
                    {actioning ? 'Saving…' : 'Save'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEditMode((v) => !v)}
                  disabled={!canEditDraft || car.status !== 'DRAFT' || actioning}
                  title={car.status !== 'DRAFT' ? 'Edit is available only in DRAFT before Save' : 'Toggle edit mode'}
                  style={editMode ? { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' } : undefined}
                >
                  {editMode ? 'Editing' : 'Edit'}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => runAction(`/cars/${car.id}/process`, 'Process')} disabled={!canProcess || actioning}>
                  {actioning ? '…' : 'Process'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => runAction(`/cars/${car.id}/reverse`, 'Reverse')} disabled={!canReverse || actioning}>
                  {actioning ? '…' : 'Reverse'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">CAR #</label>
                  <input className="input" value={car.code} readOnly disabled />
                </div>
                <div className="input-group">
                  <label className="input-label">Status</label>
                  <select className="input" value={car.status === 'DRAFT' ? 'RCCA' : car.status} disabled>
                    <option value="RCCA">RCCA</option>
                    <option value="WaitingApproval">Waiting Approval</option>
                    <option value="FollowUp">Follow Up</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Supplier</label>
                  <input className="input" value={car.supplier?.code ?? ''} readOnly disabled />
                </div>
                <div className="input-group">
                  <label className="input-label">Audit #</label>
                  <Link to="/audits" className="finding-code-link" style={{ display: 'inline-block', marginTop: 4 }}>{car.audit?.code ?? ''}</Link>
                </div>
                <div className="input-group">
                  <label className="input-label">Finding #</label>
                  {car.finding ? (
                    <Link to={`/findings-record?id=${car.finding.id}`} className="finding-code-link" style={{ display: 'inline-block', marginTop: 4 }}>
                      {car.finding.code}
                    </Link>
                  ) : (
                    <span style={{ display: 'inline-block', marginTop: 4, color: 'var(--color-text-muted)' }}>None</span>
                  )}
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
                <div className="input-group">
                  <label className="input-label">CAR Owner</label>
                  <input className="input" value={form.carOwner} onChange={(e) => setForm((p) => ({ ...p, carOwner: e.target.value }))} disabled={!canEdit} />
                </div>
                <div className="input-group">
                  <label className="input-label">Target Completion Date</label>
                  <input className="input" type="date" value={form.targetCompletionDate} onChange={(e) => setForm((p) => ({ ...p, targetCompletionDate: e.target.value }))} disabled={!canEdit} />
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
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--text-lg)' }}>Approval</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Approval Comment</label>
                  <input
                    className="input"
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="Add approval or rejection comment"
                    disabled={!canApproveReject || actioning}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary" onClick={() => runApprovalAction(`/cars/${car.id}/approve`, 'Approve')} disabled={!canApproveReject || actioning}>
                    Approve
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => runApprovalAction(`/cars/${car.id}/reject`, 'Reject')} disabled={!canApproveReject || actioning}>
                    Reject
                  </button>
                </div>
              </div>
              <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--text-lg)' }}>Approval Log</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Action</th>
                    <th>Comment</th>
                    <th>Date/Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(car.approvalLogs ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="table-empty">No approval actions yet.</td>
                    </tr>
                  ) : (
                    (car.approvalLogs ?? []).map((log) => (
                      <tr key={log.id}>
                        <td>{log.user?.name || log.user?.email || 'Unknown'}</td>
                        <td>{log.action}</td>
                        <td>{log.comment || '—'}</td>
                        <td>{new Date(log.createdAt).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <h2 style={{ marginTop: '1rem', marginBottom: '0.75rem', fontSize: 'var(--text-lg)' }}>Status History</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Note</th>
                    <th>Date/Time</th>
                  </tr>
                </thead>
                <tbody>
                  {statusHistory.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="table-empty">No status history yet.</td>
                    </tr>
                  ) : (
                    statusHistory.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.status}</td>
                        <td>{entry.note}</td>
                        <td>{new Date(entry.at).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!car && !isNew && (
        <div className="placeholder-empty">
          <strong>CAR not found</strong>
          Use a valid id or code from the Corrective Actions list.
        </div>
      )}
    </div>
  );
}
