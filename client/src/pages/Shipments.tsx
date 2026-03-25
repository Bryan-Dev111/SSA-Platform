/**
 * Shipments: review / approve / reject supplier inspection requests (metrics + table only).
 * Scheduling lives under Internal Management (Admin).
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError } from '../utils/apiHelpers';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface ShipmentRow {
  id: string;
  code: string | null;
  supplierId: string;
  purchaseOrder: string | null;
  partNumber: string | null;
  lot: string | null;
  qty: number | null;
  inspectionDate: string | null;
  status: string;
  result: string | null;
  inspector: string | null;
  notes: string | null;
  supplier: { id: string; code: string; name: string };
  updatedAt?: string;
  createdAt?: string;
}

interface Metrics {
  totalInspectionRequests: number;
  waitingInspection: number;
  passed: number;
  failed: number;
  overdueWaiting: number;
  lateVsSchedule: number;
  otdPercent: number | null;
  fpyPercent: number | null;
  scheduleRowCount?: number;
}

export function Shipments() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'supplier' | 'scheduled' | 'status'>('scheduled');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [approveConfirmId, setApproveConfirmId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; note: string } | null>(null);

  const isAdmin = user?.roleNames?.includes('Admin') ?? false;
  const isQE = user?.roleNames?.includes('QualityEngineer') ?? false;
  const isQM = user?.roleNames?.includes('QualityManager') ?? false;
  const isSupplier = user?.roleNames?.includes('Supplier') ?? false;
  const canReview = isAdmin || isQE;
  const canEditInspector = isAdmin || isQE || isQM;

  const [inspectorDrafts, setInspectorDrafts] = useState<Record<string, string>>({});

  const initializeInspectorDrafts = (list: ShipmentRow[]) => {
    const next: Record<string, string> = {};
    for (const s of list) next[s.id] = s.inspector ?? '';
    setInspectorDrafts(next);
  };

  const loadData = () => {
    if (!token) return;
    const q = filterSupplierId ? `?supplierId=${encodeURIComponent(filterSupplierId)}` : '';
    const mq = filterSupplierId ? `?supplierId=${encodeURIComponent(filterSupplierId)}` : '';
    Promise.all([
      apiJson<ShipmentRow[]>(`/shipments${q}`, { token }),
      apiJson<Metrics>(`/shipments/metrics${mq}`, { token }),
    ])
      .then(([s, m]) => {
        setShipments(s);
        initializeInspectorDrafts(s);
        setMetrics(m);
      })
      .catch((e) => setError(parseApiError(e)));
  };

  const sortedShipments = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const getValue = (r: ShipmentRow): string | number => {
      switch (sortBy) {
        case 'supplier':
          return `${r.supplier.code} ${r.supplier.name}`;
        case 'scheduled':
          return r.inspectionDate ? new Date(r.inspectionDate).getTime() : 0;
        case 'status':
          return r.status;
      }
    };
    return [...shipments].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [shipments, sortBy, sortDir]);

  const onSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('asc');
    }
  };
  const sortIndicator = (key: typeof sortBy) => (sortBy !== key ? '▲▼' : sortDir === 'asc' ? '↑' : '↓');

  useEffect(() => {
    if (!token) return;
    apiJson<Supplier[]>('/suppliers', { token })
      .then((list) => {
        setSuppliers(list);
        if (isSupplier && list.length === 1) setFilterSupplierId(list[0].id);
      })
      .catch(() => setSuppliers([]));
  }, [token, isSupplier]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const q = filterSupplierId ? `?supplierId=${encodeURIComponent(filterSupplierId)}` : '';
    const mq = filterSupplierId ? `?supplierId=${encodeURIComponent(filterSupplierId)}` : '';
    Promise.all([
      apiJson<ShipmentRow[]>(`/shipments${q}`, { token }),
      apiJson<Metrics>(`/shipments/metrics${mq}`, { token }),
    ])
      .then(([s, m]) => {
        setShipments(s);
        initializeInspectorDrafts(s);
        setMetrics(m);
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token, filterSupplierId]);

  const recordApprove = async () => {
    if (!token || !approveConfirmId) return;
    setSavingId(approveConfirmId);
    try {
      const inspectorRaw = inspectorDrafts[approveConfirmId] ?? '';
      const inspector = inspectorRaw.trim() || null;
      await apiJson(`/shipments/${approveConfirmId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ result: 'Passed', inspector }),
      });
      toast.success('Approved (Passed)');
      setApproveConfirmId(null);
      loadData();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSavingId(null);
    }
  };

  const recordReject = async () => {
    if (!token || !rejectDialog) return;
    setSavingId(rejectDialog.id);
    try {
      const inspectorRaw = inspectorDrafts[rejectDialog.id] ?? '';
      const inspector = inspectorRaw.trim() || null;
      await apiJson(`/shipments/${rejectDialog.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          result: 'Failed',
          notes: rejectDialog.note.trim() || null,
          inspector,
        }),
      });
      toast.success('Rejected (Failed)');
      setRejectDialog(null);
      loadData();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSavingId(null);
    }
  };

  if (!token) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Shipments</h1>
        </header>
        <p className="table-empty">Sign in to view shipments.</p>
      </div>
    );
  }

  if (loading && !metrics) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Shipments</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Shipments</h1>
        <p className="page-description">
          Shipment inspection requests: review outcomes (Admin / Quality Engineer). Suppliers submit requests from Supplier Profile;
          admins schedule inspections in Internal Management.
        </p>
      </header>

      {!isSupplier && suppliers.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <div className="input-group" style={{ maxWidth: 360, marginBottom: 0 }}>
              <label className="input-label">Filter by supplier</label>
              <select
                className="input"
                value={filterSupplierId}
                onChange={(e) => setFilterSupplierId(e.target.value)}
              >
                <option value="">All in scope</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {error && <div className="alert-error">{error}</div>}

      {metrics && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}
        >
          <Metric label="Total requests" value={metrics.totalInspectionRequests} />
          <Metric label="Waiting inspection" value={metrics.waitingInspection} />
          <Metric label="Passed" value={metrics.passed ?? 0} />
          <Metric label="Failed" value={metrics.failed} />
          <Metric label="Overdue (waiting)" value={metrics.overdueWaiting} />
          <Metric label="Late vs schedule" value={metrics.lateVsSchedule} />
          <Metric label="OTD %" value={metrics.otdPercent != null ? `${metrics.otdPercent}%` : '—'} />
          <Metric label="FPY %" value={metrics.fpyPercent != null ? `${metrics.fpyPercent}%` : '—'} />
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Shipment inspection requests</h2>
          <div className="table-wrap">
            {shipments.length === 0 ? (
              <p className="table-empty">No inspection requests.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('supplier')}>
                      Supplier {sortIndicator('supplier')}
                    </th>
                    <th>P.O.</th>
                    <th>Lot</th>
                    <th>Part Number</th>
                    <th>Quantity</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('scheduled')}>
                      Requested Inspection Date {sortIndicator('scheduled')}
                    </th>
                    <th>Inspector</th>
                    <th>Approval</th>
                    <th>Approval Date</th>
                    <th>Approve/Reject Button</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedShipments.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.code ?? '—'}</div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                          {r.supplier?.code ?? '—'} — {r.supplier?.name ?? ''}
                        </div>
                      </td>
                      <td>{r.purchaseOrder ?? '—'}</td>
                      <td>{r.lot ?? '—'}</td>
                      <td>{r.partNumber ?? '—'}</td>
                      <td>{r.qty ?? '—'}</td>
                      <td>{r.inspectionDate?.slice(0, 10) ?? '—'}</td>

                      <td>
                        {canEditInspector && r.status === 'WaitingInspection' ? (
                          <input
                            className="input"
                            value={inspectorDrafts[r.id] ?? ''}
                            placeholder="Inspector"
                            disabled={savingId === r.id}
                            onChange={(e) => {
                              const next = e.target.value;
                              setInspectorDrafts((d) => ({ ...d, [r.id]: next }));
                            }}
                            onBlur={async () => {
                              if (!token) return;
                              const raw = inspectorDrafts[r.id] ?? '';
                              const inspector = raw.trim() || null;
                              if (inspector === (r.inspector ?? null)) return;
                              if (savingId === r.id) return;

                              setSavingId(r.id);
                              try {
                                await apiJson(`/shipments/${r.id}`, {
                                  token,
                                  method: 'PATCH',
                                  body: JSON.stringify({ inspector }),
                                });
                                toast.success('Inspector updated');
                                loadData();
                              } catch (e) {
                                toast.error(parseApiError(e));
                              } finally {
                                setSavingId(null);
                              }
                            }}
                            style={{ width: 180 }}
                          />
                        ) : (
                          <span style={{ color: r.inspector ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                            {r.inspector ?? '—'}
                          </span>
                        )}
                      </td>

                      <td>{r.status === 'Passed' ? 'Approved' : r.status === 'Failed' ? 'Rejected' : '—'}</td>
                      <td>{r.status === 'WaitingInspection' ? '—' : r.updatedAt?.slice(0, 10) ?? '—'}</td>

                      <td>
                        {canReview && r.status === 'WaitingInspection' ? (
                          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn"
                              style={{
                                fontSize: 'var(--text-sm)',
                                padding: '0.35rem 0.65rem',
                                background: 'var(--color-success)',
                                color: '#fff',
                              }}
                              disabled={savingId === r.id}
                              onClick={() => setApproveConfirmId(r.id)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              style={{ fontSize: 'var(--text-sm)', padding: '0.35rem 0.65rem' }}
                              disabled={savingId === r.id}
                              onClick={() => setRejectDialog({ id: r.id, note: '' })}
                            >
                              Reject
                            </button>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>—</span>
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

      <ConfirmDialog
        open={approveConfirmId !== null}
        title="Approve inspection"
        message="Mark this shipment inspection as passed?"
        confirmLabel="Approve"
        onConfirm={recordApprove}
        onCancel={() => setApproveConfirmId(null)}
      />

      <ConfirmDialog
        open={rejectDialog !== null}
        title="Reject inspection"
        message={
          rejectDialog ? (
            <div>
              <p style={{ margin: '0 0 0.75rem' }}>Mark this request as failed (rejected)?</p>
              <label className="input-label" htmlFor="reject-note">
                Note (optional)
              </label>
              <textarea
                id="reject-note"
                className="input"
                rows={3}
                value={rejectDialog.note}
                onChange={(e) => setRejectDialog((d) => (d ? { ...d, note: e.target.value } : null))}
                placeholder="Reason for rejection…"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
          ) : (
            ''
          )
        }
        confirmLabel="Reject"
        variant="danger"
        onConfirm={recordReject}
        onCancel={() => setRejectDialog(null)}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <div className="card-body" style={{ padding: '0.75rem' }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{label}</div>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  );
}
