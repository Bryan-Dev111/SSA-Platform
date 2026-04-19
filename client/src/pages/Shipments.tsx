/**
 * Shipments: review / approve / reject supplier inspection requests (metrics + table only).
 * Scheduling lives under Internal Management (Admin).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError, downloadWithAuthProgress } from '../utils/apiHelpers';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ShipmentMetricAlertIcon } from '../components/ShipmentMetricAlertIcon';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface InspectorOption {
  id: string;
  name: string;
  email: string;
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
  records?: Array<{ id: string; name: string; hasFile: boolean }>;
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
  /** Populated server-side for each shipment counted in lateVsSchedule */
  lateDetails?: Array<{ purchaseOrder: string | null; qty: number | null }>;
  /** Waiting inspection past requested date (same as overdueWaiting count). */
  overdueDetails?: Array<{ purchaseOrder: string | null; qty: number | null }>;
  /** Schedules where shipped quantity is less than planned after scheduled date. */
  shortDeliveries?: number;
  shortDeliveryDetails?: Array<{
    purchaseOrder: string | null;
    partNumber: string | null;
    missingQty: number;
  }>;
  otdPercent: number | null;
  fpyPercent: number | null;
  scheduleRowCount?: number;
}

function openShipmentRequestsSubtitle(m: Metrics): string {
  const overdue = m.overdueWaiting ?? 0;
  const waiting = m.waitingInspection ?? 0;
  if (waiting === 0) return 'No open requests';
  if (overdue === 0) return 'Waiting inspection';
  const notOverdue = waiting - overdue;
  // Align with Dashboard: same overdue count as `shipmentOverdue` (inspection past requested date).
  const waitingLabel =
    notOverdue === 1 ? '1 waiting inspection' : `${notOverdue} waiting inspections`;
  return `${waitingLabel} · ${overdue} overdue`;
}

function onTimeDeliverySubtitle(m: Metrics): string {
  const lateVs = m.lateVsSchedule ?? 0;
  const qtyShort = m.shortDeliveries ?? 0;
  if (lateVs <= 0 && qtyShort <= 0) return 'No late vs schedule';
  const parts: string[] = [];
  if (lateVs > 0) parts.push(`${lateVs} late vs schedule`);
  if (qtyShort > 0) parts.push(`${qtyShort} qty short vs plan`);
  return parts.join(' · ');
}

const SHIPMENT_TABLE_STATUS_RANK: Record<string, number> = {
  WaitingInspection: 0,
  Passed: 1,
  Failed: 2,
};

function openShipmentRequestsAlertProps(m: Metrics):
  | {
      shortDeliveries: number;
      shortDetails: Array<{
        purchaseOrder: string | null;
        partNumber: string | null;
        missingQty: number;
      }>;
      lateVsSchedule: number;
      lateVsScheduleDetails: Array<{ purchaseOrder: string | null; qty: number | null }>;
    }
  | undefined {
  const qtyShort = m.shortDeliveries ?? 0;
  const lateVs = m.lateVsSchedule ?? 0;
  if (qtyShort <= 0 && lateVs <= 0) return undefined;
  return {
    shortDeliveries: qtyShort,
    shortDetails: m.shortDeliveryDetails ?? [],
    lateVsSchedule: lateVs,
    lateVsScheduleDetails: m.lateDetails ?? [],
  };
}

export function Shipments() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inspectors, setInspectors] = useState<InspectorOption[]>([]);
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<
    | 'code'
    | 'supplier'
    | 'purchaseOrder'
    | 'partNumber'
    | 'qty'
    | 'lot'
    | 'scheduled'
    | 'inspector'
    | 'status'
    | 'notes'
    | 'approvalDate'
    | 'records'
    | 'created'
  >('scheduled');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [downloadingRecord, setDownloadingRecord] = useState<Record<string, boolean>>({});

  const [approveConfirmId, setApproveConfirmId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; note: string } | null>(null);

  const isAdmin = user?.roleNames?.includes('Admin') ?? false;
  const isQE = user?.roleNames?.includes('QualityEngineer') ?? false;
  const isQM = user?.roleNames?.includes('QualityManager') ?? false;
  const isSupplier = user?.roleNames?.includes('Supplier') ?? false;
  const canReview = isAdmin || isQE || isQM;
  const canEditInspector = isAdmin || isQE || isQM;
  const canCreateFinding = (user?.roleNames ?? []).some((r) =>
    ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor'].includes(r)
  );
  const canAttachRecord =
    !isSupplier &&
    (isAdmin ||
      isQE ||
      isQM ||
      user?.roleNames?.includes('Auditor') ||
      user?.roleNames?.includes('Buyer'));

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
        case 'code':
          return r.code ?? '';
        case 'supplier':
          return `${r.supplier.code} ${r.supplier.name}`;
        case 'purchaseOrder':
          return r.purchaseOrder ?? '';
        case 'partNumber':
          return r.partNumber ?? '';
        case 'qty':
          return typeof r.qty === 'number' ? r.qty : -1;
        case 'lot':
          return r.lot ?? '';
        case 'scheduled':
          return r.inspectionDate ? new Date(r.inspectionDate).getTime() : 0;
        case 'inspector':
          return r.inspector ?? '';
        case 'status':
          return SHIPMENT_TABLE_STATUS_RANK[r.status] ?? 99;
        case 'notes':
          return r.notes?.trim() ?? '';
        case 'approvalDate':
          return r.status === 'WaitingInspection' ? 0 : r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
        case 'records':
          return r.records?.length ?? 0;
        case 'created':
          return r.createdAt ? new Date(r.createdAt).getTime() : 0;
      }
    };
    return [...shipments].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [shipments, sortBy, sortDir]);

  const partTrend = useMemo(() => {
    const monthMap = new Map<string, { label: string; parts: Map<string, number> }>();
    const totalByPart = new Map<string, number>();
    for (const s of shipments) {
      // Match server metrics: only approved (Passed) quantities count toward shipped volume vs schedule.
      if (s.status !== 'Passed') continue;
      const qty = typeof s.qty === 'number' ? s.qty : 0;
      const baseDate = s.inspectionDate ?? s.createdAt ?? null;
      const d = baseDate ? new Date(baseDate) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
      const part = s.partNumber?.trim() || 'Unspecified';
      const month = monthMap.get(monthKey) ?? { label: monthLabel, parts: new Map<string, number>() };
      month.parts.set(part, (month.parts.get(part) ?? 0) + qty);
      monthMap.set(monthKey, month);
      totalByPart.set(part, (totalByPart.get(part) ?? 0) + qty);
    }
    const months = [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([, v]) => v);
    const parts = [...totalByPart.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([part]) => part);
    const rows = months.map((m) => ({
      month: m.label,
      values: parts.map((p) => m.parts.get(p) ?? 0),
    }));
    const maxQty = Math.max(1, ...rows.flatMap((r) => r.values));
    const yTickSteps = 4;
    const yTicks = Array.from({ length: yTickSteps + 1 }, (_, i) =>
      Math.round((maxQty * (yTickSteps - i)) / yTickSteps)
    );
    return { parts, rows, maxQty, yTicks };
  }, [shipments]);

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
        else if (!isSupplier && list.length === 1) setFilterSupplierId((cur) => cur || list[0].id);
      })
      .catch(() => setSuppliers([]));
  }, [token, isSupplier]);

  useEffect(() => {
    if (!token || !canEditInspector) {
      setInspectors([]);
      return;
    }
    apiJson<{ list: InspectorOption[] }>('/shipments/inspectors', { token })
      .then((r) => setInspectors(r.list ?? []))
      .catch(() => setInspectors([]));
  }, [token, canEditInspector]);

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

  const downloadRecord = async (recordId: string, recordName: string) => {
    if (!token) return;
    try {
      setDownloadingRecord((prev) => ({ ...prev, [recordId]: true }));
      await downloadWithAuthProgress(`/records/${recordId}/download`, token, recordName, () => {});
      toast.success('Record download completed');
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDownloadingRecord((prev) => {
        const next = { ...prev };
        delete next[recordId];
        return next;
      });
    }
  };

  const recordApprove = async () => {
    if (!token || !approveConfirmId) return;
    const targetId = approveConfirmId;
    // UX requirement: close modal immediately, then run approval.
    setApproveConfirmId(null);
    setSavingId(targetId);
    try {
      const inspectorRaw = inspectorDrafts[targetId] ?? '';
      const inspector = inspectorRaw.trim() || null;
      await apiJson(`/shipments/${targetId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ result: 'Passed', inspector }),
      });
      toast.success('Approved (Passed)');
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
      </header>

      {!isSupplier && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <div className="input-group" style={{ maxWidth: 360, marginBottom: 0 }}>
              <label className="input-label">Filter by supplier</label>
              {suppliers.length > 0 ? (
                <select
                  className="input"
                  value={filterSupplierId}
                  onChange={(e) => setFilterSupplierId(e.target.value)}
                >
                  <option value="">All in scope</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}: {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  No suppliers are linked to your account for shipments. An administrator can assign you to suppliers
                  in Internal Management → Employee Assignments (employee/contractor → supplier), then sign out and
                  back in if needed.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <div className="alert-error">{error}</div>}

      {metrics && (
        <div
          className="shipments-metrics-kpi-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            overflow: 'visible',
          }}
        >
          <Metric
            label="Total Requests"
            value={metrics.totalInspectionRequests}
            subtitle={`FPY ${metrics.fpyPercent != null ? `${metrics.fpyPercent}%` : '—'}`}
          />
          <Metric
            label="Open Shipment Requests"
            value={metrics.waitingInspection}
            subtitle={openShipmentRequestsSubtitle(metrics)}
          />
          <Metric
            label="On-Time Delivery"
            value={metrics.otdPercent != null ? `${metrics.otdPercent}%` : '—'}
            subtitle={onTimeDeliverySubtitle(metrics)}
            openShipmentRequestsAlert={openShipmentRequestsAlertProps(metrics)}
          />
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0, marginBottom: '1rem', textAlign: 'center' }}>Part Quantity by Month</h2>
          {partTrend.rows.length === 0 || partTrend.parts.length === 0 ? (
            <p className="table-empty">No shipment quantity trend data.</p>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  gap: '0.9rem',
                  marginBottom: '0.85rem',
                  fontSize: 'var(--text-sm)',
                }}
              >
                {partTrend.parts.map((part, idx) => (
                  <span key={part} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: ['#2563eb', '#7c3aed', '#ea580c', '#16a34a'][idx % 4],
                      }}
                    />
                    {part}
                  </span>
                ))}
              </div>
              <div className="table-wrap">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: '0.35rem',
                    minWidth: 680,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      flexShrink: 0,
                      paddingBottom: 28,
                    }}
                    aria-hidden
                  >
                    <span
                      style={{
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        color: 'var(--color-text-muted)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Quantity
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      width: 44,
                      flexShrink: 0,
                      height: 260,
                      paddingTop: 10,
                      paddingBottom: 2,
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-muted)',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {partTrend.yTicks.map((t, i) => (
                      <span key={`y-tick-${i}`}>{t}</span>
                    ))}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        height: 260,
                        borderLeft: '1px solid var(--color-border)',
                        borderBottom: '1px solid var(--color-border)',
                        display: 'grid',
                        gridTemplateColumns: `repeat(${partTrend.rows.length}, minmax(0, 1fr))`,
                        gap: '0.75rem',
                        alignItems: 'end',
                        padding: '0.75rem 0.75rem 0 0.75rem',
                        background:
                          'linear-gradient(to top, transparent 24%, rgba(148,163,184,0.12) 25%, transparent 26%, transparent 49%, rgba(148,163,184,0.12) 50%, transparent 51%, transparent 74%, rgba(148,163,184,0.12) 75%, transparent 76%)',
                      }}
                    >
                      {partTrend.rows.map((row) => (
                        <div
                          key={row.month}
                          style={{ display: 'grid', gridTemplateColumns: `repeat(${partTrend.parts.length}, 1fr)`, gap: 6, alignItems: 'end' }}
                        >
                          {row.values.map((qty, idx) => (
                            <div key={`${row.month}-${partTrend.parts[idx]}`} title={`${row.month} · ${partTrend.parts[idx]}: ${qty}`}>
                              <div
                                style={{
                                  width: '100%',
                                  height: `${Math.max(4, (qty / partTrend.maxQty) * 170)}px`,
                                  background: ['#2563eb', '#7c3aed', '#ea580c', '#16a34a'][idx % 4],
                                  borderRadius: '4px 4px 0 0',
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${partTrend.rows.length}, minmax(0, 1fr))`,
                        gap: '0.75rem',
                        padding: '0.35rem 0.75rem 0 0.75rem',
                      }}
                    >
                      {partTrend.rows.map((row) => (
                        <span
                          key={`${row.month}-x`}
                          style={{
                            textAlign: 'center',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-text-muted)',
                            fontWeight: 500,
                          }}
                        >
                          {row.month}
                        </span>
                      ))}
                    </div>
                    <div
                      style={{
                        textAlign: 'center',
                        paddingTop: '0.35rem',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        color: 'var(--color-text-muted)',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Month
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

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
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('code')}>
                      Shipment ID {sortIndicator('code')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('supplier')}>
                      Supplier {sortIndicator('supplier')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('purchaseOrder')}>
                      P.O. {sortIndicator('purchaseOrder')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('partNumber')}>
                      Part Number {sortIndicator('partNumber')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('qty')}>
                      Quantity {sortIndicator('qty')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('lot')}>
                      Lot {sortIndicator('lot')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('scheduled')}>
                      Requested Inspection Date {sortIndicator('scheduled')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('inspector')}>
                      Inspector {sortIndicator('inspector')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('status')}>
                      Approval {sortIndicator('status')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('notes')}>
                      Notes {sortIndicator('notes')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('approvalDate')}>
                      Approval Date {sortIndicator('approvalDate')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('records')}>
                      Records {sortIndicator('records')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('created')}>
                      Created {sortIndicator('created')}
                    </th>
                    <th>Approve/Reject Button</th>
                    <th>Create Finding</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedShipments.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.code ?? '—'}</td>
                      <td>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                          {r.supplier?.code ?? '—'}: {r.supplier?.name ?? ''}
                        </span>
                      </td>
                      <td>{r.purchaseOrder ?? '—'}</td>
                      <td>{r.partNumber ?? '—'}</td>
                      <td>{r.qty ?? '—'}</td>
                      <td>{r.lot ?? '—'}</td>
                      <td>{r.inspectionDate?.slice(0, 10) ?? '—'}</td>

                      <td>
                        {canEditInspector && r.status === 'WaitingInspection' ? (
                          <select
                            className="input"
                            value={inspectorDrafts[r.id] ?? ''}
                            disabled={savingId === r.id}
                            onChange={async (e) => {
                              if (!token) return;
                              const nextValue = e.target.value;
                              setInspectorDrafts((d) => ({ ...d, [r.id]: nextValue }));
                              const inspector = nextValue.trim() || null;
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
                          >
                            <option value="">Select inspector</option>
                            {inspectors.map((opt) => (
                              <option key={opt.id} value={opt.name}>
                                {opt.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ color: r.inspector ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                            {r.inspector ?? '—'}
                          </span>
                        )}
                      </td>

                      <td>{r.status === 'Passed' ? 'Approved' : r.status === 'Failed' ? 'Rejected' : '—'}</td>
                      <td
                        style={{
                          maxWidth: 200,
                          fontSize: 'var(--text-sm)',
                          color: 'var(--color-text-muted)',
                          verticalAlign: 'top',
                        }}
                        title={r.notes?.trim() ? r.notes : undefined}
                      >
                        {r.status === 'Failed' && r.notes?.trim() ? (
                          <span style={{ color: 'var(--color-text)' }}>{r.notes.trim()}</span>
                        ) : r.status === 'Failed' ? (
                          <span style={{ fontStyle: 'italic' }}>—</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{r.status === 'WaitingInspection' ? '—' : r.updatedAt?.slice(0, 10) ?? '—'}</td>

                      <td>
                        <div
                          style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}
                        >
                          {(r.records?.length ?? 0) === 0 ? (
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>—</span>
                          ) : (
                            (r.records ?? []).map((rec) => (
                              <button
                                key={rec.id}
                                type="button"
                                className="btn btn-ghost"
                                style={{
                                  display: 'block',
                                  padding: 0,
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--color-primary)',
                                  textDecoration: 'underline',
                                  marginBottom: 2,
                                  cursor: rec.hasFile ? 'pointer' : 'default',
                                }}
                                disabled={!rec.hasFile || Boolean(downloadingRecord[rec.id])}
                                onClick={() => rec.hasFile && downloadRecord(rec.id, rec.name)}
                                title={rec.hasFile ? 'Download record file' : 'No file attached'}
                              >
                                {downloadingRecord[rec.id] ? 'Downloading…' : rec.name}
                              </button>
                            ))
                          )}
                          {canAttachRecord && (
                            <Link
                              to={`/records?shipmentId=${encodeURIComponent(r.id)}&supplierId=${encodeURIComponent(r.supplierId)}`}
                              className="btn btn-ghost"
                              style={{ fontSize: 'var(--text-sm)', padding: '0.2rem 0.5rem' }}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              + Add record
                            </Link>
                          )}
                        </div>
                      </td>
                      <td>{r.createdAt?.slice(0, 10) ?? '—'}</td>
                      <td>
                        {canReview && r.status === 'WaitingInspection' ? (
                          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn"
                              style={{
                                fontSize: 'var(--text-sm)',
                                padding: '0.35rem 0.65rem',
                                background: 'var(--approve-green)',
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
                      <td>
                        {canCreateFinding ? (
                          <Link
                            to={`/findings/create?supplierId=${encodeURIComponent(r.supplierId)}&shipmentId=${encodeURIComponent(r.id)}`}
                            className="btn btn-ghost"
                            style={{ fontSize: 'var(--text-sm)', padding: '0.2rem 0.5rem' }}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            + New Finding
                          </Link>
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
              <p style={{ margin: '0 0 0.75rem' }}>
                Mark this request as failed (rejected)? Rejection details are saved on the shipment and shown in the
                table <strong>Notes</strong> column.
              </p>
              <label className="input-label" htmlFor="reject-note">
                Rejection notes
              </label>
              <textarea
                id="reject-note"
                className="input"
                rows={3}
                value={rejectDialog.note}
                onChange={(e) => setRejectDialog((d) => (d ? { ...d, note: e.target.value } : null))}
                placeholder="Reason for rejection (visible to reviewers in Notes)…"
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

function Metric({
  label,
  value,
  subtitle,
  openShipmentRequestsAlert,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  openShipmentRequestsAlert?: {
    shortDeliveries: number;
    shortDetails: Array<{
      purchaseOrder: string | null;
      partNumber: string | null;
      missingQty: number;
    }>;
    lateVsSchedule: number;
    lateVsScheduleDetails: Array<{ purchaseOrder: string | null; qty: number | null }>;
  };
}) {
  const cardClass =
    openShipmentRequestsAlert != null ? 'card shipments-metric-card--overflow-visible' : 'card';
  const reserveIcon = openShipmentRequestsAlert != null;

  return (
    <div className={cardClass} style={reserveIcon ? { position: 'relative', zIndex: 1 } : undefined}>
      <div
        className="card-body"
        style={{
          padding: '0.75rem',
          position: 'relative',
          minHeight: reserveIcon ? 88 : undefined,
        }}
      >
        {openShipmentRequestsAlert != null ? (
          <ShipmentMetricAlertIcon
            shortDeliveries={openShipmentRequestsAlert.shortDeliveries}
            shortDetails={openShipmentRequestsAlert.shortDetails}
            lateVsSchedule={openShipmentRequestsAlert.lateVsSchedule}
            lateVsScheduleDetails={openShipmentRequestsAlert.lateVsScheduleDetails}
          />
        ) : null}
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-muted)',
            paddingRight: reserveIcon ? 36 : 0,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{value}</div>
        {subtitle ? (
          <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', lineHeight: 1.35 }}>
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
