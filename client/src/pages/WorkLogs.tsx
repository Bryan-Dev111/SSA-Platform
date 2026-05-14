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
import { formatUsd } from '../utils/formatUsd';

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
  supplierId?: string;
  projectHistoryId?: string | null;
  projectHistory?: { id: string; projectCode: string } | null;
}

interface ShipmentOption {
  id: string;
  code: string | null;
  supplierId?: string | null;
  projectHistory?: { id: string; projectCode: string } | null;
  resolvedProjectHistory?: { id: string; projectCode: string } | null;
}

interface EmployeeRatePreview {
  hourlyRate: number;
  currency: string | null;
}

const WORK_LOG_TYPES: WorkLogRow['workType'][] = ['Audit', 'Inspection', 'Travel', 'Admin', 'Other'];

function workLogTypeLabel(type: WorkLogRow['workType'], t: (key: string) => string): string {
  return t(`workLogs.type.${type}`);
}

function formatWorkLogTotalAmount(r: WorkLogRow): string {
  const raw = r.laborCosts?.[0]?.totalCost;
  return formatUsd(raw, '—');
}

function formatWorkLogSupplierCell(s: WorkLogRow['supplier']): string {
  if (!s) return '—';
  return `${s.code}: ${s.name}`;
}

export type WorkLogsVariant = 'page' | 'embedded' | 'globalSupplyTopRow';

export function WorkLogs({ variant = 'page' }: { variant?: WorkLogsVariant }) {
  const { token, user } = useAuth();
  const { t, locale } = useLanguage();
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
  });
  const [editingWorkLogId, setEditingWorkLogId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    workDate: '',
    workType: 'Audit' as WorkLogRow['workType'],
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const previewTotalCost = useMemo(() => {
    const raw = form.hoursWorked.trim();
    if (!raw || employeeRatePreview === null) return null;
    const hoursNum = Number(raw);
    if (!Number.isFinite(hoursNum) || hoursNum < 0) return null;
    return hoursNum * employeeRatePreview.hourlyRate;
  }, [form.hoursWorked, employeeRatePreview]);

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
      apiJson<EmployeeRatePreview>('/work-logs/preview-rate', { token }).catch(() => ({
        hourlyRate: 0,
        currency: null,
      })),
    ])
      .then(([logs, supplierRows, ratePreview]) => {
        setWorkLogs(logs);
        setSuppliers(supplierRows);
        setEmployeeRatePreview(ratePreview);
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token, qs, isGlobalSupplyTopRow]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token || isGlobalSupplyTopRow) return;
    const sid = form.supplierId.trim();
    const q = sid ? `?supplierId=${encodeURIComponent(sid)}` : '';
    let cancelled = false;
    Promise.all([
      apiJson<AuditOption[]>(`/audits${q}`, { token }).catch(() => []),
      apiJson<ShipmentOption[]>(`/shipments${q}`, { token }).catch(() => []),
    ]).then(([a, s]) => {
      if (!cancelled) {
        setAudits(a);
        setShipments(s);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token, form.supplierId, isGlobalSupplyTopRow]);

  const createWorkLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.workDate.trim() || !form.hoursWorked.trim()) return;
    if (!selfLabel.trim()) {
      toast.error(t('workLogs.toast.accountNoName'));
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
      });
      toast.success(t('workLogs.toast.savedWithLabor'));
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
          };
      const updated = await apiJson<WorkLogRow>(`/work-logs/${encodeURIComponent(editingWorkLogId)}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify(patchBody),
      });
      setWorkLogs((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setEditingWorkLogId(null);
      toast.success(t('workLogs.toastUpdated'));
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
          <h2 style={{ marginTop: 0 }}>{t('workLogs.logTime')}</h2>
          {canViewAll && !isGlobalSupplyTopRow && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: 'var(--text-sm)' }}>
              <input type="checkbox" checked={scopeAll} onChange={(e) => setScopeAll(e.target.checked)} />
              {t('workLogs.scopeAllLabel')}
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
                  <label className="input-label">{t('workLogs.fullName')}</label>
                  <input className="input" value={selfLabel || '—'} readOnly title={t('workLogs.takenFromAccount')} />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">{t('workLogs.date')}</label>
                  <input
                    className="input"
                    type="date"
                    value={form.workDate}
                    onChange={(e) => setForm((p) => ({ ...p, workDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">{t('workLogs.hoursWorked')}</label>
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
                  <label className="input-label">{t('workLogs.rate')}</label>
                  <input
                    className="input"
                    readOnly
                    value={
                      employeeRatePreview === null
                        ? t('common.loading')
                        : `${employeeRatePreview.hourlyRate.toFixed(2)}${
                            employeeRatePreview.currency ? ` ${employeeRatePreview.currency}` : ''
                          }`
                    }
                    title={t('workLogs.rateMatchTitle')}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">{t('workLogs.totalAmount')}</label>
                  <input
                    className="input"
                    readOnly
                    value={
                      employeeRatePreview === null
                        ? t('common.loading')
                        : previewTotalCost !== null
                          ? previewTotalCost.toFixed(2) +
                            (employeeRatePreview.currency ? ` ${employeeRatePreview.currency}` : '')
                          : '—'
                    }
                    title={t('workLogs.totalCalcTitle')}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={submitting || !selfLabel.trim()}>
                  {submitting ? t('common.saving') : t('workLogs.save')}
                </button>
              </div>
            ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.5rem', alignItems: 'end' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{t('workLogs.fullName')}</label>
                <input className="input" value={selfLabel || '—'} readOnly title={t('workLogs.takenFromAccount')} />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{t('workLogs.date')}</label>
                <input
                  className="input"
                  type="date"
                  value={form.workDate}
                  onChange={(e) => setForm((p) => ({ ...p, workDate: e.target.value }))}
                  required
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{t('workLogs.hoursWorked')}</label>
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
                <label className="input-label">{t('workLogs.rate')}</label>
                <input
                  className="input"
                  readOnly
                  value={
                    employeeRatePreview === null
                      ? t('common.loading')
                      : `${employeeRatePreview.hourlyRate.toFixed(2)}${
                          employeeRatePreview.currency ? ` ${employeeRatePreview.currency}` : ''
                        }`
                  }
                  title={t('workLogs.rateMatchTitle')}
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{t('workLogs.totalAmount')}</label>
                <input
                  className="input"
                  readOnly
                  value={
                    employeeRatePreview === null
                      ? t('common.loading')
                      : previewTotalCost !== null
                        ? previewTotalCost.toFixed(2) +
                          (employeeRatePreview.currency ? ` ${employeeRatePreview.currency}` : '')
                        : '—'
                  }
                  title={t('workLogs.totalCalcTitle')}
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{t('workLogs.workType')}</label>
                <select
                  className="input"
                  value={form.workType}
                  onChange={(e) => setForm((p) => ({ ...p, workType: e.target.value as WorkLogRow['workType'] }))}
                >
                  {WORK_LOG_TYPES.map((wt) => (
                    <option key={wt} value={wt}>
                      {workLogTypeLabel(wt, t)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{t('workLogs.fieldSupplier')}</label>
                <select
                  className="input"
                  value={form.supplierId}
                  onChange={(e) => {
                    const supplierId = e.target.value;
                    setForm((p) => ({ ...p, supplierId, auditId: '', shipmentId: '' }));
                  }}
                >
                  <option value="">{t('workLogs.optionNone')}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}: {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{t('workLogs.fieldAudit')}</label>
                <select
                  className="input"
                  value={form.auditId}
                  onChange={(e) => setForm((p) => ({ ...p, auditId: e.target.value }))}
                  title={
                    form.supplierId.trim()
                      ? t('workLogs.auditsForSupplierTitle')
                      : t('workLogs.selectSupplierAudits')
                  }
                >
                  <option value="">{t('workLogs.optionNone')}</option>
                  {audits.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{t('workLogs.fieldShipment')}</label>
                <select
                  className="input"
                  value={form.shipmentId}
                  onChange={(e) => setForm((p) => ({ ...p, shipmentId: e.target.value }))}
                  title={
                    form.supplierId.trim()
                      ? t('workLogs.shipmentsForSupplierTitle')
                      : t('workLogs.selectSupplierShipments')
                  }
                >
                  <option value="">{t('workLogs.optionNone')}</option>
                  {shipments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code ?? s.id}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting || !selfLabel.trim()}>
                {submitting ? t('common.saving') : t('workLogs.save')}
              </button>
            </div>
            )}
          </form>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>
            {isGlobalSupplyTopRow ? (
              t('workLogs.myWorkLogs')
            ) : scopeAll && canViewAll ? (
              t('workLogs.allWorkLogs')
            ) : (
              t('workLogs.myWorkLogs')
            )}
          </h2>
          <div className="table-wrap">
            {loading ? (
              <p className="table-empty">{t('common.loading')}</p>
            ) : workLogs.length === 0 ? (
              <p className="table-empty">{t('workLogs.empty')}</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('table.col.logId')}</th>
                    <th>{t('table.col.fullName')}</th>
                    <th>{t('table.col.date')}</th>
                    <th>{t('table.col.hours')}</th>
                    {!isGlobalSupplyTopRow ? (
                      <>
                        <th>{t('table.col.type')}</th>
                        <th>{t('table.col.totalAmount')}</th>
                        <th>{t('findings.col.supplier')}</th>
                        <th>{t('table.col.auditId')}</th>
                        <th>{t('table.col.shipmentId')}</th>
                      </>
                    ) : (
                      <th>{t('table.col.totalAmount')}</th>
                    )}
                    <th>{t('table.col.created')}</th>
                    {canEditWorkLogs ? <th>{t('table.col.edit')}</th> : null}
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
                          formatDisplayCalendarDate(r.workDate, locale)
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
                                {WORK_LOG_TYPES.map((wt) => (
                                  <option key={wt} value={wt}>
                                    {workLogTypeLabel(wt, t)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              workLogTypeLabel(r.workType, t)
                            )}
                          </td>
                          <td title={t('workLogs.totalFromLaborTitle')}>{formatWorkLogTotalAmount(r)}</td>
                          <td>{formatWorkLogSupplierCell(r.supplier)}</td>
                          <td>{r.audit?.code ?? r.auditId ?? '—'}</td>
                          <td>{r.shipment?.code ?? r.shipmentId ?? '—'}</td>
                        </>
                      ) : (
                        <td title={t('workLogs.totalFromLaborTitle')}>{formatWorkLogTotalAmount(r)}</td>
                      )}
                      <td>{formatDisplayCalendarDate(r.createdAt, locale)}</td>
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
                                {savingEdit ? t('common.saving') : t('common.save')}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={cancelEditWorkLog}
                                disabled={savingEdit}
                              >
                                {t('common.cancel')}
                              </button>
                            </span>
                          ) : (
                            <button type="button" className="btn btn-ghost" onClick={() => startEditWorkLog(r)}>
                              {t('table.col.edit')}
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
