/**
 * Work Logs — own entries by default; Admin/QM can switch to all entries in the tables.
 * Full name is always taken from the account. Submitting creates a matching Labor Cost row.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError } from '../utils/apiHelpers';

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
  audit: { id: string; code: string } | null;
  shipmentId: string | null;
  shipment: { id: string; code: string | null } | null;
  projectHistoryId: string | null;
  projectHistory: { id: string; projectCode: string } | null;
  description: string | null;
  createdAt: string;
}

interface LaborCostRow {
  id: string;
  code: string;
  workLogId: string | null;
  workLog: { id: string; code: string; projectHistoryId: string | null } | null;
  projectHistoryId: string | null;
  projectHistory: { id: string; projectCode: string } | null;
  fullName: string;
  hours: number;
  rate: number;
  totalCost: number;
  paidStatus: 'Pending' | 'Paid';
  createdAt: string;
}

interface SupplierOption {
  id: string;
  code: string;
  name: string;
}

interface AuditOption {
  id: string;
  code: string;
}

interface ShipmentOption {
  id: string;
  code: string | null;
}

export function WorkLogs() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [workLogs, setWorkLogs] = useState<WorkLogRow[]>([]);
  const [laborCosts, setLaborCosts] = useState<LaborCostRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [audits, setAudits] = useState<AuditOption[]>([]);
  const [shipments, setShipments] = useState<ShipmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scopeAll, setScopeAll] = useState(false);

  const canViewAll = Boolean(
    user?.roleNames.includes('Admin') || user?.roleNames.includes('QualityManager')
  );

  const qs = scopeAll && canViewAll ? '?scope=all' : '';

  const selfLabel = useMemo(() => {
    const name = user?.name?.trim();
    return name || user?.email || '';
  }, [user?.email, user?.name]);

  const [form, setForm] = useState({
    workDate: '',
    hoursWorked: '',
    workType: 'Audit' as WorkLogRow['workType'],
    supplierId: '',
    auditId: '',
    shipmentId: '',
    description: '',
  });

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiJson<WorkLogRow[]>(`/work-logs${qs}`, { token }).catch(() => []),
      apiJson<LaborCostRow[]>(`/labor-costs${qs}`, { token }).catch(() => []),
      apiJson<SupplierOption[]>('/suppliers', { token }).catch(() => []),
      apiJson<AuditOption[]>('/audits', { token }).catch(() => []),
      apiJson<ShipmentOption[]>('/shipments', { token }).catch(() => []),
    ])
      .then(([logs, costs, supplierRows, auditRows, shipmentRows]) => {
        setWorkLogs(logs);
        setLaborCosts(costs);
        setSuppliers(supplierRows);
        setAudits(auditRows);
        setShipments(shipmentRows);
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token, qs]);

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
      setWorkLogs((prev) => [created, ...prev]);
      const costs = await apiJson<LaborCostRow[]>(`/labor-costs${qs}`, { token }).catch(() => []);
      setLaborCosts(costs);
      setForm({
        workDate: '',
        hoursWorked: '',
        workType: 'Audit',
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

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Work Logs</h1>
      </header>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Log time</h2>
          <p style={{ marginTop: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            Full name is taken from your account. Each entry creates a matching row under Labor Costs (Internal Management)
            using your profile hourly rate when your name matches an employee user.
          </p>
          {canViewAll && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: 'var(--text-sm)' }}>
              <input type="checkbox" checked={scopeAll} onChange={(e) => setScopeAll(e.target.checked)} />
              Show all users&apos; entries (Admin / Quality Manager)
            </label>
          )}
          {error && <div className="alert-error">{error}</div>}
          <form onSubmit={createWorkLog}>
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
                <label className="input-label">Supplier</label>
                <select className="input" value={form.supplierId} onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}>
                  <option value="">None</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
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
          </form>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>{scopeAll && canViewAll ? 'All work logs' : 'My work logs'}</h2>
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
                    <th>Type</th>
                    <th>Description</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {workLogs.map((r) => (
                    <tr key={r.id}>
                      <td>{r.code}</td>
                      <td>{r.fullName}</td>
                      <td>{r.workDate?.slice(0, 10) ?? '—'}</td>
                      <td>{r.hoursWorked}</td>
                      <td>{r.workType}</td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.description ?? ''}>
                        {r.description?.trim() ? r.description : '—'}
                      </td>
                      <td>{new Date(r.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>{scopeAll && canViewAll ? 'All labor cost lines (from logs)' : 'My labor cost lines'}</h2>
          <p style={{ marginTop: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Rows created automatically when you save a work log. Internal Management → Labor Costs lists all entries for admins.
          </p>
          <div className="table-wrap">
            {loading ? (
              <p className="table-empty">Loading…</p>
            ) : laborCosts.length === 0 ? (
              <p className="table-empty">No labor cost lines yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Cost ID</th>
                    <th>Log ID</th>
                    <th>Full name</th>
                    <th>Hours</th>
                    <th>Rate</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {laborCosts.map((r) => (
                    <tr key={r.id}>
                      <td>{r.code}</td>
                      <td>{r.workLog?.code ?? '—'}</td>
                      <td>{r.fullName}</td>
                      <td>{r.hours}</td>
                      <td>{r.rate}</td>
                      <td>{r.totalCost}</td>
                      <td>{r.paidStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
