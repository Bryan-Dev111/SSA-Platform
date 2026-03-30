/**
 * CAR Record: form (Supplier, Audit #, Finding #, Severity, CAR Owner, Target Completion Date,
 * Summary, Defect Code, Discrepancy, Containment, Occurrence/Escape Root Cause, Corrective Action,
 * VOE, Closing Comments); status history; workflow Save (DRAFT → RCCA), Process, Reverse, Approve, Reject.
 */
import { useEffect, useRef, useState } from 'react';
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
  createdBy?: { id: string; name: string | null; email: string | null } | null;
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
  user: string;
  at: string;
}

interface CarAttachment {
  id: string;
  name: string;
  notes: string | null;
  status: string;
  createdAt: string;
}

const SEVERITIES = ['Critical', 'Major', 'Minor'] as const;
const FINDING_NONE_OPTION = '__NONE__';

const CAR_STATUS_VALUES = new Set(['DRAFT', 'RCCA', 'WaitingApproval', 'FollowUp', 'Closed']);

/** Required on CAR form before Process can move RCCA → Waiting Approval (matches server). */
function getMissingRccaProcessLabels(f: {
  discrepancy: string;
  containment: string | null;
  occurrenceRootCause: string | null;
  escapeRootCause: string | null;
  correctiveAction: string | null;
}): string[] {
  const missing: string[] = [];
  if (!f.discrepancy.trim()) missing.push('Discrepancy');
  if (!(f.containment ?? '').trim()) missing.push('Containment');
  if (!(f.occurrenceRootCause ?? '').trim()) missing.push('Occurrence Root Cause');
  if (!(f.escapeRootCause ?? '').trim()) missing.push('Escape Root Cause');
  if (!(f.correctiveAction ?? '').trim()) missing.push('Corrective Action');
  return missing;
}

function formatCarStatusForDisplay(status: string): string {
  if (status === 'WaitingApproval') return 'Waiting Approval';
  if (status === 'FollowUp') return 'Follow Up';
  return status;
}

function approvalLogCommentDisplay(log: CAR['approvalLogs'] extends (infer E)[] | undefined ? E : never): string {
  const a = log.action.trim().toLowerCase();
  const c = log.comment?.trim() ?? '';
  if ((a === 'processed' || a === 'reversed') && c && CAR_STATUS_VALUES.has(c)) {
    return formatCarStatusForDisplay(c);
  }
  return log.comment?.trim() || '—';
}

function statusFromCarApprovalLog(
  log: { action: string; comment: string | null },
  carStatus: string
): string {
  const normalizedAction = log.action.trim().toLowerCase();
  if (normalizedAction === 'approved') return 'FollowUp';
  if (normalizedAction === 'rejected') return 'RCCA';
  if (normalizedAction === 'processed' || normalizedAction === 'reversed') {
    const c = log.comment?.trim() ?? '';
    if (c && CAR_STATUS_VALUES.has(c)) return c;
  }
  return carStatus;
}

function displayPersonFullName(
  user: { name: string | null; email: string | null } | null | undefined,
  fallback = 'Unknown'
): string {
  const name = user?.name?.trim();
  return name && name.length > 0 ? name : fallback;
}

function buildCarStatusHistory(car: CAR): StatusHistoryEntry[] {
  const createdBy = displayPersonFullName(car.createdBy);
  const approvalEvents = (car.approvalLogs ?? [])
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((log) => {
      const actor = displayPersonFullName(log.user);
      const normalizedAction = log.action.trim().toLowerCase();
      const statusFromAction = statusFromCarApprovalLog(log, car.status);
      let note: string;
      if (normalizedAction === 'processed') {
        note = `Processed to ${formatCarStatusForDisplay(statusFromAction)} by ${actor}.`.trim();
      } else if (normalizedAction === 'reversed') {
        note = `Reversed to ${formatCarStatusForDisplay(statusFromAction)} by ${actor}.`.trim();
      } else {
        const commentPart = log.comment?.trim() ? ` Comment: ${log.comment.trim()}` : '';
        note = `${log.action} by ${actor}.${commentPart}`.trim();
      }
      return {
        id: `approval-${log.id}`,
        status: formatCarStatusForDisplay(statusFromAction),
        note,
        user: actor,
        at: log.createdAt,
      } satisfies StatusHistoryEntry;
    });

  const seed: StatusHistoryEntry[] = [
    {
      id: `created-${car.id}`,
      status: formatCarStatusForDisplay('RCCA'),
      note: 'CAR created.',
      user: createdBy,
      at: car.createdAt,
    },
    ...approvalEvents,
  ];

  const carStatusDisplay = formatCarStatusForDisplay(car.status);
  const latest = seed[seed.length - 1];
  if (!latest || latest.status !== carStatusDisplay) {
    seed.push({
      id: `current-${car.id}`,
      status: carStatusDisplay,
      note: 'Latest status (no workflow log for this change).',
      user: 'Unknown',
      at: car.updatedAt,
    });
  }

  return seed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function isCarNotFoundErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase().replace(/\s+/g, '');
  return (
    normalized.includes('carnotfound') ||
    normalized.includes('"error":"carnotfound"') ||
    normalized.includes("{\"error\":\"carnotfound\"}")
  );
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
  const [carQuery, setCarQuery] = useState(codeParam ?? '');
  const [createFindingChoice, setCreateFindingChoice] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchMissNoCreate, setSearchMissNoCreate] = useState(false);
  const [attachments, setAttachments] = useState<CarAttachment[]>([]);
  // Requirement: On the CAR Record (create) page, fields must be locked until user clicks "Create CAR".
  const [createEnabled, setCreateEnabled] = useState(false);
  const activeLoadIdRef = useRef(0);
  const roleNames = user?.roleNames ?? [];
  const canEditDraft = roleNames.some((r) => ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer'].includes(r));
  const canEdit = !!car && editMode && canEditDraft;
  const canSave = !!car && canEditDraft && editMode;
  /** Process stays clickable for RCCA / FollowUp with missing fields so we can show a warning toast. */
  const processButtonDisabled =
    actioning ||
    !canEditDraft ||
    !car ||
    editMode ||
    car.status === 'WaitingApproval' ||
    car.status === 'Closed' ||
    car.status === 'DRAFT';
  /** Matches server: one step back, never to DRAFT (RCCA / DRAFT have no valid previous step). */
  const reverseButtonDisabled =
    actioning ||
    !canEditDraft ||
    !car ||
    editMode ||
    !['WaitingApproval', 'FollowUp', 'Closed'].includes(car.status);
  const canApproveReject = car?.status === 'WaitingApproval' && roleNames.some((r) => ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer'].includes(r));
  const canCreateNew = canEditDraft;
  const statusHistory = car ? buildCarStatusHistory(car) : [];
  const approvalDecisionLogs = (car?.approvalLogs ?? []).filter((log) => {
    const action = log.action.trim().toLowerCase();
    return action === 'approved' || action === 'rejected';
  });

  const resetCreateForm = () => {
    setCreateFindingChoice('');
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
  };

  useEffect(() => {
    setCarQuery(codeParam ?? '');
  }, [codeParam]);

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

  const fetchCarByQuery = async (queryRaw: string) => {
    const query = queryRaw.trim();
    if (!query) {
      throw new Error('Enter a CAR id or code to search.');
    }
    const tryById = async (): Promise<CAR | null> => {
      try {
        return await apiJson<CAR>(`/cars/${encodeURIComponent(query)}`, { token: token! });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isCarNotFoundErrorMessage(message)) return null;
        throw err;
      }
    };
    const tryByCode = async (): Promise<CAR | null> =>
      apiJson<CAR | null>(`/cars/by-code/${encodeURIComponent(query.toUpperCase())}`, { token: token! });

    const looksLikeCarCode = /^car[-\s]?\d+/i.test(query);
    if (looksLikeCarCode) {
      const byCode = await tryByCode();
      if (byCode) return byCode;
      const byId = await tryById();
      if (byId) return byId;
      throw new Error('CAR not found');
    }
    const byId = await tryById();
    if (byId) return byId;
    const byCode = await tryByCode();
    if (byCode) return byCode;
    throw new Error('CAR not found');
  };

  useEffect(() => {
    if (!token) return;
    const loadId = ++activeLoadIdRef.current;
    const isActive = () => activeLoadIdRef.current === loadId;
    if (!idParam && !codeParam) {
      setLoading(false);
      setError(null);
      setCar(null);
      setCreateEnabled(false);
      setSearchMissNoCreate(false);
      apiJson<Supplier[]>('/suppliers', { token }).then((rows) => { if (isActive()) setSuppliers(rows); }).catch(() => { if (isActive()) setSuppliers([]); });
      apiJson<{ list: Array<{ id: string; code: string; auditId: string; supplierId: string; severity: string }> }>('/findings', { token })
        .then((r) => { if (isActive()) setFindings(r.list.map((f) => ({ id: f.id, code: f.code, auditId: f.auditId, supplierId: f.supplierId, severity: f.severity }))); })
        .catch(() => { if (isActive()) setFindings([]); });
      apiJson<AuditOption[]>('/audits', { token }).then((rows) => { if (isActive()) setAudits(rows); }).catch(() => { if (isActive()) setAudits([]); });
      return;
    }
    setLoading(true);
    setError(null);
    setSearchMissNoCreate(false);
    const loadCar = async () => (idParam ? apiJson<CAR>(`/cars/${encodeURIComponent(idParam.trim())}`, { token }) : fetchCarByQuery(codeParam ?? ''));
    loadCar()
      .then((c: CAR) => {
        if (!isActive()) return;
        setCar(c);
        setCreateEnabled(false);
        setCarQuery('');
        setError(null);
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
      .catch((e) => {
        if (!isActive()) return;
        setCar(null);
        setCreateEnabled(false);
        const message = e instanceof Error ? e.message : 'Failed to load';
        setError(isCarNotFoundErrorMessage(message) ? null : message);
      })
      .finally(() => {
        if (isActive()) setLoading(false);
      });

    apiJson<Supplier[]>('/suppliers', { token }).then((rows) => { if (isActive()) setSuppliers(rows); }).catch(() => { if (isActive()) setSuppliers([]); });
    apiJson<{ list: unknown[] }>('/findings', { token }).then((r) => { if (isActive()) setFindings(r.list as FindingOption[]); }).catch(() => { if (isActive()) setFindings([]); });
    apiJson<AuditOption[]>('/audits', { token }).then((rows) => { if (isActive()) setAudits(rows); }).catch(() => { if (isActive()) setAudits([]); });
  }, [token, idParam, codeParam]);

  useEffect(() => {
    if (!token) return;
    apiJson<{ list: ReferenceCodeOption[] }>('/defect-codes', { token })
      .then((r) => setDefectCodeOptions(r.list))
      .catch(() => setDefectCodeOptions([]));
  }, [token]);

  useEffect(() => {
    if (!token || !car?.id) {
      setAttachments([]);
      return;
    }
    apiJson<CarAttachment[]>(`/records?carId=${encodeURIComponent(car.id)}`, { token })
      .then((rows) => setAttachments(rows))
      .catch(() => setAttachments([]));
  }, [token, car?.id]);

  /** Deep-link from Findings / Findings Record: prefill Finding # (works for DRAFT findings not on GET /findings list). */
  useEffect(() => {
    if (!token || idParam || codeParam || !findingIdFromUrl) return;
    apiJson<{ id: string; code: string; auditId: string; supplierId: string; severity: string }>(
      `/findings/${findingIdFromUrl}`,
      { token }
    )
      .then((f) => {
        setCreateFindingChoice(f.id);
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
      setEditMode(false);
      setError(null);
      if (patched.status === 'RCCA') {
        const missing = getMissingRccaProcessLabels({
          discrepancy: patched.discrepancy,
          containment: patched.containment,
          occurrenceRootCause: patched.occurrenceRootCause,
          escapeRootCause: patched.escapeRootCause,
          correctiveAction: patched.correctiveAction,
        });
        if (missing.length > 0) {
          toast.warning(`CAR updated. To move to Waiting Approval, complete: ${missing.join(', ')}.`);
        } else {
          toast.info('CAR updated');
        }
      } else {
        toast.info('CAR updated');
      }
      navigate(`/car-record?id=${encodeURIComponent(patched.id)}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed (check required fields)');
    } finally {
      setActioning(false);
    }
  };

  const handleProcessClick = async () => {
    if (!token || !car) return;
    if (car.status === 'RCCA') {
      const missing = getMissingRccaProcessLabels({
        discrepancy: form.discrepancy,
        containment: form.containment,
        occurrenceRootCause: form.occurrenceRootCause,
        escapeRootCause: form.escapeRootCause,
        correctiveAction: form.correctiveAction,
      });
      if (missing.length > 0) {
        toast.warning(`To move to Waiting Approval, complete: ${missing.join(', ')}.`);
        return;
      }
    }
    if (car.status === 'FollowUp' && !form.verificationOfEffectiveness.trim()) {
      toast.warning('Verification of Effectiveness is required before closing.');
      return;
    }
    await runAction(`/cars/${car.id}/process`, 'Process');
  };

  const handleReverseClick = async () => {
    if (!token || !car) return;
    setActioning(true);
    setError(null);
    try {
      await apiJson<CAR>(`/cars/${car.id}/reverse`, { token, method: 'POST' });
      const fresh = await apiJson<CAR>(`/cars/${encodeURIComponent(car.id)}`, { token });
      setCar(fresh);
      syncFormFromCar(fresh);
      setEditMode(false);
      toast.info('Reverse successful');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reverse failed');
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
    if (!createEnabled) {
      toast.info('Click Create CAR to enable editing.');
      return;
    }
    if (createFindingChoice === '') {
      setError('Finding # is required');
      toast.error('Finding # is required');
      return;
    }
    if (!token) return;
    const missing: string[] = [];
    if (!form.supplierId) missing.push('Supplier');
    if (!form.auditId) missing.push('Audit #');
    if (!form.severity) missing.push('Severity');
    if (!form.summary.trim()) missing.push('Summary');
    if (!form.discrepancy.trim()) missing.push('Problem Statement');
    if (missing.length > 0) {
      const message = `Please complete required fields: ${missing.join(', ')}`;
      toast.error(message);
      return;
    }
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
      setCreateEnabled(false);
      resetCreateForm();
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

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = carQuery.trim();
    if (!q) {
      toast.info('Enter a CAR id or code to search.');
      return;
    }
    if (!token) return;
    const loadId = ++activeLoadIdRef.current;
    const isActive = () => activeLoadIdRef.current === loadId;
    setSearching(true);
    setError(null);
    setSearchMissNoCreate(false);
    try {
      const found = await fetchCarByQuery(q);
      if (!isActive()) return;
      setCar(found);
      syncFormFromCar(found);
      setCarQuery('');
      setError(null);
      setSearchMissNoCreate(false);
    } catch (err) {
      if (!isActive()) return;
      setCar(null);
      const message = err instanceof Error ? err.message : 'Failed to load';
      const isNotFound = isCarNotFoundErrorMessage(message);
      setError(isNotFound ? null : message);
      setSearchMissNoCreate(isNotFound);
    } finally {
      if (isActive()) setSearching(false);
    }
  };

  const handleStartCreateCar = () => {
    setCar(null);
    setError(null);
    setSearching(false);
    setSearchMissNoCreate(false);
    setEditMode(false);
    setCreateEnabled(true);
    setApprovalComment('');
    setCarQuery('');
    resetCreateForm();
    // If we're already on the create page, avoid navigating (prevents state reset).
    // If coming from the detail view (id/code in URL), navigate to drop query params.
    if (idParam || codeParam) navigate('/car-record');
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

  const isNew = !car && !idParam && !codeParam && !searchMissNoCreate;
  const createLocked = isNew && !createEnabled;

  if (!loading && isNew && !canCreateNew) {
    // Viewer/Auditor cannot create CARs, so redirect to the list page.
    return <Navigate to="/corrective-actions" replace />;
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">
          {car ? `${car.code} — CAR` : 'CAR Record'}
        </h1>
          <p className="page-description">
            {car ? `Status: ${car.status}` : isNew ? '' : 'CAR not found.'}
          </p>
        <p style={{ marginTop: 4 }}>
          <Link to="/corrective-actions" style={{ textDecoration: 'none' }}>← Back to Corrective Actions</Link>
        </p>
      </header>

      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap', flex: '1 1 auto' }}>
          <input
            className="input"
            value={carQuery}
            onChange={(e) => setCarQuery(e.target.value)}
            // placeholder="Search by CAR id or code"
            style={{ width: 320, minWidth: 320, maxWidth: 320 }}
          />
          <button type="submit" className="btn btn-ghost" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
          {canCreateNew && (
            <button type="button" className="btn btn-primary" onClick={handleStartCreateCar}>
              Create CAR
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
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Create CAR</h2>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Finding # *</label>
                  <select
                    className="input"
                    value={createFindingChoice}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCreateFindingChoice(v);
                      onFindingSelect(v === FINDING_NONE_OPTION ? '' : v);
                    }}
                    required
                    disabled={createLocked}
                  >
                    <option value="">Select...</option>
                    <option value={FINDING_NONE_OPTION}>None</option>
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
                    disabled={createLocked || !!form.findingId}
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
                    disabled={createLocked || !form.supplierId || !!form.findingId}
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
                    disabled={createLocked}
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">CAR Owner</label>
                  <input
                    className="input"
                    value={form.carOwner}
                    onChange={(e) => setForm((p) => ({ ...p, carOwner: e.target.value }))}
                    disabled={createLocked}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Target Completion Date</label>
                  <input
                    className="input"
                    type="date"
                    value={form.targetCompletionDate}
                    onChange={(e) => setForm((p) => ({ ...p, targetCompletionDate: e.target.value }))}
                    disabled={createLocked}
                  />
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
                <label className="input-label">Problem Statement *</label>
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

      {car && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">CAR #</label>
                  <input className="input" value={car.code} readOnly disabled />
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
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">CAR Owner</label>
                    <input className="input" value={form.carOwner} onChange={(e) => setForm((p) => ({ ...p, carOwner: e.target.value }))} disabled={!canEdit} />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Target Completion Date</label>
                    <input
                      className="input"
                      type="date"
                      value={form.targetCompletionDate}
                      onChange={(e) => setForm((p) => ({ ...p, targetCompletionDate: e.target.value }))}
                      disabled={!canEdit}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap', alignItems: 'center', paddingBottom: 1 }}>
                    <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!canSave || actioning}>
                      {actioning && canSave ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className={editMode ? 'btn btn-ghost' : 'btn btn-primary'}
                      onClick={() => setEditMode((v) => !v)}
                      disabled={!canEditDraft || actioning || editMode}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void handleProcessClick()}
                      disabled={processButtonDisabled}
                    >
                      {actioning ? '…' : 'Process'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void handleReverseClick()}
                      disabled={reverseButtonDisabled}
                    >
                      {actioning ? '…' : 'Reverse'}
                    </button>
                  </div>
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
                <label className="input-label">Problem Statement</label>
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
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Attachments</h2>
                  <Link
                    to={`/records?supplierId=${encodeURIComponent(car.supplierId)}&carId=${encodeURIComponent(car.id)}`}
                    className="btn btn-ghost"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    + Add attachment
                  </Link>
                </div>
                {attachments.length === 0 ? (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    No attachments linked to this CAR.
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Notes</th>
                          <th>Review</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attachments.map((row) => (
                          <tr key={row.id}>
                            <td>{row.name}</td>
                            <td>{row.notes?.trim() ? row.notes : '—'}</td>
                            <td>{row.status}</td>
                            <td>{new Date(row.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
                    // placeholder="Add approval or rejection comment"
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

      {!car && !isNew && (
        <div className="placeholder-empty">
          <strong>CAR not found</strong>
          Use a valid id or code from the Corrective Actions list.
        </div>
      )}
    </div>
  );
}
