import { useEffect, useState } from 'react';
import { apiJson } from '../../api/client';
import { parseApiError } from '../../utils/apiHelpers';
import { formatUsd } from '../../utils/formatUsd';

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

function formatLaborCostDate(r: LaborCostRow): string {
  const w = r.workLog?.workDate;
  if (w) return w.slice(0, 10);
  return r.createdAt.slice(0, 10);
}

export function AdminLaborCostsPanel({
  token,
  listScope = 'mine',
}: {
  token: string | null;
  /** Internal Management lists all rows; default API returns only the current user’s rows. */
  listScope?: 'mine' | 'all';
}) {
  const [rows, setRows] = useState<LaborCostRow[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLogOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiJson<LaborCostRow[]>(`/labor-costs${qs}`, { token }),
      apiJson<WorkLogOption[]>(`/work-logs${qs}`, { token }).catch(() => []),
      apiJson<ProjectOption[]>('/project-history', { token }).catch(() => []),
      apiJson<UserOption[]>('/users', { token }).catch(() => []),
    ])
      .then(([costs, logs, proj, users]) => {
        setRows(costs);
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
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setPatchingId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>Labor Costs</h2>
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={createCost} style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.5rem', alignItems: 'end' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Log ID</label>
              <select className="input" value={form.workLogId} onChange={(e) => setForm((p) => ({ ...p, workLogId: e.target.value }))}>
                <option value="">None</option>
                {workLogs.map((w) => (
                  <option key={w.id} value={w.id}>{w.code}</option>
                ))}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Project</label>
              <select className="input" value={form.projectHistoryId} onChange={(e) => setForm((p) => ({ ...p, projectHistoryId: e.target.value }))}>
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.projectCode} — {p.companyName}</option>
                ))}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Full Name</label>
              <input className="input" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} required />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Hours</label>
              <input className="input" type="number" min={0} step="0.01" value={form.hours} onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))} required />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Rate (USD / hr)</label>
              <input className="input" type="number" min={0} step="0.01" value={form.rate} onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))} required />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Paid Status</label>
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
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create Cost'}</button>
          </div>
        </form>
        <div className="table-wrap">
          {loading ? (
            <p className="table-empty">Loading labor costs…</p>
          ) : rows.length === 0 ? (
            <p className="table-empty">No labor costs yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Cost ID</th>
                  <th>Log ID</th>
                  <th>Project</th>
                  <th>Date</th>
                  <th>Full Name</th>
                  <th>Hours</th>
                  <th>Rate (USD)</th>
                  <th>Total cost (USD)</th>
                  <th>Paid Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.code}</td>
                    <td>{r.workLog?.code ?? r.workLogId ?? '—'}</td>
                    <td>{r.projectHistory?.projectCode ?? r.projectHistoryId ?? r.workLog?.projectHistoryId ?? '—'}</td>
                    <td title={r.workLog?.workDate ? 'Work log date' : 'Created date'}>{formatLaborCostDate(r)}</td>
                    <td>{r.fullName}</td>
                    <td>{r.hours}</td>
                    <td>{formatUsd(r.rate)}</td>
                    <td>{formatUsd(r.totalCost)}</td>
                    <td>{r.paidStatus}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.paidStatus === 'Pending' ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={patchingId === r.id}
                            onClick={() => patchPaidStatus(r.id, 'Paid')}
                          >
                            {patchingId === r.id ? '…' : 'Mark paid'}
                          </button>{' '}
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            disabled={patchingId === r.id}
                            onClick={() => patchPaidStatus(r.id, 'Rejected')}
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        '—'
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
