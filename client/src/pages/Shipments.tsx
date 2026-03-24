/**
 * Day 10: Inspection requests + Admin schedule; metrics (OTD, FPY); Admin/QE record Passed/Failed.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError } from '../utils/apiHelpers';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface ShipmentRow {
  id: string;
  supplierId: string;
  purchaseOrder: string | null;
  partNumber: string | null;
  qty: number | null;
  inspectionDate: string | null;
  status: string;
  result: string | null;
  supplier: { id: string; code: string; name: string };
  createdAt?: string;
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

interface Metrics {
  totalInspectionRequests: number;
  waitingInspection: number;
  failed: number;
  overdueWaiting: number;
  lateVsSchedule: number;
  otdPercent: number | null;
  fpyPercent: number | null;
}

export function Shipments() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'supplier' | 'date' | 'status' | 'inspectionDate'>('inspectionDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const isAdmin = user?.roleNames?.includes('Admin') ?? false;
  const isQE = user?.roleNames?.includes('QualityEngineer') ?? false;
  const isSupplier = user?.roleNames?.includes('Supplier') ?? false;
  const canRecordResult = isAdmin || isQE;
  const [schedSupplier, setSchedSupplier] = useState('');
  const [schedPo, setSchedPo] = useState('');
  const [schedPart, setSchedPart] = useState('');
  const [schedQty, setSchedQty] = useState('');
  const [schedDate, setSchedDate] = useState('');
  const [schedNotes, setSchedNotes] = useState('');

  const loadAll = () => {
    if (!token) return;
    const q = filterSupplierId ? `?supplierId=${encodeURIComponent(filterSupplierId)}` : '';
    const mq = filterSupplierId ? `?supplierId=${encodeURIComponent(filterSupplierId)}` : '';
    Promise.all([
      apiJson<ShipmentRow[]>(`/shipments${q}`, { token }),
      apiJson<ScheduleRow[]>(`/shipment-schedule${q}`, { token }),
      apiJson<Metrics>(`/shipments/metrics${mq}`, { token }),
    ])
      .then(([s, sc, m]) => {
        setShipments(s);
        setSchedule(sc);
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
        case 'date':
          return r.createdAt ? new Date(r.createdAt).getTime() : 0;
        case 'status':
          return r.status;
        case 'inspectionDate':
          return r.inspectionDate ? new Date(r.inspectionDate).getTime() : 0;
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
      apiJson<ScheduleRow[]>(`/shipment-schedule${q}`, { token }),
      apiJson<Metrics>(`/shipments/metrics${mq}`, { token }),
    ])
      .then(([s, sc, m]) => {
        setShipments(s);
        setSchedule(sc);
        setMetrics(m);
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token, filterSupplierId]);

  const recordResult = async (id: string, result: 'Passed' | 'Failed') => {
    if (!token) return;
    setSavingId(id);
    try {
      await apiJson(`/shipments/${id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ result }),
      });
      toast.success(`Marked ${result}`);
      loadAll();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSavingId(null);
    }
  };

  const addSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !schedSupplier || !schedDate.trim()) return;
    try {
      await apiJson('/shipment-schedule', {
        token,
        method: 'POST',
        body: JSON.stringify({
          supplierId: schedSupplier,
          purchaseOrder: schedPo.trim() || null,
          partNumber: schedPart.trim() || null,
          qty: schedQty.trim() ? Number(schedQty) : null,
          scheduledDate: schedDate.trim(),
          notes: schedNotes.trim() || null,
        }),
      });
      toast.success('Schedule row added');
      setSchedPo('');
      setSchedPart('');
      setSchedQty('');
      setSchedDate('');
      setSchedNotes('');
      loadAll();
    } catch (e) {
      toast.error(parseApiError(e));
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!token || !confirm('Delete this schedule row?')) return;
    try {
      await apiJson(`/shipment-schedule/${id}`, { token, method: 'DELETE' });
      toast.success('Deleted');
      loadAll();
    } catch (e) {
      toast.error(parseApiError(e));
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
          Supplier inspection requests, admin shipment schedule, OTD vs schedule, and first-pass yield (FPY).
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
          <Metric label="Rejected (failed)" value={metrics.failed} />
          <Metric label="Overdue (waiting)" value={metrics.overdueWaiting} />
          <Metric label="Late vs schedule" value={metrics.lateVsSchedule} />
          <Metric label="OTD %" value={metrics.otdPercent != null ? `${metrics.otdPercent}%` : '—'} />
          <Metric label="FPY %" value={metrics.fpyPercent != null ? `${metrics.fpyPercent}%` : '—'} />
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Inspection requests</h2>
          <div className="table-wrap">
            {shipments.length === 0 ? (
              <p className="table-empty">No inspection requests.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('supplier')}>Supplier {sortIndicator('supplier')}</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('date')}>Date {sortIndicator('date')}</th>
                    <th>PO</th>
                    <th>Part #</th>
                    <th>Qty</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('inspectionDate')}>Inspection date {sortIndicator('inspectionDate')}</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('status')}>Status {sortIndicator('status')}</th>
                    <th>Result</th>
                    {canRecordResult ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {sortedShipments.map((r) => (
                    <tr key={r.id}>
                      <td>{r.supplier?.code ?? '—'}</td>
                      <td>{r.createdAt?.slice(0, 10) ?? '—'}</td>
                      <td>{r.purchaseOrder ?? '—'}</td>
                      <td>{r.partNumber ?? '—'}</td>
                      <td>{r.qty ?? '—'}</td>
                      <td>{r.inspectionDate?.slice(0, 10) ?? '—'}</td>
                      <td>{r.status}</td>
                      <td>{r.result ?? '—'}</td>
                      {canRecordResult ? (
                        <td>
                          {r.status === 'WaitingInspection' ? (
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
                                onClick={() => recordResult(r.id, 'Passed')}
                              >
                                Pass
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger"
                                style={{ fontSize: 'var(--text-sm)', padding: '0.35rem 0.65rem' }}
                                disabled={savingId === r.id}
                                onClick={() => recordResult(r.id, 'Failed')}
                              >
                                Fail
                              </button>
                            </span>
                          ) : (
                            '—'
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

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Shipment schedule</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Load planned shipments for OTD comparison (same supplier, PO, and part # as inspection requests).
          </p>
          {isAdmin && (
            <form onSubmit={addSchedule} style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '0.75rem',
                  alignItems: 'flex-end',
                }}
              >
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Supplier *</label>
                  <select
                    className="input"
                    required
                    value={schedSupplier}
                    onChange={(e) => setSchedSupplier(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">PO</label>
                  <input className="input" value={schedPo} onChange={(e) => setSchedPo(e.target.value)} />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Part #</label>
                  <input className="input" value={schedPart} onChange={(e) => setSchedPart(e.target.value)} />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Qty</label>
                  <input className="input" type="number" min={0} value={schedQty} onChange={(e) => setSchedQty(e.target.value)} />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Scheduled date *</label>
                  <input
                    className="input"
                    type="date"
                    required
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Notes</label>
                  <input className="input" value={schedNotes} onChange={(e) => setSchedNotes(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary">
                  Add row
                </button>
              </div>
            </form>
          )}
          <div className="table-wrap">
            {schedule.length === 0 ? (
              <p className="table-empty">No schedule rows.</p>
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
                    {isAdmin ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((r) => (
                    <tr key={r.id}>
                      <td>{r.supplier?.code ?? '—'}</td>
                      <td>{r.purchaseOrder ?? '—'}</td>
                      <td>{r.partNumber ?? '—'}</td>
                      <td>{r.qty ?? '—'}</td>
                      <td>{r.scheduledDate?.slice(0, 10) ?? '—'}</td>
                      <td>{r.notes ?? '—'}</td>
                      {isAdmin ? (
                        <td>
                          <button type="button" className="btn btn-danger" onClick={() => deleteSchedule(r.id)}>
                            Delete
                          </button>
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
