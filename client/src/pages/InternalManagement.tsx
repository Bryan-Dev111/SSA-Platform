/**
 * Internal Management — Admin only: Audits, Shipments (schedule), Contracts (internal docs).
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError, downloadWithAuthProgress } from '../utils/apiHelpers';
import { Navigate } from 'react-router-dom';
import { getDefaultPath } from '../config/rolePageAccess';
import { ConfirmDialog } from '../components/ConfirmDialog';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
type ImTab = 'audits' | 'shipments' | 'contracts' | 'documents' | 'commandMedia' | 'projectHistory' | 'profit';

const COMMAND_MEDIA_TYPES: { value: string; label: string }[] = [
  { value: 'Procedure', label: 'Procedure' },
  { value: 'Policy', label: 'Policy' },
  { value: 'QualityManual', label: 'Quality Manual' },
  { value: 'Standard', label: 'Standard' },
  { value: 'StandardOperatingProcedure', label: 'SOP' },
  { value: 'WorkInstruction', label: 'Work Instruction' },
  { value: 'Form', label: 'Form' },
];

interface InternalRow {
  id: string;
  name: string;
  category: string | null;
  note: string | null;
  filePath: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SupplierOption {
  id: string;
  code: string;
  name: string;
}

interface AuditTypeOption {
  id: string;
  code: string;
  name: string | null;
}

interface ScheduleRow {
  id: string;
  supplierId: string | null;
  purchaseOrder: string | null;
  partNumber: string | null;
  qty: number | null;
  scheduledDate: string | null;
  notes: string | null;
  supplier: { id: string; code: string; name: string } | null;
}

interface ProjectHistoryRow {
  id: string;
  projectCode: string;
  clientName: string;
  companyName: string;
  clientEmail: string | null;
  clientMobile: string | null;
  industry: string | null;
  country: string | null;
  projectDescription: string | null;
  periodOfPerformance: string | null;
  revenue: string | null;
  revenueAmount: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ProfitRow {
  projectId: string;
  projectCode: string;
  companyName: string;
  revenue: string | null;
  revenueAmount: number;
  costs: number;
  profit: number;
  status: string;
}

interface CommandMediaApiRow {
  id: string;
  documentNumber: string;
  name: string;
  category: string | null;
  documentType: string;
  filePath: string | null;
  createdAt: string;
}

interface CommandMediaRow {
  id: string;
  documentNumber: string;
  name: string;
  revision: string | null;
  documentType: string;
  filePath: string | null;
  createdAt: string;
}

function commandMediaTypeLabel(t: string): string {
  return COMMAND_MEDIA_TYPES.find((d) => d.value === t)?.label ?? t;
}

export function InternalManagement() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<ImTab>('audits');

  const [rows, setRows] = useState<InternalRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [auditTypes, setAuditTypes] = useState<AuditTypeOption[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Record<string, number>>({});
  const [newAudit, setNewAudit] = useState({
    supplierId: '',
    auditDate: '',
    auditTypeId: '',
    auditor: '',
    summary: '',
    scope: '',
  });
  const [submittingAudit, setSubmittingAudit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    supplierId: '',
    purchaseOrder: '',
    partNumber: '',
    qty: '',
    scheduledDate: '',
    notes: '',
  });
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleDeleteId, setScheduleDeleteId] = useState<string | null>(null);
  const [scheduleBusyId, setScheduleBusyId] = useState<string | null>(null);
  const [commandMedia, setCommandMedia] = useState({
    documentNumber: '',
    name: '',
    documentType: 'Procedure',
    revision: '',
    file: null as File | null,
  });
  const [commandMediaSubmitting, setCommandMediaSubmitting] = useState(false);
  const [commandMediaUploadProgress, setCommandMediaUploadProgress] = useState<number | null>(null);
  const commandMediaFileInputRef = useRef<HTMLInputElement | null>(null);
  const [commandMediaRows, setCommandMediaRows] = useState<CommandMediaRow[]>([]);
  const [commandMediaDownloading, setCommandMediaDownloading] = useState<Record<string, number>>({});
  const [commandMediaDeleteConfirmId, setCommandMediaDeleteConfirmId] = useState<string | null>(null);
  const [commandMediaDeletingId, setCommandMediaDeletingId] = useState<string | null>(null);

  const [projectHistories, setProjectHistories] = useState<ProjectHistoryRow[]>([]);
  const [clientForm, setClientForm] = useState({
    clientName: '',
    companyName: '',
    clientEmail: '',
    clientMobile: '',
    industry: '',
    country: '',
    projectDescription: '',
    periodOfPerformance: '',
    revenue: '',
    status: 'Active' as 'Active' | 'Inactive',
  });
  const [projectEditingId, setProjectEditingId] = useState<string | null>(null);
  const [projectSubmitting, setProjectSubmitting] = useState(false);
  const [projectBusyId, setProjectBusyId] = useState<string | null>(null);
  const [profitRows, setProfitRows] = useState<ProfitRow[]>([]);

  const isAdmin = user?.roleNames?.includes('Admin') ?? false;

  const loadProjectHistories = () => {
    if (!token) return;
    apiJson<ProjectHistoryRow[]>('/project-history', { token })
      .then(setProjectHistories)
      .catch(() => setProjectHistories([]));
  };

  const loadProfit = () => {
    if (!token) return;
    apiJson<ProfitRow[]>('/project-history/profit-summary', { token })
      .then(setProfitRows)
      .catch(() => setProfitRows([]));
  };

  const load = () => {
    if (!token) return;
    Promise.all([
      apiJson<InternalRow[]>('/internal-docs', { token }),
      apiJson<SupplierOption[]>('/suppliers', { token }),
      apiJson<AuditTypeOption[]>('/audits/types', { token }),
      apiJson<ScheduleRow[]>('/shipment-schedule', { token }),
      apiJson<CommandMediaApiRow[]>('/documents', { token }),
    ])
      .then(([docs, supplierList, typeList, sched, commandDocs]) => {
        setRows(docs);
        setSuppliers(supplierList);
        setAuditTypes(typeList);
        setSchedules(sched);
        setCommandMediaRows(
          commandDocs.map((r) => ({
            ...r,
            revision: r.category,
          }))
        );
      })
      .catch((e) => setError(parseApiError(e)));
  };

  useEffect(() => {
    if (!token || !isAdmin) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiJson<InternalRow[]>('/internal-docs', { token }),
      apiJson<SupplierOption[]>('/suppliers', { token }),
      apiJson<AuditTypeOption[]>('/audits/types', { token }),
      apiJson<ScheduleRow[]>('/shipment-schedule', { token }),
      apiJson<CommandMediaApiRow[]>('/documents', { token }),
    ])
      .then(([docs, supplierList, typeList, sched, commandDocs]) => {
        setRows(docs);
        setSuppliers(supplierList);
        setAuditTypes(typeList);
        setSchedules(sched);
        setCommandMediaRows(
          commandDocs.map((r) => ({
            ...r,
            revision: r.category,
          }))
        );
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token, isAdmin]);

  useEffect(() => {
    if (!token || !isAdmin || (tab !== 'projectHistory' && tab !== 'profit')) return;
    if (tab === 'projectHistory') loadProjectHistories();
    if (tab === 'profit') loadProfit();
  }, [token, isAdmin, tab]);

  if (user && !isAdmin) {
    return <Navigate to={getDefaultPath(user.roleNames)} replace />;
  }

  const submit = async (e: React.FormEvent, options?: { categoryOverride?: string | null }) => {
    e.preventDefault();
    if (!token || !name.trim()) return;
    if (file && file.size > 8 * 1024 * 1024) {
      toast.error('File must be 8MB or smaller');
      return;
    }
    setSubmitting(true);
    setUploadProgress(file ? 0 : null);
    try {
      let fileBase64: string | undefined;
      let fileName: string | undefined;
      if (file) {
        fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onprogress = (evt) => {
            if (!evt.lengthComputable) return;
            setUploadProgress(Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100))));
          };
          reader.onload = () => {
            const s = reader.result as string;
            const i = s.indexOf(',');
            setUploadProgress(100);
            resolve(i >= 0 ? s.slice(i + 1) : s);
          };
          reader.onerror = () => reject(new Error('Could not read file'));
          reader.readAsDataURL(file);
        });
        fileName = file.name;
      }
      await apiJson('/internal-docs', {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          category:
            options?.categoryOverride !== undefined
              ? options.categoryOverride
              : category.trim() || null,
          note: note.trim() || null,
          ...(fileBase64 ? { fileBase64, fileName } : {}),
        }),
      });
      setName('');
      setCategory('');
      setNote('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadProgress(null);
      toast.success('Saved');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const submitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !scheduleForm.supplierId.trim() || !scheduleForm.scheduledDate.trim()) {
      toast.error('Supplier and scheduled date are required');
      return;
    }
    let qty: number | null = null;
    if (scheduleForm.qty.trim() !== '') {
      const n = Number(scheduleForm.qty);
      if (!Number.isFinite(n) || n < 0) {
        toast.error('Qty must be a non-negative number');
        return;
      }
      qty = Math.floor(n);
    }
    setScheduleSubmitting(true);
    try {
      await apiJson('/shipment-schedule', {
        token,
        method: 'POST',
        body: JSON.stringify({
          supplierId: scheduleForm.supplierId,
          purchaseOrder: scheduleForm.purchaseOrder.trim() || null,
          partNumber: scheduleForm.partNumber.trim() || null,
          qty,
          scheduledDate: scheduleForm.scheduledDate.trim(),
          notes: scheduleForm.notes.trim() || null,
        }),
      });
      toast.success('Schedule row added');
      setScheduleForm({
        supplierId: '',
        purchaseOrder: '',
        partNumber: '',
        qty: '',
        scheduledDate: '',
        notes: '',
      });
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const removeSchedule = async (id: string) => {
    if (!token) return;
    setScheduleDeleteId(null);
    setScheduleBusyId(id);
    try {
      await apiJson(`/shipment-schedule/${id}`, { token, method: 'DELETE' });
      toast.success('Removed');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setScheduleBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!token) return;
    setDeleteConfirmId(null);
    setDeletingId(id);
    try {
      await apiJson(`/internal-docs/${id}`, { token, method: 'DELETE' });
      toast.success('Deleted');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDeletingId(null);
    }
  };

  const download = async (r: InternalRow) => {
    if (!token || !r.filePath) {
      toast.error('No file attached');
      return;
    }
    try {
      setDownloading((prev) => ({ ...prev, [r.id]: 0 }));
      await downloadWithAuthProgress(`/internal-docs/${r.id}/download`, token, r.name, (p) => {
        setDownloading((prev) => ({ ...prev, [r.id]: p }));
      });
      toast.success('Download completed');
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDownloading((prev) => {
        const next = { ...prev };
        delete next[r.id];
        return next;
      });
    }
  };

  const submitAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newAudit.supplierId || !newAudit.auditDate) return;
    setSubmittingAudit(true);
    try {
      const created = await apiJson<{ code: string }>('/audits', {
        token,
        method: 'POST',
        body: JSON.stringify({
          supplierId: newAudit.supplierId,
          auditDate: newAudit.auditDate,
          auditTypeId: newAudit.auditTypeId || null,
          auditor: newAudit.auditor || null,
          summary: newAudit.summary || null,
          scope: newAudit.scope || null,
        }),
      });
      toast.success(`Audit ${created.code} created`);
      setNewAudit({
        supplierId: '',
        auditDate: '',
        auditTypeId: '',
        auditor: '',
        summary: '',
        scope: '',
      });
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSubmittingAudit(false);
    }
  };

  const submitCommandMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !commandMedia.documentNumber.trim() || !commandMedia.name.trim()) return;
    if (commandMedia.file && commandMedia.file.size > 150 * 1024 * 1024) {
      toast.error('File must be 150MB or smaller');
      return;
    }
    setCommandMediaSubmitting(true);
    setCommandMediaUploadProgress(commandMedia.file ? 0 : null);
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/documents`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (evt) => {
          if (!evt.lengthComputable) return;
          setCommandMediaUploadProgress(Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100))));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setCommandMediaUploadProgress(100);
            resolve();
          } else {
            reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error while uploading file'));
        const form = new FormData();
        form.append('documentNumber', commandMedia.documentNumber.trim());
        form.append('name', commandMedia.name.trim());
        form.append('documentType', commandMedia.documentType);
        form.append('revision', commandMedia.revision.trim());
        if (commandMedia.file) form.append('file', commandMedia.file);
        xhr.send(form);
      });

      setCommandMedia({
        documentNumber: '',
        name: '',
        documentType: 'Procedure',
        revision: '',
        file: null,
      });
      if (commandMediaFileInputRef.current) commandMediaFileInputRef.current.value = '';
      setCommandMediaUploadProgress(null);
      toast.success('Command media uploaded');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setCommandMediaSubmitting(false);
      setCommandMediaUploadProgress(null);
    }
  };

  const downloadCommandMedia = async (r: CommandMediaRow) => {
    if (!token || !r.filePath) {
      toast.error('No file attached');
      return;
    }
    try {
      setCommandMediaDownloading((prev) => ({ ...prev, [r.id]: 0 }));
      await downloadWithAuthProgress(`/documents/${r.id}/download`, token, `${r.documentNumber}-${r.name}`, (p) => {
        setCommandMediaDownloading((prev) => ({ ...prev, [r.id]: p }));
      });
      toast.success('Download completed');
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setCommandMediaDownloading((prev) => {
        const next = { ...prev };
        delete next[r.id];
        return next;
      });
    }
  };

  const removeCommandMedia = async (id: string) => {
    if (!token) return;
    setCommandMediaDeleteConfirmId(null);
    setCommandMediaDeletingId(id);
    try {
      await apiJson(`/documents/${id}`, { token, method: 'DELETE' });
      toast.success('Deleted');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setCommandMediaDeletingId(null);
    }
  };

  const resetProjectForm = () => {
    setProjectEditingId(null);
    setClientForm({
      clientName: '',
      companyName: '',
      clientEmail: '',
      clientMobile: '',
      industry: '',
      country: '',
      projectDescription: '',
      periodOfPerformance: '',
      revenue: '',
      status: 'Active',
    });
  };

  const submitProjectHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !clientForm.clientName.trim() || !clientForm.companyName.trim()) {
      toast.error('Client name and company name are required');
      return;
    }
    setProjectSubmitting(true);
    try {
      if (projectEditingId) {
        await apiJson(`/project-history/${projectEditingId}`, {
          token,
          method: 'PATCH',
          body: JSON.stringify({
            clientName: clientForm.clientName.trim(),
            companyName: clientForm.companyName.trim(),
            clientEmail: clientForm.clientEmail.trim() || null,
            clientMobile: clientForm.clientMobile.trim() || null,
            industry: clientForm.industry.trim() || null,
            country: clientForm.country.trim() || null,
            projectDescription: clientForm.projectDescription.trim() || null,
            periodOfPerformance: clientForm.periodOfPerformance.trim() || null,
            revenue: clientForm.revenue.trim() || null,
            status: clientForm.status,
          }),
        });
        toast.success('Project history updated');
      } else {
        await apiJson('/project-history', {
          token,
          method: 'POST',
          body: JSON.stringify({
            clientName: clientForm.clientName.trim(),
            companyName: clientForm.companyName.trim(),
            clientEmail: clientForm.clientEmail.trim() || null,
            clientMobile: clientForm.clientMobile.trim() || null,
            industry: clientForm.industry.trim() || null,
            country: clientForm.country.trim() || null,
            projectDescription: clientForm.projectDescription.trim() || null,
            periodOfPerformance: clientForm.periodOfPerformance.trim() || null,
            revenue: clientForm.revenue.trim() || null,
            status: clientForm.status,
          }),
        });
        toast.success('Project history added');
      }
      resetProjectForm();
      loadProjectHistories();
      loadProfit();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setProjectSubmitting(false);
    }
  };

  const startEditProject = (row: ProjectHistoryRow) => {
    setProjectEditingId(row.id);
    setClientForm({
      clientName: row.clientName,
      companyName: row.companyName,
      clientEmail: row.clientEmail ?? '',
      clientMobile: row.clientMobile ?? '',
      industry: row.industry ?? '',
      country: row.country ?? '',
      projectDescription: row.projectDescription ?? '',
      periodOfPerformance: row.periodOfPerformance ?? '',
      revenue: row.revenue ?? '',
      status: row.status === 'Inactive' ? 'Inactive' : 'Active',
    });
  };

  const deleteProjectHistory = async (id: string) => {
    if (!token) return;
    setProjectBusyId(id);
    try {
      await apiJson(`/project-history/${id}`, { token, method: 'DELETE' });
      toast.success('Removed');
      if (projectEditingId === id) resetProjectForm();
      loadProjectHistories();
      loadProfit();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setProjectBusyId(null);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Internal Management</h1>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {(
          [
            ['audits', 'Audits'],
            ['shipments', 'Shipments'],
            ['contracts', 'Contracts'],
            ['documents', 'Documents'],
            ['commandMedia', 'Command Media'],
            ['projectHistory', 'Project History'],
            ['profit', 'Profit'],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="alert-error">{error}</div>}

      {tab === 'audits' && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Schedule new audit</h2>
            <form onSubmit={submitAudit}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                }}
              >
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Supplier *</label>
                  <select
                    className="input"
                    value={newAudit.supplierId}
                    onChange={(e) => setNewAudit((p) => ({ ...p, supplierId: e.target.value }))}
                    required
                  >
                    <option value="">Select</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Audit date *</label>
                  <input
                    type="date"
                    className="input"
                    value={newAudit.auditDate}
                    onChange={(e) => setNewAudit((p) => ({ ...p, auditDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Audit type</label>
                  <select
                    className="input"
                    value={newAudit.auditTypeId}
                    onChange={(e) => setNewAudit((p) => ({ ...p, auditTypeId: e.target.value }))}
                  >
                    <option value="">—</option>
                    {auditTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code}
                        {t.name ? ` — ${t.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Auditor</label>
                  <input
                    className="input"
                    value={newAudit.auditor}
                    onChange={(e) => setNewAudit((p) => ({ ...p, auditor: e.target.value }))}
                    placeholder="Assigned auditor name/email"
                  />
                </div>
              </div>
              <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                <label className="input-label">Summary</label>
                <input
                  className="input"
                  value={newAudit.summary}
                  onChange={(e) => setNewAudit((p) => ({ ...p, summary: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                <label className="input-label">Scope</label>
                <input
                  className="input"
                  value={newAudit.scope}
                  onChange={(e) => setNewAudit((p) => ({ ...p, scope: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submittingAudit}>
                {submittingAudit ? 'Creating…' : 'Create audit'}
              </button>
            </form>
          </div>
        </div>
      )}

      {tab === 'shipments' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Shipments</h2>
              {/* <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 0 }}>
                Planned shipment schedule (OTD / planning). Supplier inspection requests are reviewed on the Shipments page.
              </p> */}
              <form onSubmit={submitSchedule}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Supplier *</label>
                    <select
                      className="input"
                      value={scheduleForm.supplierId}
                      onChange={(e) => setScheduleForm((p) => ({ ...p, supplierId: e.target.value }))}
                      required
                    >
                      <option value="">Select</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} — {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">PO</label>
                    <input
                      className="input"
                      value={scheduleForm.purchaseOrder}
                      onChange={(e) => setScheduleForm((p) => ({ ...p, purchaseOrder: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Part #</label>
                    <input
                      className="input"
                      value={scheduleForm.partNumber}
                      onChange={(e) => setScheduleForm((p) => ({ ...p, partNumber: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Qty</label>
                    <input
                      type="number"
                      min={0}
                      className="input"
                      value={scheduleForm.qty}
                      onChange={(e) => setScheduleForm((p) => ({ ...p, qty: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Scheduled date *</label>
                    <input
                      type="date"
                      className="input"
                      value={scheduleForm.scheduledDate}
                      onChange={(e) => setScheduleForm((p) => ({ ...p, scheduledDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="input-label">Notes</label>
                  <input
                    className="input"
                    value={scheduleForm.notes}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={scheduleSubmitting}>
                  {scheduleSubmitting ? 'Adding…' : 'Add row'}
                </button>
              </form>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Shipment schedule</h2>
              <div className="table-wrap">
                {schedules.length === 0 ? (
                  <p className="table-empty">No scheduled rows.</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Supplier</th>
                        <th>PO</th>
                        <th>Part #</th>
                        <th>Qty</th>
                        <th>Scheduled</th>
                        <th>Notes</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map((r) => (
                        <tr key={r.id}>
                          <td>
                            {r.supplier ? `${r.supplier.code} — ${r.supplier.name}` : '—'}
                          </td>
                          <td>{r.purchaseOrder ?? '—'}</td>
                          <td>{r.partNumber ?? '—'}</td>
                          <td>{r.qty ?? '—'}</td>
                          <td>{r.scheduledDate ? String(r.scheduledDate).slice(0, 10) : '—'}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.notes?.trim() ? r.notes : '—'}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={scheduleBusyId === r.id}
                              onClick={() => setScheduleDeleteId(r.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'contracts' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Upload</h2>
              <form onSubmit={(e) => void submit(e)}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'minmax(180px, 1fr) minmax(180px, 1fr) minmax(220px, 1.2fr) minmax(240px, 1.2fr) auto',
                    gap: '0.75rem',
                    alignItems: 'flex-end',
                    paddingBottom: 22,
                  }}
                >
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Name *</label>
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Type</label>
                    <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Note</label>
                    <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0, position: 'relative' }}>
                    <label className="input-label">File (optional)</label>
                    <input
                      ref={fileInputRef}
                      className="input"
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        setFile(e.target.files?.[0] ?? null);
                        setUploadProgress(null);
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        className="btn file-picker-btn"
                        onClick={() => fileInputRef.current?.click()}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        Choose file
                      </button>
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'inline-block',
                          maxWidth: 170,
                        }}
                        title={file?.name || 'No file chosen'}
                      >
                        {file?.name || 'No file chosen'}
                      </span>
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        minHeight: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      <span>
                        {file
                          ? `Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB · Ext: ${
                              file.name.includes('.') ? `.${file.name.split('.').pop()}` : '—'
                            }`
                          : ''}
                      </span>
                      {uploadProgress !== null && file ? (
                        <span style={{ minWidth: 140, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <progress value={uploadProgress} max={100} style={{ width: 90, height: 8 }} />
                          <span>{uploadProgress}%</span>
                        </span>
                      ) : (
                        <span />
                      )}
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? '…' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Library</h2>
              <div className="table-wrap">
                {loading ? (
                  <p className="table-empty">Loading…</p>
                ) : rows.length === 0 ? (
                  <p className="table-empty">No internal documents.</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Note</th>
                        <th>View</th>
                        <th>Updated</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>{r.category ?? '—'}</td>
                          <td>{r.note ?? '—'}</td>
                          <td>
                            {r.filePath ? (
                              <button
                                type="button"
                                className="btn"
                                onClick={() => download(r)}
                                disabled={downloading[r.id] !== undefined}
                                style={downloading[r.id] !== undefined ? { minWidth: 160 } : undefined}
                              >
                                {downloading[r.id] !== undefined ? (
                                  <span style={{ minWidth: 140, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <progress value={downloading[r.id]} max={100} style={{ width: 90, height: 8 }} />
                                    <span>{downloading[r.id]}%</span>
                                  </span>
                                ) : (
                                  'Download'
                                )}
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>{new Date(r.updatedAt).toLocaleString()}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={deletingId === r.id}
                              onClick={() => setDeleteConfirmId(r.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'documents' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Upload</h2>
              <form
                onSubmit={(e) => {
                  void submit(e, { categoryOverride: 'Document' });
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'minmax(180px, 1fr) minmax(220px, 1.2fr) minmax(240px, 1.2fr) auto',
                    gap: '0.75rem',
                    alignItems: 'flex-end',
                    paddingBottom: 22,
                  }}
                >
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Name *</label>
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Note</label>
                    <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0, position: 'relative' }}>
                    <label className="input-label">File (optional)</label>
                    <input
                      ref={fileInputRef}
                      className="input"
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        setFile(e.target.files?.[0] ?? null);
                        setUploadProgress(null);
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        className="btn file-picker-btn"
                        onClick={() => fileInputRef.current?.click()}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        Choose file
                      </button>
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'inline-block',
                          maxWidth: 170,
                        }}
                        title={file?.name || 'No file chosen'}
                      >
                        {file?.name || 'No file chosen'}
                      </span>
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        minHeight: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      <span>
                        {file
                          ? `Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB · Ext: ${
                              file.name.includes('.') ? `.${file.name.split('.').pop()}` : '—'
                            }`
                          : ''}
                      </span>
                      {uploadProgress !== null && file ? (
                        <span style={{ minWidth: 140, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <progress value={uploadProgress} max={100} style={{ width: 90, height: 8 }} />
                          <span>{uploadProgress}%</span>
                        </span>
                      ) : (
                        <span />
                      )}
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? '…' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Library</h2>
              <div className="table-wrap">
                {loading ? (
                  <p className="table-empty">Loading…</p>
                ) : rows.length === 0 ? (
                  <p className="table-empty">No internal documents.</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Note</th>
                        <th>View</th>
                        <th>Updated</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>{r.category ?? '—'}</td>
                          <td>{r.note ?? '—'}</td>
                          <td>
                            {r.filePath ? (
                              <button
                                type="button"
                                className="btn"
                                onClick={() => download(r)}
                                disabled={downloading[r.id] !== undefined}
                                style={downloading[r.id] !== undefined ? { minWidth: 160 } : undefined}
                              >
                                {downloading[r.id] !== undefined ? (
                                  <span style={{ minWidth: 140, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <progress value={downloading[r.id]} max={100} style={{ width: 90, height: 8 }} />
                                    <span>{downloading[r.id]}%</span>
                                  </span>
                                ) : (
                                  'Download'
                                )}
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>{new Date(r.updatedAt).toLocaleString()}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={deletingId === r.id}
                              onClick={() => setDeleteConfirmId(r.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'projectHistory' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>{projectEditingId ? 'Edit project' : 'Add project'}</h2>
              <form onSubmit={submitProjectHistory}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Client name *</label>
                    <input
                      className="input"
                      value={clientForm.clientName}
                      onChange={(e) => setClientForm((p) => ({ ...p, clientName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Company name *</label>
                    <input
                      className="input"
                      value={clientForm.companyName}
                      onChange={(e) => setClientForm((p) => ({ ...p, companyName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Client email</label>
                    <input
                      className="input"
                      type="email"
                      value={clientForm.clientEmail}
                      onChange={(e) => setClientForm((p) => ({ ...p, clientEmail: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Client mobile</label>
                    <input
                      className="input"
                      value={clientForm.clientMobile}
                      onChange={(e) => setClientForm((p) => ({ ...p, clientMobile: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Industry</label>
                    <input
                      className="input"
                      value={clientForm.industry}
                      onChange={(e) => setClientForm((p) => ({ ...p, industry: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Country</label>
                    <input
                      className="input"
                      value={clientForm.country}
                      onChange={(e) => setClientForm((p) => ({ ...p, country: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Status</label>
                    <select
                      className="input"
                      value={clientForm.status}
                      onChange={(e) =>
                        setClientForm((p) => ({ ...p, status: e.target.value === 'Inactive' ? 'Inactive' : 'Active' }))
                      }
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="input-label">Project description</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={clientForm.projectDescription}
                    onChange={(e) => setClientForm((p) => ({ ...p, projectDescription: e.target.value }))}
                  />
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Period of performance</label>
                    <input
                      className="input"
                      value={clientForm.periodOfPerformance}
                      onChange={(e) => setClientForm((p) => ({ ...p, periodOfPerformance: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Revenue</label>
                    <input
                      className="input"
                      value={clientForm.revenue}
                      onChange={(e) => setClientForm((p) => ({ ...p, revenue: e.target.value }))}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="submit" className="btn btn-primary" disabled={projectSubmitting}>
                    {projectSubmitting ? 'Saving…' : projectEditingId ? 'Update' : 'Add'}
                  </button>
                  {projectEditingId && (
                    <button type="button" className="btn btn-ghost" onClick={resetProjectForm}>
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Project history</h2>
              <div className="table-wrap" style={{ overflowX: 'auto' }}>
                {projectHistories.length === 0 ? (
                  <p className="table-empty">No project records yet.</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Client name</th>
                        <th>Company</th>
                        <th>Email</th>
                        <th>Mobile</th>
                        <th>Industry</th>
                        <th>Country</th>
                        <th>Project</th>
                        <th>Period</th>
                        <th>Revenue</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {projectHistories.map((r) => (
                        <tr key={r.id}>
                          <td>{r.projectCode}</td>
                          <td>{r.clientName}</td>
                          <td>{r.companyName}</td>
                          <td>{r.clientEmail ?? '—'}</td>
                          <td>{r.clientMobile ?? '—'}</td>
                          <td>{r.industry ?? '—'}</td>
                          <td>{r.country ?? '—'}</td>
                          <td style={{ maxWidth: 200, whiteSpace: 'pre-wrap' }}>{r.projectDescription ?? '—'}</td>
                          <td>{r.periodOfPerformance ?? '—'}</td>
                          <td>{r.revenue ?? '—'}</td>
                          <td>{r.status}</td>
                          <td>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEditProject(r)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={projectBusyId === r.id}
                              onClick={() => void deleteProjectHistory(r.id)}
                            >
                              {projectBusyId === r.id ? '…' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'profit' && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Profit by project</h2>
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              {profitRows.length === 0 ? (
                <p className="table-empty">No projects yet.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Company</th>
                      <th>Revenue</th>
                      <th>Costs</th>
                      <th>Profit</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitRows.map((r) => (
                      <tr key={r.projectId}>
                        <td>{r.projectCode}</td>
                        <td>{r.companyName}</td>
                        <td>{r.revenue ?? r.revenueAmount.toFixed(2)}</td>
                        <td>{r.costs.toFixed(2)}</td>
                        <td>{r.profit.toFixed(2)}</td>
                        <td>{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'commandMedia' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Add document</h2>
              <form onSubmit={submitCommandMedia}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '0.75rem',
                    alignItems: 'end',
                  }}
                >
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Document Number *</label>
                    <input
                      className="input"
                      value={commandMedia.documentNumber}
                      onChange={(e) => setCommandMedia((p) => ({ ...p, documentNumber: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Name *</label>
                    <input
                      className="input"
                      value={commandMedia.name}
                      onChange={(e) => setCommandMedia((p) => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Type *</label>
                    <select
                      className="input"
                      value={commandMedia.documentType}
                      onChange={(e) => setCommandMedia((p) => ({ ...p, documentType: e.target.value }))}
                    >
                      {COMMAND_MEDIA_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Revision</label>
                    <input
                      className="input"
                      value={commandMedia.revision}
                      onChange={(e) => setCommandMedia((p) => ({ ...p, revision: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">File (optional)</label>
                    <input
                      ref={commandMediaFileInputRef}
                      className="input"
                      type="file"
                      onChange={(e) => setCommandMedia((p) => ({ ...p, file: e.target.files?.[0] ?? null }))}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={commandMediaSubmitting}>
                    {commandMediaSubmitting ? 'Creating…' : 'Create'}
                  </button>
                </div>
                {commandMediaUploadProgress !== null && (
                  <div style={{ marginTop: 8, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                    Upload progress: {commandMediaUploadProgress}%
                  </div>
                )}
              </form>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Library</h2>
              <div className="table-wrap">
                {commandMediaRows.length === 0 ? (
                  <p className="table-empty">No documents.</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Number</th>
                        <th>Name</th>
                        <th>Revision</th>
                        <th>View</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {commandMediaRows.map((r) => (
                        <tr key={r.id}>
                          <td>{commandMediaTypeLabel(r.documentType)}</td>
                          <td>{r.documentNumber}</td>
                          <td>{r.name}</td>
                          <td>{r.revision ?? '—'}</td>
                          <td>
                            {r.filePath ? (
                              <button
                                type="button"
                                className="btn"
                                onClick={() => void downloadCommandMedia(r)}
                                disabled={commandMediaDownloading[r.id] !== undefined}
                                style={commandMediaDownloading[r.id] !== undefined ? { minWidth: 160 } : undefined}
                              >
                                {commandMediaDownloading[r.id] !== undefined ? (
                                  <span style={{ minWidth: 140, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <progress value={commandMediaDownloading[r.id]} max={100} style={{ width: 90, height: 8 }} />
                                    <span>{commandMediaDownloading[r.id]}%</span>
                                  </span>
                                ) : (
                                  'Download'
                                )}
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={commandMediaDeletingId === r.id}
                              onClick={() => setCommandMediaDeleteConfirmId(r.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete internal document"
        message="Delete this item? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (!deleteConfirmId) return;
          void remove(deleteConfirmId);
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
      <ConfirmDialog
        open={scheduleDeleteId !== null}
        title="Delete schedule row"
        message="Remove this planned shipment row?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (!scheduleDeleteId) return;
          void removeSchedule(scheduleDeleteId);
        }}
        onCancel={() => setScheduleDeleteId(null)}
      />
      <ConfirmDialog
        open={commandMediaDeleteConfirmId !== null}
        title="Delete document"
        message="Delete this document? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (!commandMediaDeleteConfirmId) return;
          void removeCommandMedia(commandMediaDeleteConfirmId);
        }}
        onCancel={() => setCommandMediaDeleteConfirmId(null)}
      />
    </div>
  );
}
