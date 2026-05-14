import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { apiJson } from '../../api/client';
import { parseApiError } from '../../utils/apiHelpers';
import { formatUsd } from '../../utils/formatUsd';
import { formatDisplayCalendarDate } from '../../utils/formatDisplayDates';
import { MetricCard } from '../../components/MetricCard';

interface LaborCostRow {
  id: string;
  code: string;
  workLogId: string | null;
  workLog: { id: string; code: string; projectHistoryId: string | null; workDate: string } | null;
  projectHistoryId: string | null;
  projectHistory: { id: string; projectCode: string } | null;
  fullName: string;
  hours: number;
  rate: number;
  totalCost: number;
  paidStatus: 'Pending' | 'Paid' | 'Rejected';
  createdAt: string;
}

interface WorkLogOption {
  id: string;
  code: string;
  fullName: string;
  hoursWorked: number;
  projectHistoryId: string | null;
}

interface ProjectOption {
  id: string;
  projectCode: string;
  companyName: string;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
  isEmployee?: boolean;
  hourlyRate?: number | null;
}

interface LaborCostOpenSummary {
  openCount: number;
  openTotalUsd: number;
}

function formatLaborCostDate(r: LaborCostRow): string {
  const w = r.workLog?.workDate;
  if (w) return formatDisplayCalendarDate(w);
  return formatDisplayCalendarDate(r.createdAt);
}

function LaborCostRateField({
  row,
  disabled,
  onCommit,
}: {
  row: LaborCostRow;
  disabled: boolean;
  onCommit: (id: string, rate: number) => void | Promise<void>;
}) {
  const { t } = useLanguage();
  const [val, setVal] = useState(() => String(row.rate));
  useEffect(() => {
    setVal(String(row.rate));
  }, [row.rate, row.id]);

  if (row.paidStatus !== 'Pending') {
    return <span>{formatUsd(row.rate)}</span>;
  }

  return (
    <input
      type="number"
      min={0}
      step="0.01"
      className="input"
      style={{ maxWidth: '7.5rem', marginBottom: 0 }}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        const n = Number(val);
        if (!Number.isFinite(n) || n < 0) {
          setVal(String(row.rate));
          return;
        }
        if (Math.abs(n - row.rate) > 1e-6) void onCommit(row.id, n);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      disabled={disabled}
      title={t('laborCosts.titleRateUsdBlur')}
      aria-label={t('laborCosts.ariaRateUsd', { code: row.code })}
    />
  );
}

export function AdminLaborCostsPanel({
  token,
  listScope = 'mine',
}: {
  token: string | null;
  /** Internal Management lists all rows; default API returns only the current user’s rows. */
  listScope?: 'mine' | 'all';
}) {
  const { t } = useLanguage();
  const dash = t('internal.scheduleAudit.dash');
  const busyLabel = t('documents.btn.submittingShort');
  const [rows, setRows] = useState<LaborCostRow[]>([]);
  const [openSummary, setOpenSummary] = useState<LaborCostOpenSummary | null>(null);
  const [workLogs, setWorkLogs] = useState<WorkLogOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    workLogId: '',
    projectHistoryId: '',
    fullName: '',
    hours: '',
    rate: '',
  });
  const [employeeRateByName, setEmployeeRateByName] = useState<Record<string, number>>({});
  const [form, setForm] = useState({
    workLogId: '',
    projectHistoryId: '',
    fullName: '',
    hours: '',
    rate: '',
    paidStatus: 'Pending' as 'Pending' | 'Paid' | 'Rejected',
  });

  const qs = listScope === 'all' ? '?scope=all' : '';

  const refreshOpenSummary = useCallback(async () => {
    if (!token) return;
    try {
      const s = await apiJson<LaborCostOpenSummary>(`/labor-costs/open-summary${qs}`, { token });
      setOpenSummary(s);
    } catch {
      /* keep prior summary on transient errors */
    }
  }, [token, qs]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiJson<LaborCostRow[]>(`/labor-costs${qs}`, { token }),
      apiJson<LaborCostOpenSummary>(`/labor-costs/open-summary${qs}`, { token }).catch(() => null),
      apiJson<WorkLogOption[]>(`/work-logs${qs}`, { token }).catch(() => []),
      apiJson<ProjectOption[]>('/project-history', { token }).catch(() => []),
      apiJson<UserOption[]>('/users?scope=sentinel', { token }).catch(() => []),
    ])
      .then(([costs, summary, logs, proj, users]) => {
        setRows(costs);
        setOpenSummary(summary ?? null);
        setWorkLogs(logs);
        setProjects(proj);
        const next: Record<string, number> = {};
        for (const u of users) {
          const label = u.name?.trim() || u.email;
          if (u.isEmployee && typeof u.hourlyRate === 'number' && Number.isFinite(u.hourlyRate)) {
            next[label.toLowerCase()] = u.hourlyRate;
          }
        }
        setEmployeeRateByName(next);
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token, qs]);

  useEffect(() => {
    if (!form.workLogId) return;
    const selected = workLogs.find((w) => w.id === form.workLogId);
    if (!selected) return;
    const key = selected.fullName.trim().toLowerCase();
    const employeeRate = employeeRateByName[key];
    setForm((prev) => ({
      ...prev,
      fullName: selected.fullName,
      hours: String(selected.hoursWorked),
      rate: typeof employeeRate === 'number' ? String(employeeRate) : prev.rate,
      projectHistoryId: prev.projectHistoryId || selected.projectHistoryId || '',
    }));
  }, [form.workLogId, workLogs, employeeRateByName]);

  const createCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.fullName.trim() || !form.hours.trim() || !form.rate.trim()) return;
    setSubmitting(true);
    try {
      const created = await apiJson<LaborCostRow>('/labor-costs', {
        token,
        method: 'POST',
        body: JSON.stringify({
          workLogId: form.workLogId || null,
          projectHistoryId: form.projectHistoryId || null,
          fullName: form.fullName.trim(),
          hours: Number(form.hours),
          rate: Number(form.rate),
          paidStatus: form.paidStatus,
        }),
      });
      setRows((prev) => [created, ...prev]);
      void refreshOpenSummary();
      setForm({
        workLogId: '',
        projectHistoryId: '',
        fullName: '',
        hours: '',
        rate: '',
        paidStatus: 'Pending',
      });
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const patchPaidStatus = async (id: string, paidStatus: 'Paid' | 'Rejected') => {
    if (!token) return;
    setPatchingId(id);
    setError(null);
    try {
      const updated = await apiJson<LaborCostRow>(`/labor-costs/${encodeURIComponent(id)}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ paidStatus }),
      });
      setRows((prev) => prev.map((row) => (row.id === id ? updated : row)));
      void refreshOpenSummary();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setPatchingId(null);
    }
  };

  const patchRate = async (id: string, rate: number) => {
    if (!token) return;
    setPatchingId(id);
    setError(null);
    try {
      const updated = await apiJson<LaborCostRow>(`/labor-costs/${encodeURIComponent(id)}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ rate }),
      });
      setRows((prev) => prev.map((row) => (row.id === id ? updated : row)));
      void refreshOpenSummary();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setPatchingId(null);
    }
  };

  const startEdit = (row: LaborCostRow) => {
    setEditingId(row.id);
    setEditForm({
      workLogId: row.workLogId ?? '',
      projectHistoryId: row.projectHistoryId ?? '',
      fullName: row.fullName,
      hours: String(row.hours),
      rate: String(row.rate),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    if (!token) return;
    const hours = Number(editForm.hours);
    const rate = Number(editForm.rate);
    if (!editForm.fullName.trim()) {
      setError(t('laborCosts.errorFullNameRequired'));
      return;
    }
    if (!Number.isFinite(hours) || hours < 0) {
      setError(t('laborCosts.errorHoursNonNeg'));
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      setError(t('laborCosts.errorRateNonNeg'));
      return;
    }
    setPatchingId(id);
    setError(null);
    try {
      const updated = await apiJson<LaborCostRow>(`/labor-costs/${encodeURIComponent(id)}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          workLogId: editForm.workLogId || null,
          projectHistoryId: editForm.projectHistoryId || null,
          fullName: editForm.fullName.trim(),
          hours,
          rate,
        }),
      });
      setRows((prev) => prev.map((row) => (row.id === id ? updated : row)));
      setEditingId(null);
      void refreshOpenSummary();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setPatchingId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>{t('laborCosts.title')}</h2>
        <div
          className="dashboard-metric-grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            marginBottom: '1rem',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
          }}
        >
          <MetricCard
            title={t('laborCosts.metricOpenCount')}
            value={openSummary == null ? dash : openSummary.openCount}
          />
          <MetricCard
            title={t('laborCosts.metricOpenValue')}
            value={openSummary == null ? dash : formatUsd(openSummary.openTotalUsd)}
          />
        </div>
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={createCost} style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.5rem', alignItems: 'end' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{t('laborCosts.labelLogId')}</label>
              <select className="input" value={form.workLogId} onChange={(e) => setForm((p) => ({ ...p, workLogId: e.target.value }))}>
                <option value="">{t('laborCosts.optionNone')}</option>
                {workLogs.map((w) => (
                  <option key={w.id} value={w.id}>{w.code}</option>
                ))}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{t('laborCosts.labelProject')}</label>
              <select className="input" value={form.projectHistoryId} onChange={(e) => setForm((p) => ({ ...p, projectHistoryId: e.target.value }))}>
                <option value="">{t('laborCosts.optionNone')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.projectCode} — {p.companyName}</option>
                ))}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{t('laborCosts.labelFullName')}</label>
              <input className="input" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} required />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{t('laborCosts.labelHours')}</label>
              <input className="input" type="number" min={0} step="0.01" value={form.hours} onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))} required />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{t('laborCosts.labelRateUsd')}</label>
              <input className="input" type="number" min={0} step="0.01" value={form.rate} onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))} required />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{t('laborCosts.labelPaidStatus')}</label>
              <select
                className="input"
                value={form.paidStatus}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    paidStatus:
                      e.target.value === 'Paid'
                        ? 'Paid'
                        : e.target.value === 'Rejected'
                          ? 'Rejected'
                          : 'Pending',
                  }))
                }
              >
                <option value="Pending">{t('laborCosts.paidStatus.Pending')}</option>
                <option value="Paid">{t('laborCosts.paidStatus.Paid')}</option>
                <option value="Rejected">{t('laborCosts.paidStatus.Rejected')}</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('laborCosts.btnCreating') : t('laborCosts.btnCreate')}
            </button>
          </div>
        </form>
        <div className="table-wrap">
          {loading ? (
            <p className="table-empty">{t('laborCosts.loading')}</p>
          ) : rows.length === 0 ? (
            <p className="table-empty">{t('laborCosts.empty')}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('table.col.costId')}</th>
                  <th>{t('table.col.logId')}</th>
                  <th>{t('table.col.project')}</th>
                  <th>{t('table.col.date')}</th>
                  <th>{t('table.col.fullName')}</th>
                  <th>{t('table.col.hours')}</th>
                  <th>{t('table.col.rateUsd')}</th>
                  <th>{t('table.col.totalCostUsd')}</th>
                  <th>{t('table.col.paidStatus')}</th>
                  <th>{t('table.col.actions')}</th>
                  <th>{t('table.col.edit')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.code}</td>
                    <td>
                      {editingId === r.id ? (
                        <select
                          className="input"
                          value={editForm.workLogId}
                          onChange={(e) => setEditForm((p) => ({ ...p, workLogId: e.target.value }))}
                        >
                          <option value="">{t('laborCosts.optionNone')}</option>
                          {workLogs.map((w) => (
                            <option key={w.id} value={w.id}>{w.code}</option>
                          ))}
                        </select>
                      ) : (
                        r.workLog?.code ?? r.workLogId ?? dash
                      )}
                    </td>
                    <td>
                      {editingId === r.id ? (
                        <select
                          className="input"
                          value={editForm.projectHistoryId}
                          onChange={(e) => setEditForm((p) => ({ ...p, projectHistoryId: e.target.value }))}
                        >
                          <option value="">{t('laborCosts.optionNone')}</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>{p.projectCode} — {p.companyName}</option>
                          ))}
                        </select>
                      ) : (
                        r.projectHistory?.projectCode ?? r.projectHistoryId ?? r.workLog?.projectHistoryId ?? dash
                      )}
                    </td>
                    <td title={r.workLog?.workDate ? t('laborCosts.titleWorkLogDate') : t('laborCosts.titleCreatedDate')}>{formatLaborCostDate(r)}</td>
                    <td>
                      {editingId === r.id ? (
                        <input
                          className="input"
                          value={editForm.fullName}
                          onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                        />
                      ) : (
                        r.fullName
                      )}
                    </td>
                    <td>
                      {editingId === r.id ? (
                        <input
                          className="input"
                          type="number"
                          min={0}
                          step="0.01"
                          value={editForm.hours}
                          onChange={(e) => setEditForm((p) => ({ ...p, hours: e.target.value }))}
                        />
                      ) : (
                        r.hours
                      )}
                    </td>
                    <td>
                      {editingId === r.id ? (
                        <input
                          className="input"
                          type="number"
                          min={0}
                          step="0.01"
                          value={editForm.rate}
                          onChange={(e) => setEditForm((p) => ({ ...p, rate: e.target.value }))}
                        />
                      ) : (
                        <LaborCostRateField row={r} disabled={patchingId === r.id} onCommit={patchRate} />
                      )}
                    </td>
                    <td>{formatUsd(r.totalCost)}</td>
                    <td>
                      {r.paidStatus === 'Pending'
                        ? t('laborCosts.paidStatus.Pending')
                        : r.paidStatus === 'Paid'
                          ? t('laborCosts.paidStatus.Paid')
                          : t('laborCosts.paidStatus.Rejected')}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.paidStatus === 'Pending' ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={patchingId === r.id}
                            onClick={() => patchPaidStatus(r.id, 'Paid')}
                          >
                            {patchingId === r.id ? busyLabel : t('laborCosts.btnMarkPaid')}
                          </button>{' '}
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            disabled={patchingId === r.id}
                            onClick={() => patchPaidStatus(r.id, 'Rejected')}
                          >
                            {t('laborCosts.btnReject')}
                          </button>
                        </>
                      ) : (
                        dash
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.paidStatus === 'Paid' ? (
                        editingId === r.id ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={patchingId === r.id}
                              onClick={() => void saveEdit(r.id)}
                            >
                              {patchingId === r.id ? busyLabel : t('common.save')}
                            </button>{' '}
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              disabled={patchingId === r.id}
                              onClick={cancelEdit}
                            >
                              {t('common.cancel')}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            disabled={patchingId !== null}
                            onClick={() => startEdit(r)}
                          >
                            {t('common.edit')}
                          </button>
                        )
                      ) : (
                        dash
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
