import { useEffect, useState } from 'react';
import { apiJson } from '../../api/client';
import { parseApiError } from '../../utils/apiHelpers';

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

interface UserOption {
  id: string;
  name: string | null;
  email: string;
  isEmployee?: boolean;
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

interface ProjectOption {
  id: string;
  projectCode: string;
  companyName: string;
}

export function AdminWorkLogsPanel({ token }: { token: string | null }) {
  const [rows, setRows] = useState<WorkLogRow[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; label: string }>>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [audits, setAudits] = useState<AuditOption[]>([]);
  const [shipments, setShipments] = useState<ShipmentOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    workDate: '',
    hoursWorked: '',
    workType: 'Audit' as WorkLogRow['workType'],
    supplierId: '',
    auditId: '',
    shipmentId: '',
    projectHistoryId: '',
    description: '',
  });

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiJson<WorkLogRow[]>('/work-logs', { token }),
      apiJson<UserOption[]>('/users', { token }).catch(() => []),
      apiJson<SupplierOption[]>('/suppliers', { token }).catch(() => []),
      apiJson<AuditOption[]>('/audits', { token }).catch(() => []),
      apiJson<ShipmentOption[]>('/shipments', { token }).catch(() => []),
      apiJson<ProjectOption[]>('/project-history', { token }).catch(() => []),
    ])
      .then(([logs, users, supplierRows, auditRows, shipmentRows, projectRows]) => {
        setRows(logs);
        setEmployees(
          users
            .filter((u) => u.isEmployee)
            .map((u) => ({
              id: u.id,
              label: u.name?.trim() || u.email,
            }))
            .sort((a, b) => a.label.localeCompare(b.label))
        );
        setSuppliers(supplierRows);
        setAudits(auditRows);
        setShipments(shipmentRows);
        setProjects(projectRows);
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token]);

  const createWorkLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.fullName.trim() || !form.workDate.trim() || !form.hoursWorked.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiJson<WorkLogRow>('/work-logs', {
        token,
        method: 'POST',
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          workDate: form.workDate,
          hoursWorked: Number(form.hoursWorked),
          workType: form.workType,
          supplierId: form.supplierId || null,
          auditId: form.auditId || null,
          shipmentId: form.shipmentId || null,
          projectHistoryId: form.projectHistoryId || null,
          description: form.description.trim() || null,
        }),
      });
      setRows((prev) => [created, ...prev]);
      setForm({
        fullName: '',
        workDate: '',
        hoursWorked: '',
        workType: 'Audit',
        supplierId: '',
        auditId: '',
        shipmentId: '',
        projectHistoryId: '',
        description: '',
      });
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>Work Logs</h2>
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={createWorkLog} style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.5rem', alignItems: 'end' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Full Name</label>
              <select className="input" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} required>
                <option value="">Select employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.label}>{emp.label}</option>
                ))}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Date</label>
              <input className="input" type="date" value={form.workDate} onChange={(e) => setForm((p) => ({ ...p, workDate: e.target.value }))} required />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Hours Worked</label>
              <input className="input" type="number" min={0} step="0.01" value={form.hoursWorked} onChange={(e) => setForm((p) => ({ ...p, hoursWorked: e.target.value }))} required />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Work Type</label>
              <select className="input" value={form.workType} onChange={(e) => setForm((p) => ({ ...p, workType: e.target.value as WorkLogRow['workType'] }))}>
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
                  <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                ))}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Audit</label>
              <select className="input" value={form.auditId} onChange={(e) => setForm((p) => ({ ...p, auditId: e.target.value }))}>
                <option value="">None</option>
                {audits.map((a) => (
                  <option key={a.id} value={a.id}>{a.code}</option>
                ))}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Shipment</label>
              <select className="input" value={form.shipmentId} onChange={(e) => setForm((p) => ({ ...p, shipmentId: e.target.value }))}>
                <option value="">None</option>
                {shipments.map((s) => (
                  <option key={s.id} value={s.id}>{s.code ?? s.id}</option>
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
            <div className="input-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label className="input-label">Description</label>
              <input className="input" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create Work Log'}</button>
          </div>
        </form>
        <div className="table-wrap">
          {loading ? (
            <p className="table-empty">Loading work logs…</p>
          ) : rows.length === 0 ? (
            <p className="table-empty">No work logs yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>Full Name</th>
                  <th>Date</th>
                  <th>Hours Worked</th>
                  <th>Work Type</th>
                  <th>Supplier ID</th>
                  <th>Supplier Name</th>
                  <th>Audit ID</th>
                  <th>Shipment ID</th>
                  <th>Project</th>
                  <th>Description</th>
                  <th>Created at</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.code}</td>
                    <td>{r.fullName}</td>
                    <td>{r.workDate?.slice(0, 10) ?? '—'}</td>
                    <td>{r.hoursWorked}</td>
                    <td>{r.workType}</td>
                    <td>{r.supplier?.code ?? r.supplierId ?? '—'}</td>
                    <td>{r.supplier?.name ?? '—'}</td>
                    <td>{r.audit?.code ?? r.auditId ?? '—'}</td>
                    <td>{r.shipment?.code ?? r.shipmentId ?? '—'}</td>
                    <td>{r.projectHistory?.projectCode ?? r.projectHistoryId ?? '—'}</td>
                    <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.description ?? ''}>
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
  );
}
