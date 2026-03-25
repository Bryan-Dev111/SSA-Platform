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
  description: string | null;
  createdAt: string;
}

export function AdminWorkLogsPanel({ token }: { token: string | null }) {
  const [rows, setRows] = useState<WorkLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    apiJson<WorkLogRow[]>('/work-logs', { token })
      .then(setRows)
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="card">
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>Work Logs</h2>
        {error && <div className="alert-error">{error}</div>}
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
