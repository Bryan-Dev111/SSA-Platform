/**
 * Supplier Profile (Day 9.5): metrics, tables, upload record metadata, request shipment inspection.
 * Supplier role: full portal from GET /me/supplier-portal. Other roles: short notice.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError } from '../utils/apiHelpers';
import { downloadTableXlsx, type ExportRow } from '../utils/exportExcel';
import { MetricCard } from '../components/MetricCard';
import { MonthlyTrendsLineChart, type MonthlyTrendRow } from '../components/MonthlyTrendsLineChart';
import { Link, useSearchParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const MAX_RECORD_UPLOAD_BYTES = 75 * 1024 * 1024;

interface Buyer {
  id: string;
  email: string;
  name: string | null;
}

interface SupplierOption {
  id: string;
  code: string;
  name: string;
}

interface PortalData {
  supplier: {
    id: string;
    code: string;
    name: string;
    city: string | null;
    country: string | null;
    commodityType: { id: string; name: string } | null;
  };
  assignedBuyers: Buyer[];
  audits: Array<{
    id: string;
    code: string;
    auditDate: string;
    result: string | null;
    auditType: { code: string; name: string | null } | null;
  }>;
  findings: Array<{ id: string; code: string; status: string; severity: string; summary: string }>;
  cars: Array<{ id: string; code: string; status: string; severity: string; summary: string }>;
  riskSnapshots: Array<{ id: string; score: number | null; level: string; createdAt: string }>;
  records: Array<{
    id: string;
    name: string;
    notes: string | null;
    internalOrSupplier: string;
    status: string;
    createdAt: string;
    filePath?: string | null;
  }>;
  shipments: Array<{
    id: string;
    code: string | null;
    purchaseOrder: string | null;
    partNumber: string | null;
    lot: string | null;
    qty: number | null;
    inspectionDate: string | null;
    createdBy: string | null;
    createdAt: string;
    notes: string | null;
  }>;
  metrics: {
    assignedBuyerCount: number;
    openCarCount: number;
    overdueCarCount?: number;
    auditCount: number;
    findingCount: number;
    openFindingCount?: number;
    recordCount: number;
    shipmentCount: number;
    waitingInspectionCount?: number;
  };
  charts?: {
    monthlyTrends: MonthlyTrendRow[];
  };
}

interface ShipmentKpis {
  otdPercent: number | null;
  fpyPercent: number | null;
}

interface WeeklyRiskPoint {
  weekStartIso: string;
  label: string;
  score: number;
}

export function SupplierProfile() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const supplierIdFromUrl = searchParams.get('supplierId');
  const [data, setData] = useState<PortalData | null>(null);
  const [shipmentKpis, setShipmentKpis] = useState<ShipmentKpis | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordName, setRecordName] = useState('');
  const [recordNotes, setRecordNotes] = useState('');
  const [recordFile, setRecordFile] = useState<File | null>(null);
  const [shipPo, setShipPo] = useState('');
  const [shipPart, setShipPart] = useState('');
  const [shipLot, setShipLot] = useState('');
  const [shipQty, setShipQty] = useState('');
  const [shipDate, setShipDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [carSummaryModal, setCarSummaryModal] = useState<{ code: string; summary: string } | null>(null);

  const isSupplier = user?.roleNames?.includes('Supplier');
  const roleNames = user?.roleNames ?? [];
  const canSelectSupplier = !isSupplier && roleNames.some((r) => ['Admin', 'Buyer', 'QualityEngineer', 'QualityManager'].includes(r));

  useEffect(() => {
    if (supplierIdFromUrl && canSelectSupplier) {
      setSelectedSupplierId(supplierIdFromUrl);
    }
  }, [supplierIdFromUrl, canSelectSupplier]);

  useEffect(() => {
    setCarSummaryModal(null);
  }, [data?.supplier?.id]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (!canSelectSupplier) return;
    apiJson<SupplierOption[]>('/suppliers', { token })
      .then((list) => setSupplierOptions(list))
      .catch(() => setSupplierOptions([]));
  }, [token, canSelectSupplier]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    if (isSupplier) {
      apiJson<PortalData>('/me/supplier-portal', { token })
        .then(setData)
        .catch((e: unknown) => {
          setData(null);
          setError(parseApiError(e));
        })
        .finally(() => setLoading(false));
      return;
    }
    if (canSelectSupplier && selectedSupplierId) {
      apiJson<PortalData>(`/suppliers/${encodeURIComponent(selectedSupplierId)}/profile`, { token })
        .then(setData)
        .catch((e: unknown) => {
          setData(null);
          setError(parseApiError(e));
        })
        .finally(() => setLoading(false));
      return;
    }
    setData(null);
    setLoading(false);
  }, [token, isSupplier, canSelectSupplier, selectedSupplierId]);

  useEffect(() => {
    if (!token || !data?.supplier?.id) {
      setShipmentKpis(null);
      return;
    }
    apiJson<ShipmentKpis>(`/shipments/metrics?supplierId=${encodeURIComponent(data.supplier.id)}`, { token })
      .then((k) => setShipmentKpis(k))
      .catch(() => setShipmentKpis(null));
  }, [token, data?.supplier?.id]);

  const refresh = () => {
    if (!token) return;
    const url = isSupplier
      ? '/me/supplier-portal'
      : selectedSupplierId
        ? `/suppliers/${encodeURIComponent(selectedSupplierId)}/profile`
        : '';
    if (!url) return;
    apiJson<PortalData>(url, { token }).then(setData).catch(() => {});
  };

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      refresh();
    }, 15000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [token, isSupplier, canSelectSupplier, selectedSupplierId]);

  const weeklyRiskSeries = useMemo(() => {
    if (!data?.riskSnapshots?.length) return [] as WeeklyRiskPoint[];
    return buildWeeklyRiskSeries(data.riskSnapshots);
  }, [data?.riskSnapshots]);

  const monthlyTrends = data?.charts?.monthlyTrends ?? [];
  const profileTrendMax = useMemo(
    () => Math.max(1, ...monthlyTrends.map((r) => Math.max(r.findings, r.cars, r.audits, r.shipments))),
    [monthlyTrends]
  );

  const assignedBuyersSubtitle = useMemo(() => {
    if (!data?.assignedBuyers?.length) return 'None assigned';
    const b = data.assignedBuyers;
    if (b.length <= 2) return b.map((x) => x.name?.trim() || x.email).join(' · ');
    return `${b.length} contacts`;
  }, [data?.assignedBuyers]);

  const passPercent = useMemo(() => {
    const audits = data?.audits ?? [];
    if (audits.length === 0) return '0% Pass';
    const passed = audits.filter((a) => a.result === 'Passed').length;
    return `${Math.round((passed / audits.length) * 100)}% Pass`;
  }, [data?.audits]);

  const criticalMajorCount = useMemo(() => {
    const findings = data?.findings ?? [];
    return findings.filter((f) => f.severity === 'Critical' || f.severity === 'Major').length;
  }, [data?.findings]);

  const submitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !data || !recordName.trim()) return;
    if (!recordFile) {
      toast.error('File is required');
      return;
    }
    if (recordFile.size > MAX_RECORD_UPLOAD_BYTES) {
      toast.error('File exceeds current upload limit (75MB)');
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('name', recordName.trim());
      form.append('notes', recordNotes.trim());
      form.append('internalOrSupplier', 'supplier');
      form.append('supplierId', data.supplier.id);
      form.append('file', recordFile);
      const res = await fetch(`${API_BASE}/records`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = text || `HTTP ${res.status}`;
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* keep msg */
        }
        throw new Error(msg);
      }
      setRecordName('');
      setRecordNotes('');
      setRecordFile(null);
      toast.success('Record submitted (pending review)');
      refresh();
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const submitShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !data) return;
    if (!shipPo.trim() || !shipPart.trim() || !shipLot.trim() || !shipQty.trim() || !shipDate.trim()) {
      toast.error('Purchase order, part number, lot, quantity, and inspection date are required');
      return;
    }
    const qtyNum = Number(shipQty);
    if (Number.isNaN(qtyNum) || qtyNum < 0) {
      toast.error('Quantity must be a valid non-negative number');
      return;
    }
    setSubmitting(true);
    try {
      await apiJson('/shipments', {
        token,
        method: 'POST',
        body: JSON.stringify({
          supplierId: data.supplier.id,
          purchaseOrder: shipPo.trim(),
          partNumber: shipPart.trim(),
          lot: shipLot.trim(),
          qty: qtyNum,
          inspectionDate: shipDate.trim(),
        }),
      });
      setShipPo('');
      setShipPart('');
      setShipLot('');
      setShipQty('');
      setShipDate('');
      toast.success('Inspection request submitted');
      refresh();
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSupplier && !canSelectSupplier) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Supplier Profile</h1>
          <p className="page-description">
            You do not have permission to view supplier profiles from this page.
          </p>
        </header>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Supplier Profile</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Supplier Profile</h1>
          {canSelectSupplier && (
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-sm)' }}>Supplier filter:</span>
              <select className="input" style={{ width: 'auto', minWidth: 260 }} value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}>
                <option value="">Select supplier</option>
                {supplierOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>
        <div className="alert-error" role="alert">
          {error}
          {error?.includes('No supplier linked') ? (
            <p style={{ marginTop: '0.75rem', marginBottom: 0, fontWeight: 400 }}>
              Ask an administrator to link your user account to a supplier record.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const supplier = data?.supplier;
  const metrics = data?.metrics;
  const waitingInspection = metrics?.waitingInspectionCount ?? 0;

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Supplier Profile</h1>
        <p className="page-description">
          {isSupplier
            ? 'Your portal: assigned buyers, quality data, records, and shipment inspection requests.'
            : 'Select a supplier to view profile details and related quality records.'}
        </p>
        {canSelectSupplier && (
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-sm)' }}>Supplier filter:</span>
            <select className="input" style={{ width: 'auto', minWidth: 280 }} value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}>
              <option value="">Select supplier</option>
              {supplierOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {!data && canSelectSupplier ? (
        <div className="placeholder-empty">
          <strong>No supplier selected</strong>
          <div style={{ marginTop: '0.5rem' }}>Choose a supplier from the filter to load profile data.</div>
        </div>
      ) : null}

      {!data || !supplier || !metrics ? null : (
        <>
      <div style={{ marginBottom: '0.75rem' }}>
        <strong>
          {supplier.code} — {supplier.name}
        </strong>
      </div>

      <div
        className="dashboard-metric-grid"
        style={{
          marginBottom: '1.5rem',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        }}
      >
        <MetricCard
          title="Assigned Buyers"
          value={metrics.assignedBuyerCount}
          subtitle={assignedBuyersSubtitle}
        />
        <MetricCard
          title="Total CARs"
          value={data.cars.length}
          subtitle={`${metrics.openCarCount} open`}
        />
        <MetricCard
          title="Total Audits"
          value={metrics.auditCount}
          subtitle={passPercent}
        />
        <MetricCard
          title="Total Findings"
          value={metrics.findingCount}
          subtitle={`${criticalMajorCount} Critical/Major`}
        />
        <MetricCard
          title="Total Shipments"
          value={metrics.shipmentCount}
          subtitle={`FPY ${shipmentKpis?.fpyPercent != null ? `${shipmentKpis.fpyPercent}%` : '—'}`}
        />
        <MetricCard
          title="OTD%"
          value={shipmentKpis?.otdPercent != null ? `${shipmentKpis.otdPercent}%` : '—'}
          subtitle={`${waitingInspection} waiting inspection`}
        />
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Monthly trends</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 0 }}>
            New items by month for this supplier (same view as the main dashboard).
          </p>
          {monthlyTrends.length === 0 ? (
            <p className="table-empty">No trend data yet.</p>
          ) : (
            <MonthlyTrendsLineChart rows={monthlyTrends} maxY={profileTrendMax} />
          )}
        </div>
      </div>

      {isSupplier && (
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Upload record</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Submit a document for review. Your organization is linked automatically (no supplier picker).
          </p>
          <form onSubmit={submitRecord}>
            <div className="input-group">
              <label className="input-label">Name *</label>
              <input className="input" value={recordName} onChange={(e) => setRecordName(e.target.value)} required />
            </div>
            <div className="input-group">
              <label className="input-label">File *</label>
              <input
                className="input"
                type="file"
                onChange={(e) => setRecordFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Notes (optional)</label>
              <textarea className="input" rows={2} value={recordNotes} onChange={(e) => setRecordNotes(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '…' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
      )}

      {isSupplier && (
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Upload shipment</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 0 }}>
            Request a shipment inspection. Appears on Shipments and Internal Management for your team.
          </p>
          <form onSubmit={submitShipment}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
              <div className="input-group">
                <label className="input-label">Purchase order *</label>
                <input className="input" value={shipPo} onChange={(e) => setShipPo(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Part number *</label>
                <input className="input" value={shipPart} onChange={(e) => setShipPart(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Quantity *</label>
                <input className="input" type="number" min={0} step="1" value={shipQty} onChange={(e) => setShipQty(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Lot *</label>
                <input className="input" value={shipLot} onChange={(e) => setShipLot(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Requested inspection date *</label>
                <input className="input" type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.75rem' }} disabled={submitting}>
              {submitting ? '…' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
      )}

      <SectionTable
        title="Audits"
        empty="No audits."
        rowCount={data.audits.length}
      >
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Date</th>
              <th>Type</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {data.audits.map((a) => (
              <tr key={a.id}>
                <td>{a.code}</td>
                <td>{a.auditDate?.slice(0, 10)}</td>
                <td>{a.auditType ? `${a.auditType.code}` : '—'}</td>
                <td>{a.result ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionTable>

      <SectionTable
        title="Findings"
        empty="No findings."
        rowCount={data.findings.length}
      >
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {data.findings.map((f) => (
              <tr key={f.id}>
                <td>
                  <Link to={`/findings-record?id=${f.id}`}>{f.code}</Link>
                </td>
                <td>{f.status}</td>
                <td>{f.severity}</td>
                <td>{f.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionTable>

      <SectionTable
        title="Corrective actions (CARs)"
        empty="No CARs."
        rowCount={data.cars.length}
      >
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {data.cars.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link to={`/car-record?id=${c.id}`}>{c.code}</Link>
                </td>
                <td>{c.status}</td>
                <td>{c.severity}</td>
                <td style={{ maxWidth: 300, whiteSpace: 'normal', verticalAlign: 'top' }}>
                  {(c.summary ?? '').length > 120 ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setCarSummaryModal({ code: c.code, summary: c.summary ?? '' })}
                      style={{
                        padding: 0,
                        textAlign: 'left',
                        lineHeight: 1.35,
                        color: 'inherit',
                        width: '100%',
                        overflow: 'hidden',
                        maxHeight: '2.7em',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                      title="Click to view full summary"
                    >
                      {c.summary}
                    </button>
                  ) : (
                    <div style={{ lineHeight: 1.35 }}>{c.summary?.trim() ? c.summary : '—'}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionTable>

      <SectionTable
        title="Risk history"
        empty="No risk snapshots."
        rowCount={data.riskSnapshots.length}
      >
        {weeklyRiskSeries.length === 0 ? (
          <p className="table-empty">No numeric risk scores yet.</p>
        ) : (
          <RiskHistoryLineChart points={weeklyRiskSeries} />
        )}
      </SectionTable>

      <SectionTable
        title="Records"
        empty="No records."
        rowCount={data.records.length}
        excelExport={{
          filename: `${safeExportFilePart(supplier.code)}_Records`,
          sheetName: 'Records',
          getRows: () =>
            data.records.map(
              (r): ExportRow => ({
                Name: r.name,
                Notes: r.notes ?? '',
                File: r.filePath ? 'Yes' : '',
                Source: r.internalOrSupplier,
                Status: r.status,
                Created: new Date(r.createdAt).toLocaleString(),
              })
            ),
        }}
      >
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Notes</th>
              <th>File</th>
              <th>Source</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {data.records.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.notes ?? ''}>
                  {r.notes?.trim() ? r.notes : '—'}
                </td>
                <td>{r.filePath ? 'Yes' : '—'}</td>
                <td>{r.internalOrSupplier}</td>
                <td>{r.status}</td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionTable>

      <SectionTable title="Shipment inspection requests" empty="No requests." rowCount={data.shipments.length}>
        <table className="table">
          <thead>
            <tr>
              <th>Shipment ID</th>
              <th>Supplier</th>
              <th>P.O.</th>
              <th>Lot</th>
              <th>Part Number</th>
              <th>Quantity</th>
              <th>Requested Inspection Date</th>
              <th>User</th>
              <th>Date Created</th>
              <th>NOTES</th>
            </tr>
          </thead>
          <tbody>
            {data.shipments.map((s) => (
              <tr key={s.id}>
                <td>{s.code ?? '—'}</td>
                <td>
                  {supplier?.code ?? '—'} — {supplier?.name ?? ''}
                </td>
                <td>{s.purchaseOrder ?? '—'}</td>
                <td>{s.lot ?? '—'}</td>
                <td>{s.partNumber ?? '—'}</td>
                <td>{s.qty ?? '—'}</td>
                <td>{s.inspectionDate?.slice(0, 10) ?? '—'}</td>
                <td>{s.createdBy ?? '—'}</td>
                <td>
                  {new Date(s.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
                <td
                  style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={s.notes ?? ''}
                >
                  {s.notes?.trim() ? s.notes : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionTable>
      </>
      )}

      {carSummaryModal && (
        <div
          className="confirm-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="supplier-profile-car-summary-title"
          onClick={() => setCarSummaryModal(null)}
        >
          <div className="confirm-dialog" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <h3 id="supplier-profile-car-summary-title" className="confirm-dialog-title">
              CAR Summary — {carSummaryModal.code}
            </h3>
            <p style={{ marginBottom: '1rem', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{carSummaryModal.summary}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={() => setCarSummaryModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function safeExportFilePart(s: string): string {
  return s.replace(/[/\\?*:[\]"<>|]/g, '_').trim() || 'supplier';
}

function buildWeeklyRiskSeries(
  snapshots: Array<{ id: string; score: number | null; level: string; createdAt: string }>
): WeeklyRiskPoint[] {
  const sortedAsc = [...snapshots]
    .filter((s): s is { id: string; score: number; level: string; createdAt: string } => typeof s.score === 'number')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const byWeek = new Map<string, WeeklyRiskPoint>();
  for (const snap of sortedAsc) {
    const created = new Date(snap.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    const weekStart = toUtcWeekStart(created);
    const iso = weekStart.toISOString().slice(0, 10);
    byWeek.set(iso, {
      weekStartIso: iso,
      label: `${weekStart.toLocaleString('en-US', { month: 'short' })} ${weekStart.getUTCDate()}`,
      score: Math.round(snap.score * 100) / 100,
    });
  }
  return [...byWeek.values()].sort((a, b) => a.weekStartIso.localeCompare(b.weekStartIso));
}

function toUtcWeekStart(d: Date): Date {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - mondayOffset);
  return dt;
}

function RiskHistoryLineChart({ points }: { points: WeeklyRiskPoint[] }) {
  const width = 960;
  const height = 280;
  const padLeft = 48;
  const padRight = 20;
  const padTop = 16;
  const padBottom = 42;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const maxY = Math.max(100, ...points.map((p) => p.score));
  const minY = 0;

  const xAt = (i: number) => padLeft + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const yAt = (v: number) => padTop + plotH - ((v - minY) / (maxY - minY || 1)) * plotH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(p.score).toFixed(2)}`).join(' ');

  return (
    <div>
      <div style={{ marginBottom: '0.5rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        Weekly risk score trend
      </div>
      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: 680, height: 'auto', display: 'block' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => {
            const y = padTop + plotH * f;
            const val = Math.round(maxY * (1 - f));
            return (
              <g key={`grid-${idx}`}>
                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#6b7280">
                  {val}
                </text>
              </g>
            );
          })}

          <line x1={padLeft} y1={padTop + plotH} x2={width - padRight} y2={padTop + plotH} stroke="#9ca3af" />
          <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="#9ca3af" />

          <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.5" />
          {points.map((p, i) => (
            <circle key={p.weekStartIso} cx={xAt(i)} cy={yAt(p.score)} r="3.5" fill="#2563eb" />
          ))}

          {points.map((p, i) => (
            <text key={`${p.weekStartIso}-x`} x={xAt(i)} y={height - 14} textAnchor="middle" fontSize="11" fill="#6b7280">
              {p.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

function SectionTable({
  title,
  empty,
  rowCount,
  children,
  excelExport,
}: {
  title: string;
  empty: string;
  rowCount: number;
  children: ReactNode;
  excelExport?: { filename: string; sheetName: string; getRows: () => ExportRow[] };
}) {
  const toast = useToast();

  const handleExportExcel = () => {
    if (!excelExport) return;
    if (rowCount === 0) {
      toast.info('No data to export');
      return;
    }
    try {
      const rows = excelExport.getRows();
      if (rows.length === 0) {
        toast.info('No data to export');
        return;
      }
      downloadTableXlsx(excelExport.filename, excelExport.sheetName, rows);
      toast.success('Exported to Excel');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  };

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="card-body">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>{title}</h2>
          {excelExport ? (
            <button type="button" className="btn btn-ghost" onClick={handleExportExcel} disabled={rowCount === 0}>
              Export to Excel
            </button>
          ) : null}
        </div>
        <div className="table-wrap">
          {rowCount === 0 ? <p className="table-empty">{empty}</p> : children}
        </div>
      </div>
    </div>
  );
}
