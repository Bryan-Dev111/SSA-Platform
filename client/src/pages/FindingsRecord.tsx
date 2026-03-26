/**
 * Findings Record: layout aligned with CAR Record — status on record, Save/Edit/Process/Reverse,
 * Approval section at bottom with Approve/Reject, approval log and status history tables.
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
  createdBy?: { id: string; name: string | null; email: string | null } | null;
  correctiveActions?: { id: string; code: string; status: string }[];
  approvalLogs?: Array<{
    id: string;
    action: string;
    comment: string | null;
    createdAt: string;
    user: { id: string; name: string | null; email: string | null } | null;
  }>;
}

interface StatusHistoryEntry {
  id: string;
  status: string;
  note: string;
  user: string;
  at: string;
}

const SEVERITIES = ['Critical', 'Major', 'Minor'] as const;

const FINDING_STATUS_VALUES = new Set(['New', 'DRAFT', 'WaitingDisposition', 'WaitingApproval', 'Closed']);

/** Human-readable labels for Prisma enum-style status strings */
function formatFindingStatus(status: string): string {
  if (status === 'New' || status === 'DRAFT') return 'New';
  if (status === 'WaitingDisposition') return 'Waiting Disposition';
  if (status === 'WaitingApproval') return 'Waiting Approval';
  return status;
}

function displayPersonFullName(
  user: { name: string | null; email: string | null } | null | undefined,
  fallback = 'Unknown'
): string {
  const name = user?.name?.trim();
  return name && name.length > 0 ? name : fallback;
}

function approvalLogCommentDisplay(log: NonNullable<Finding['approvalLogs']>[number]): string {
  const a = log.action.trim().toLowerCase();
  const c = log.comment?.trim() ?? '';
  if ((a === 'processed' || a === 'reversed') && c && FINDING_STATUS_VALUES.has(c)) {
    return formatFindingStatus(c);
  }
  return log.comment?.trim() || '—';
}

function statusFromFindingApprovalLog(log: { action: string; comment: string | null }, findingStatus: string): string {
  const normalizedAction = log.action.trim().toLowerCase();
  if (normalizedAction === 'approved') return 'Closed';
  if (normalizedAction === 'rejected') return 'WaitingDisposition';
  if (normalizedAction === 'processed' || normalizedAction === 'reversed') {
    const cc = log.comment?.trim() ?? '';
    if (cc && FINDING_STATUS_VALUES.has(cc)) return cc;
  }
  return findingStatus;
}

function buildFindingStatusHistory(finding: Finding): StatusHistoryEntry[] {
  const createdBy = displayPersonFullName(finding.createdBy);
  const approvalEvents = (finding.approvalLogs ?? [])
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((log) => {
      const actor = displayPersonFullName(log.user);
      const normalizedAction = log.action.trim().toLowerCase();
      const statusFromAction = statusFromFindingApprovalLog(log, finding.status);
      let note: string;
      if (normalizedAction === 'processed') {
        note = `Processed to ${formatFindingStatus(statusFromAction)} by ${actor}.`.trim();
      } else if (normalizedAction === 'reversed') {
        note = `Reversed to ${formatFindingStatus(statusFromAction)} by ${actor}.`.trim();
      } else {
        const commentPart = log.comment?.trim() ? ` Comment: ${log.comment.trim()}` : '';
        note = `${log.action} by ${actor}.${commentPart}`.trim();
      }
      return {
        id: `approval-${log.id}`,
        status: formatFindingStatus(statusFromAction),
        note,
        user: actor,
        at: log.createdAt,
      } satisfies StatusHistoryEntry;
    });

  const createdStatusDisplay =
    finding.status === 'New' || finding.status === 'DRAFT'
      ? formatFindingStatus(finding.status)
      : formatFindingStatus('WaitingDisposition');

  const seed: StatusHistoryEntry[] = [
    {
      id: `created-${finding.id}`,
      status: createdStatusDisplay,
      note: 'Finding created.',
      user: createdBy,
      at: finding.createdAt,
    },
    ...approvalEvents,
  ];

  const findingStatusDisplay = formatFindingStatus(finding.status);
  const latest = seed[seed.length - 1];
  if (!latest || latest.status !== findingStatusDisplay) {
    seed.push({
      id: `current-${finding.id}`,
      status: findingStatusDisplay,
      note: 'Latest status (no workflow log for this change).',
      user: 'Unknown',
      at: finding.updatedAt,
    });
  }

  return seed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
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
    defectCode: f.defectCode ?? '',
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
  /** Deep link from Audits: audit code (e.g. AUD-00029) or audit row id; optional supplier UUID */
  const auditSeedParam = searchParams.get('auditId');
  const supplierSeedParam = searchParams.get('supplierId');
  const [finding, setFinding] = useState<Finding | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [audits, setAudits] = useState<AuditOption[]>([]);
  const [auditsHydrated, setAuditsHydrated] = useState(false);
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
    closingComments: '',
  });
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [findingQuery, setFindingQuery] = useState(codeParam ?? '');
  const [searching, setSearching] = useState(false);
  const [searchMissNoCreate, setSearchMissNoCreate] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const activeLoadIdRef = useRef(0);
  const prefillFromAuditDoneRef = useRef(false);
  const prefillInvalidAuditToastRef = useRef(false);
  const [dispositionCodeOptions, setDispositionCodeOptions] = useState<ReferenceCodeOption[]>([]);
  const [defectCodeOptions, setDefectCodeOptions] = useState<ReferenceCodeOption[]>([]);
  const roleNames = user?.roleNames ?? [];
  const canEditDraft = roleNames.some((r) => ['Admin', 'QualityEngineer', 'Auditor'].includes(r));
  const isEditableFindingStatus =
    !!finding && ['New', 'DRAFT', 'WaitingDisposition'].includes(finding.status);
  const canEdit = !!finding && editMode && canEditDraft && isEditableFindingStatus;
  const canSave = canEdit;
  const canApproveReject =
    finding?.status === 'WaitingApproval' &&
    roleNames.some((r) => ['Admin', 'QualityEngineer', 'Buyer'].includes(r));
  const canCreateNew = canEditDraft;

  const [createEnabled, setCreateEnabled] = useState(false);

  const processButtonDisabled =
    actioning ||
    !canEditDraft ||
    !finding ||
    editMode ||
    finding.status === 'WaitingApproval' ||
    finding.status === 'Closed' ||
    !(finding.status === 'New' || finding.status === 'DRAFT' || finding.status === 'WaitingDisposition');

  const reverseButtonDisabled = actioning || !canEditDraft || !finding || editMode || finding.status !== 'WaitingApproval';

  const statusHistory = finding ? buildFindingStatusHistory(finding) : [];
  const approvalDecisionLogs = (finding?.approvalLogs ?? []).filter((log) => {
    const action = log.action.trim().toLowerCase();
    return action === 'approved' || action === 'rejected';
  });

  const resetCreateForm = () => {
    setForm({
      supplierId: '',
      auditId: '',
      severity: 'Major',
      summary: '',
      discrepancy: '',
      defectCode: '',
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
      apiJson<Finding | null>(`/findings/by-code/${encodeURIComponent(query.toUpperCase())}`,{
        token: token!,
      });

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
      setCreateEnabled(false);
      setSearchMissNoCreate(false);
      setEditMode(false);
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
        setCreateEnabled(false);
        setEditMode(false);
        setApprovalComment('');
        setForm(formStateFromFinding(f));
      })
      .catch((e) => {
        if (!isActive()) return;
        setFinding(null);
        setCreateEnabled(false);
        setEditMode(false);
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
    if (!token) {
      setAuditsHydrated(false);
      return;
    }
    setAuditsHydrated(false);
    apiJson<AuditOption[]>('/audits', { token })
      .then((list) => setAudits(list))
      .catch(() => setAudits([]))
      .finally(() => setAuditsHydrated(true));
  }, [token]);

  /** Pre-fill create form from /findings/create?auditId=AUD-…&supplierId=… (from Audits row) */
  useEffect(() => {
    if (prefillFromAuditDoneRef.current) return;
    if (!token) return;
    if (finding || idParam || codeParam || searchMissNoCreate) return;
    const seedAudit = auditSeedParam?.trim() ?? '';
    const seedSupplier = supplierSeedParam?.trim() ?? '';
    if (!seedAudit && !seedSupplier) return;

    if (seedAudit && !auditsHydrated) return;

    let nextAuditId = '';
    let nextSupplierId = '';

    if (seedAudit) {
      const byId = audits.find((x) => x.id === seedAudit);
      const byCode = audits.find((x) => x.code.toUpperCase() === seedAudit.toUpperCase());
      const match = byId ?? byCode;
      if (match) {
        nextAuditId = match.id;
        nextSupplierId = match.supplierId;
      } else {
        if (!prefillInvalidAuditToastRef.current) {
          prefillInvalidAuditToastRef.current = true;
          toast.info('Could not find that audit in your scope; choose supplier and audit on the form if needed.');
        }
        prefillFromAuditDoneRef.current = true;
        if (seedSupplier) {
          setForm((p) => ({ ...p, supplierId: seedSupplier, auditId: '' }));
        }
        return;
      }
    } else if (seedSupplier) {
      nextSupplierId = seedSupplier;
    }

    if (!nextAuditId && !nextSupplierId) return;

    prefillFromAuditDoneRef.current = true;
    setForm((p) => ({
      ...p,
      supplierId: nextSupplierId || p.supplierId,
      auditId: nextAuditId || p.auditId,
    }));
  }, [
    token,
    finding,
    idParam,
    codeParam,
    searchMissNoCreate,
    auditSeedParam,
    supplierSeedParam,
    audits,
    auditsHydrated,
    toast,
  ]);

  useEffect(() => {
    if (!token) return;
    apiJson<{ list: ReferenceCodeOption[] }>('/disposition-codes', { token })
      .then((r) => setDispositionCodeOptions(r.list))
      .catch(() => setDispositionCodeOptions([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    apiJson<{ list: ReferenceCodeOption[] }>('/defect-codes', { token })
      .then((r) => setDefectCodeOptions(r.list))
      .catch(() => setDefectCodeOptions([]));
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
          defectCode: form.defectCode.trim() || null,
          dispositionCode: form.dispositionCode.trim() || null,
          closingComments: form.closingComments.trim() || null,
        }),
      });
      const updated =
        finding.status === 'New' || finding.status === 'DRAFT'
          ? await apiJson<Finding>(`/findings/${finding.id}/save`, { token, method: 'POST' })
          : patched;
      setFinding(updated);
      setForm(formStateFromFinding(updated));
      setEditMode(false);
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
      setEditMode(false);
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
      setEditMode(false);
      setError(null);
      toast.info('Reverse successful');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reverse failed');
    } finally {
      setActioning(false);
    }
  };

  const runApprovalAction = async (path: string, label: 'Approve' | 'Reject') => {
    if (!token || !finding) return;
    setActioning(true);
    setError(null);
    try {
      const updated = await apiJson<Finding>(path, {
        token,
        method: 'POST',
        body: JSON.stringify({ comment: approvalComment.trim() || null }),
      });
      setFinding(updated);
      setForm(formStateFromFinding(updated));
      setApprovalComment('');
      setEditMode(false);
      toast.info(`${label} successful`);
    } catch (e) {
      setError(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setActioning(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createLocked) {
      toast.info('Click Create finding to enable editing.');
      return;
    }
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
          defectCode: form.defectCode.trim() || null,
        }),
      });
      setFinding(created);
      setForm(formStateFromFinding(created));
      setError(null);
      toast.success('Finding created');
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
      setEditMode(false);
      setApprovalComment('');
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
    prefillFromAuditDoneRef.current = false;
    prefillInvalidAuditToastRef.current = false;
    setFinding(null);
    setError(null);
    setSearching(false);
    setSearchMissNoCreate(false);
    setFindingQuery('');
    resetCreateForm();
    setCreateEnabled(true);
    setEditMode(false);
    setApprovalComment('');
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
  const createLocked = isNew && !createEnabled;

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
            : !isNew
              ? 'Finding not found.'
              : null}
        </p>
        <p style={{ marginTop: 4 }}>
          <Link to="/findings" style={{ textDecoration: 'none' }}>← Back to Findings</Link>
        </p>
      </header>

      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap' }}>
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
                    disabled={createLocked}
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
                    disabled={createLocked}
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
                    disabled={createLocked}
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Summary *</label>
                <input
                  className="input"
                  value={form.summary}
                  onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
                  required
                  disabled={createLocked}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Discrepancy *</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.discrepancy}
                  onChange={(e) => setForm((p) => ({ ...p, discrepancy: e.target.value }))}
                  required
                  disabled={createLocked}
                />
              </div>
              <ReferenceCodeSelect
                label="Defect Code"
                value={form.defectCode}
                onChange={(v) => setForm((p) => ({ ...p, defectCode: v }))}
                options={defectCodeOptions}
                disabled={createLocked}
              />
              <button type="submit" className="btn btn-primary" disabled={saving || createLocked}>
                {saving ? 'Saving…' : 'Save'}
              </button>
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
                  <label className="input-label">Finding #</label>
                  <input className="input" value={finding.code} readOnly disabled />
                </div>
                <div className="input-group">
                  <label className="input-label">Status</label>
                  <select className="input" value={finding.status} disabled>
                    {(['New', 'DRAFT', 'WaitingDisposition', 'WaitingApproval', 'Closed'] as const).map((s) => (
                      <option key={s} value={s}>{formatFindingStatus(s)}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Supplier</label>
                  <input
                    className="input"
                    value={finding.supplier ? `${finding.supplier.code} — ${finding.supplier.name}` : ''}
                    readOnly
                    disabled
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Audit #</label>
                  {finding.audit?.code ? (
                    <Link to="/audits" className="finding-code-link" style={{ display: 'inline-block', marginTop: 4 }}>
                      {finding.audit.code}
                    </Link>
                  ) : (
                    <span style={{ display: 'inline-block', marginTop: 4, color: 'var(--color-text-muted)' }}>None</span>
                  )}
                </div>
                <div
                  style={{
                    gridColumn: '1 / -1',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(170px, 1fr)) auto',
                    gap: '1rem',
                    alignItems: 'end',
                  }}
                >
                  <div className="input-group" style={{ marginBottom: 0 }}>
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
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap', alignItems: 'center', paddingBottom: 1, gridColumn: '2 / -1', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-primary" onClick={() => void handleSave()} disabled={!canSave || actioning}>
                      {actioning && canSave ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className={editMode ? 'btn btn-ghost' : 'btn btn-primary'}
                      onClick={() => setEditMode((v) => !v)}
                      disabled={!canEditDraft || actioning || editMode || !isEditableFindingStatus}
                    >
                      Edit
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => void handleProcess()} disabled={processButtonDisabled}>
                      {actioning ? '…' : 'Process'}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => void handleReverse()} disabled={reverseButtonDisabled}>
                      {actioning ? '…' : 'Reverse'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="input-group" style={{ marginTop: '1rem' }}>
                <label className="input-label">Summary</label>
                <input className="input" value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="input-group">
                <label className="input-label">Discrepancy</label>
                <textarea className="input" rows={2} value={form.discrepancy} onChange={(e) => setForm((p) => ({ ...p, discrepancy: e.target.value }))} disabled={!canEdit} />
              </div>
              <ReferenceCodeSelect
                label="Defect Code"
                value={form.defectCode}
                onChange={(v) => setForm((p) => ({ ...p, defectCode: v }))}
                options={defectCodeOptions}
                disabled={!canEdit}
              />
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
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void runApprovalAction(`/findings/${finding.id}/approve`, 'Approve')}
                    disabled={!canApproveReject || actioning}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void runApprovalAction(`/findings/${finding.id}/reject`, 'Reject')}
                    disabled={!canApproveReject || actioning}
                  >
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
                  {approvalDecisionLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="table-empty">No approval decisions yet.</td>
                    </tr>
                  ) : (
                    approvalDecisionLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{displayPersonFullName(log.user)}</td>
                        <td>{log.action}</td>
                        <td>{approvalLogCommentDisplay(log)}</td>
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
                    <th>User</th>
                    <th>Date/Time</th>
                  </tr>
                </thead>
                <tbody>
                  {statusHistory.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="table-empty">No status history yet.</td>
                    </tr>
                  ) : (
                    statusHistory.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.status}</td>
                        <td>{entry.note}</td>
                        <td>{entry.user}</td>
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

      {!finding && !isNew && (
        <div className="placeholder-empty">
          <strong>Finding not found</strong>
          Use a valid id or code from the Findings list or Audits page.
        </div>
      )}
    </div>
  );
}
