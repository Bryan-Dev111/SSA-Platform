/**
 * Supplier Profile (Day 9.5): metrics, tables, upload record metadata, request shipment inspection.
 * Supplier role: full portal from GET /me/supplier-portal. Other roles: short notice.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError } from '../utils/apiHelpers';
import { downloadTableXlsx, type ExportRow } from '../utils/exportExcel';
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
    auditCount: number;
    findingCount: number;
    recordCount: number;
    shipmentCount: number;
  };
}

export function SupplierProfile() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const supplierIdFromUrl = searchParams.get('supplierId');
  const [data, setData] = useState<PortalData | null>(null);
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

  const isSupplier = user?.roleNames?.includes('Supplier');
  const roleNames = user?.roleNames ?? [];
  const canSelectSupplier = !isSupplier && roleNames.some((r) => ['Admin', 'Buyer', 'QualityEngineer'].includes(r));

  useEffect(() => {
    if (supplierIdFromUrl && canSelectSupplier) {
      setSelectedSupplierId(supplierIdFromUrl);
    }
  }, [supplierIdFromUrl, canSelectSupplier]);

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
  const latestRisk = data?.riskSnapshots[0];

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
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}
      >
        <div className="card">
          <div className="card-body" style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Assigned buyers</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{metrics.assignedBuyerCount}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Open CARs</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{metrics.openCarCount}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Audits</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{metrics.auditCount}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Findings</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{metrics.findingCount}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Records</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{metrics.recordCount}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Shipment requests</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{metrics.shipmentCount}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Current risk</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>
              {latestRisk ? `${latestRisk.level} (${latestRisk.score ?? '—'})` : '—'}
            </div>
          </div>
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

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Assigned buyers</h2>
          {data.assignedBuyers.length === 0 ? (
            <p className="table-empty">No buyer assigned yet.</p>
          ) : (
            <ul>
              {data.assignedBuyers.map((b) => (
                <li key={b.id}>
                  {b.name || b.email} ({b.email})
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginBottom: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Commodity: {supplier.commodityType?.name ?? '—'} · {supplier.city ?? '—'}, {supplier.country ?? '—'}
          </p>
        </div>
      </div>

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
                <td>{c.summary}</td>
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
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Level</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {data.riskSnapshots.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.level}</td>
                <td>{r.score ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
                <td>{new Date(s.createdAt).toLocaleDateString()}</td>
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
    </div>
  );
}

function safeExportFilePart(s: string): string {
  return s.replace(/[/\\?*:[\]"<>|]/g, '_').trim() || 'supplier';
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
