import { useEffect, useState } from 'react';
import { apiJson } from '../../api/client';
import { parseApiError } from '../../utils/apiHelpers';

interface LaborCostRow {
  id: string;
  code: string;
  workLogId: string | null;
  workLog: { id: string; code: string } | null;
  fullName: string;
  hours: number;
  rate: number;
  totalCost: number;
  paidStatus: 'Pending' | 'Paid';
  createdAt: string;
}

export function AdminLaborCostsPanel({ token }: { token: string | null }) {
  const [rows, setRows] = useState<LaborCostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    apiJson<LaborCostRow[]>('/labor-costs', { token })
      .then(setRows)
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="card">
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>Labor Costs</h2>
        {error && <div className="alert-error">{error}</div>}
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
                  <th>Full Name</th>
                  <th>Hours</th>
                  <th>Rate</th>
                  <th>Total Cost</th>
                  <th>Paid Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.code}</td>
                    <td>{r.workLog?.code ?? r.workLogId ?? '—'}</td>
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
  );
}
