/**
 * Work Logs — own entries by default; Admin/QM can switch to all entries in the tables.
 * Full name is always taken from the account. Submitting still creates a matching labor cost on the server.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError } from '../utils/apiHelpers';
import { formatDisplayCalendarDate } from '../utils/formatDisplayDates';

interface WorkLogRow {
  id: string;
  code: string;
  fullName: string;
  workDate: string;
  hoursWorked: number;
  workType: 'Audit' | 'Inspection' | 'Travel' | 'Admin' | 'Other';
  supplierId: string | null;
  supplier: { id: string; code: string; name: string } | null;
  auditId: string | null;
  audit: {
    id: string;
    code: string;
    projectHistoryId?: string | null;
    projectHistory?: { id: string; projectCode: string } | null;
  } | null;
  shipmentId: string | null;
  shipment: {
    id: string;
    code: string | null;
    projectHistory?: { id: string; projectCode: string } | null;
    resolvedProjectHistory?: { id: string; projectCode: string } | null;
  } | null;
  projectHistoryId: string | null;
  projectHistory: { id: string; projectCode: string } | null;
  description: string | null;
  createdAt: string;
  /** Auto-created labor line when the log is saved (used for Total Amount on Global Supply work logs). */
  laborCosts?: { totalCost: number }[];
}

interface SupplierOption {
  id: string;
  code: string;
  name: string;
}

interface AuditOption {
  id: string;
  code: string;
  projectHistoryId?: string | null;
  projectHistory?: { id: string; projectCode: string } | null;
}

interface ShipmentOption {
  id: string;
  code: string | null;
  projectHistory?: { id: string; projectCode: string } | null;
  resolvedProjectHistory?: { id: string; projectCode: string } | null;
}

interface EmployeeRatePreview {
  hourlyRate: number;
  currency: string | null;
}

function formatWorkLogTotalAmount(r: WorkLogRow): string {
  const raw = r.laborCosts?.[0]?.totalCost;
  if (raw == null || !Number.isFinite(Number(raw))) return '—';
  return Number(raw).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export type WorkLogsVariant = 'page' | 'embedded' | 'globalSupplyTopRow';

export function WorkLogs({ variant = 'page' }: { variant?: WorkLogsVariant }) {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const isGlobalSupplyTopRow = variant === 'globalSupplyTopRow';
  const [workLogs, setWorkLogs] = useState<WorkLogRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [audits, setAudits] = useState<AuditOption[]>([]);
  const [shipments, setShipments] = useState<ShipmentOption[]>([]);
  const [employeeRatePreview, setEmployeeRatePreview] = useState<EmployeeRatePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scopeAll, setScopeAll] = useState(false);

  const canViewAll = Boolean(
    user?.roleNames.includes('Admin') || user?.roleNames.includes('QualityManager')
  );
  const canEditWorkLogs = Boolean(user?.roleNames.includes('Admin'));

  /** Self scope on Global Supply top row; elsewhere, optional all-users scope for Admin/QM. */
  const qs = !isGlobalSupplyTopRow && scopeAll && canViewAll ? '?scope=all' : '';

  const selfLabel = useMemo(() => {
    const name = user?.name?.trim();
    return name || user?.email || '';
  }, [user?.email, user?.name]);

  const [form, setForm] = useState({
    workDate: '',
    hoursWorked: '',
    workType: (variant === 'globalSupplyTopRow' ? 'Other' : 'Audit') as WorkLogRow['workType'],
    supplierId: '',
    auditId: '',
    shipmentId: '',
    description: '',
  });
  const [editingWorkLogId, setEditingWorkLogId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    workDate: '',
    workType: 'Audit' as WorkLogRow['workType'],
    description: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const previewTotalCost = useMemo(() => {
    const raw = form.hoursWorked.trim();
    if (!raw || employeeRatePreview === null) return null;
    const hoursNum = Number(raw);
    if (!Number.isFinite(hoursNum) || hoursNum < 0) return null;
    return hoursNum * employeeRatePreview.hourlyRate;
  }, [form.hoursWorked, employeeRatePreview]);

  const derivedProjectLabel = useMemo(() => {
    if (form.auditId) {
      const a = audits.find((x) => x.id === form.auditId);
      return a?.projectHistory?.projectCode ?? '—';
    }
    if (form.shipmentId) {
      const s = shipments.find((x) => x.id === form.shipmentId);
      const ph = s?.projectHistory ?? s?.resolvedProjectHistory;
      return ph?.projectCode ?? '—';
    }
    return '—';
  }, [form.auditId, form.shipmentId, audits, shipments]);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    if (isGlobalSupplyTopRow) {
      Promise.all([
        apiJson<WorkLogRow[]>(`/work-logs${qs}`, { token }).catch(() => []),
        apiJson<EmployeeRatePreview>('/work-logs/preview-rate', { token }).catch(() => ({
          hourlyRate: 0,
          currency: null,
        })),
      ])
        .then(([logs, ratePreview]) => {
          setWorkLogs(logs);
          setSuppliers([]);
          setAudits([]);
          setShipments([]);
          setEmployeeRatePreview(ratePreview);
        })
        .catch((e) => setError(parseApiError(e)))
        .finally(() => setLoading(false));
      return;
    }
    Promise.all([
      apiJson<WorkLogRow[]>(`/work-logs${qs}`, { token }).catch(() => []),
      apiJson<SupplierOption[]>('/suppliers', { token }).catch(() => []),
      apiJson<AuditOption[]>('/audits', { token }).catch(() => []),
      apiJson<ShipmentOption[]>('/shipments', { token }).catch(() => []),
      apiJson<EmployeeRatePreview>('/work-logs/preview-rate', { token }).catch(() => ({
        hourlyRate: 0,
        currency: null,
      })),
    ])
      .then(([logs, supplierRows, auditRows, shipmentRows, ratePreview]) => {
        setWorkLogs(logs);
        setSuppliers(supplierRows);
        setAudits(auditRows);
        setShipments(shipmentRows);
        setEmployeeRatePreview(ratePreview);
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token, qs, isGlobalSupplyTopRow]);

  useEffect(() => {
    load();
  }, [load]);

  const createWorkLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.workDate.trim() || !form.hoursWorked.trim()) return;
    if (!selfLabel.trim()) {
      toast.error('Your account has no name or email; add a name in your profile.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiJson<WorkLogRow>('/work-logs', {
        token,
        method: 'POST',
        body: JSON.stringify({
          workDate: form.workDate,
          hoursWorked: Number(form.hoursWorked),
          workType: form.workType,
          supplierId: form.supplierId || null,
          auditId: form.auditId || null,
          shipmentId: form.shipmentId || null,
          description: form.description.trim() || null,
        }),
      });
      if (!isGlobalSupplyTopRow) {
        setWorkLogs((prev) => [created, ...prev]);
      } else {
        const logs = await apiJson<WorkLogRow[]>(`/work-logs${qs}`, { token }).catch(() => []);
        setWorkLogs(logs);
      }
      setForm({
        workDate: '',
        hoursWorked: '',
        workType: isGlobalSupplyTopRow ? 'Other' : 'Audit',
        supplierId: '',
        auditId: '',
        shipmentId: '',
        description: '',
      });
      toast.success('Work log saved — a labor cost line was added automatically.');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const startEditWorkLog = (row: WorkLogRow) => {
    setEditingWorkLogId(row.id);
    setEditForm({
      workDate: row.workDate?.slice(0, 10) ?? '',
      workType: row.workType,
      description: row.description ?? '',
    });
  };

  const cancelEditWorkLog = () => {
    setEditingWorkLogId(null);
    setSavingEdit(false);
  };

  const saveEditWorkLog = async () => {
    if (!token || !editingWorkLogId || !editForm.workDate.trim()) return;
    setSavingEdit(true);
    try {
      const patchBody = isGlobalSupplyTopRow
        ? { workDate: editForm.workDate }
        : {
            workDate: editForm.workDate,
            workType: editForm.workType,
            description: editForm.description.trim() || null,
          };
      const updated = await apiJson<WorkLogRow>(`/work-logs/${encodeURIComponent(editingWorkLogId)}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify(patchBody),
      });
      setWorkLogs((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setEditingWorkLogId(null);
      toast.success('Work log updated');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const body = (
    <>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Log Time</h2>
          {canViewAll && !isGlobalSupplyTopRow && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: 'var(--text-sm)' }}>
              <input type="checkbox" checked={scopeAll} onChange={(e) => setScopeAll(e.target.checked)} />
              Show all users&apos; entries (Admin / Quality Manager)
            </label>
          )}
          {error && <div className="alert-error">{error}</div>}
          <form onSubmit={createWorkLog}>
            {isGlobalSupplyTopRow ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '0.5rem',
                  alignItems: 'end',
                }}
              >
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Full name</label>
                  <input className="input" value={selfLabel || '—'} readOnly title="Taken from your account" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Date</label>
                  <input
                    className="input"
                    type="date"
                    value={form.workDate}
                    onChange={(e) => setForm((p) => ({ ...p, workDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Hours worked</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.hoursWorked}
                    onChange={(e) => setForm((p) => ({ ...p, hoursWorked: e.target.value }))}
                    required
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Rate</label>
                  <input
                    className="input"
                    readOnly
                    value={
                      employeeRatePreview === null
                        ? 'Loading…'
                        : `${employeeRatePreview.hourlyRate.toFixed(2)}${
                            employeeRatePreview.currency ? ` ${employeeRatePreview.currency}` : ''
                          }`
                    }
                    title="Matched by your account name or email to an employee user’s hourly rate"
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Total Amount</label>
                  <input
                    className="input"
                    readOnly
                    value={
                      employeeRatePreview === null
                        ? 'Loading…'
                        : previewTotalCost !== null
                          ? previewTotalCost.toFixed(2) +
                            (employeeRatePreview.currency ? ` ${employeeRatePreview.currency}` : '')
                          : '—'
                    }
                    title="Hours × rate (same calculation as the labor cost row when you save)"
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={submitting || !selfLabel.trim()}>
                  {submitting ? 'Saving…' : 'Save work log'}
                </button>
              </div>
            ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.5rem', alignItems: 'end' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Full name</label>
                <input className="input" value={selfLabel || '—'} readOnly title="Taken from your account" />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Date</label>
                <input
                  className="input"
                  type="date"
                  value={form.workDate}
                  onChange={(e) => setForm((p) => ({ ...p, workDate: e.target.value }))}
                  required
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Hours worked</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.hoursWorked}
                  onChange={(e) => setForm((p) => ({ ...p, hoursWorked: e.target.value }))}
                  required
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Rate</label>
                <input
                  className="input"
                  readOnly
                  value={
                    employeeRatePreview === null
                      ? 'Loading…'
                      : `${employeeRatePreview.hourlyRate.toFixed(2)}${
                          employeeRatePreview.currency ? ` ${employeeRatePreview.currency}` : ''
                        }`
                  }
                  title="Matched by your account name or email to an employee user’s hourly rate"
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Total Amount</label>
                <input
                  className="input"
                  readOnly
                  value={
                    employeeRatePreview === null
                      ? 'Loading…'
                      : previewTotalCost !== null
                        ? previewTotalCost.toFixed(2) +
                          (employeeRatePreview.currency ? ` ${employeeRatePreview.currency}` : '')
                        : '—'
                  }
                  title="Hours × rate (same calculation as the labor cost row when you save)"
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Work type</label>
                <select
                  className="input"
                  value={form.workType}
                  onChange={(e) => setForm((p) => ({ ...p, workType: e.target.value as WorkLogRow['workType'] }))}
                >
                  <option value="Audit">Audit</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Travel">Travel</option>
                  <option value="Admin">Admin</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Project</label>
                <input className="input" readOnly value={derivedProjectLabel} title="Filled when you select an audit or shipment" />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Supplier</label>
                <select className="input" value={form.supplierId} onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}>
                  <option value="">None</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}: {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Audit</label>
                <select className="input" value={form.auditId} onChange={(e) => setForm((p) => ({ ...p, auditId: e.target.value }))}>
                  <option value="">None</option>
                  {audits.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Shipment</label>
                <select className="input" value={form.shipmentId} onChange={(e) => setForm((p) => ({ ...p, shipmentId: e.target.value }))}>
                  <option value="">None</option>
                  {shipments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code ?? s.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                <label className="input-label">Description</label>
                <input className="input" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting || !selfLabel.trim()}>
                {submitting ? 'Saving…' : 'Save work log'}
              </button>
            </div>
            )}
          </form>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>
            {isGlobalSupplyTopRow
              ? 'My Work Logs'
              : scopeAll && canViewAll
                ? 'All Work Logs'
                : 'My Work Logs'}
          </h2>
          <div className="table-wrap">
            {loading ? (
              <p className="table-empty">Loading…</p>
            ) : workLogs.length === 0 ? (
              <p className="table-empty">No work logs yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Log ID</th>
                    <th>Full name</th>
                    <th>Date</th>
                    <th>Hours</th>
                    {!isGlobalSupplyTopRow ? (
                      <>
                        <th>Type</th>
                        <th>Description</th>
                      </>
                    ) : (
                      <th>Total Amount</th>
                    )}
                    <th>Created</th>
                    {canEditWorkLogs ? <th>Edit</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {workLogs.map((r) => (
                    <tr key={r.id}>
                      <td>{r.code}</td>
                      <td>{r.fullName}</td>
                      <td>
                        {editingWorkLogId === r.id ? (
                          <input
                            className="input"
                            type="date"
                            value={editForm.workDate}
                            onChange={(e) => setEditForm((p) => ({ ...p, workDate: e.target.value }))}
                          />
                        ) : (
                          formatDisplayCalendarDate(r.workDate)
                        )}
                      </td>
                      <td>{r.hoursWorked}</td>
                      {!isGlobalSupplyTopRow ? (
                        <>
                          <td>
                            {editingWorkLogId === r.id ? (
                              <select
                                className="input"
                                value={editForm.workType}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, workType: e.target.value as WorkLogRow['workType'] }))
                                }
                              >
                                <option value="Audit">Audit</option>
                                <option value="Inspection">Inspection</option>
                                <option value="Travel">Travel</option>
                                <option value="Admin">Admin</option>
                                <option value="Other">Other</option>
                              </select>
                            ) : (
                              r.workType
                            )}
                          </td>
                          <td
                            style={{
                              maxWidth: 220,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={r.description ?? ''}
                          >
                            {editingWorkLogId === r.id ? (
                              <input
                                className="input"
                                value={editForm.description}
                                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                              />
                            ) : r.description?.trim() ? (
                              r.description
                            ) : (
                              '—'
                            )}
                          </td>
                        </>
                      ) : (
                        <td title="From linked labor cost (hours × rate at save time)">{formatWorkLogTotalAmount(r)}</td>
                      )}
                      <td>{formatDisplayCalendarDate(r.createdAt)}</td>
                      {canEditWorkLogs ? (
                        <td>
                          {editingWorkLogId === r.id ? (
                            <span style={{ display: 'inline-flex', gap: '0.4rem' }}>
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => void saveEditWorkLog()}
                                disabled={savingEdit}
                              >
                                {savingEdit ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={cancelEditWorkLog}
                                disabled={savingEdit}
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button type="button" className="btn btn-ghost" onClick={() => startEditWorkLog(r)}>
                              Edit
                            </button>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );

  if (variant === 'embedded') {
    return <div className="work-logs-embedded">{body}</div>;
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{t('nav.workLogs')}</h1>
      </header>
      {body}
    </div>
  );
}
