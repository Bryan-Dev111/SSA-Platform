/**
 * Supplier Profile (Day 9.5): metrics, tables, upload record metadata, request shipment inspection.
 * Supplier role: full portal from GET /me/supplier-portal. Other roles: short notice.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError, readFileAsBase64 } from '../utils/apiHelpers';
import { Link } from 'react-router-dom';

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
    internalOrSupplier: string;
    status: string;
    createdAt: string;
    filePath?: string | null;
  }>;
  shipments: Array<{
    id: string;
    purchaseOrder: string | null;
    partNumber: string | null;
    qty: number | null;
    inspectionDate: string | null;
    status: string;
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
  const [data, setData] = useState<PortalData | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordName, setRecordName] = useState('');
  const [recordFile, setRecordFile] = useState<File | null>(null);
  const [shipPo, setShipPo] = useState('');
  const [shipPart, setShipPart] = useState('');
  const [shipQty, setShipQty] = useState('');
  const [shipDate, setShipDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSupplier = user?.roleNames?.includes('Supplier');
  const roleNames = user?.roleNames ?? [];
  const canSelectSupplier = !isSupplier && roleNames.some((r) => ['Admin', 'Buyer', 'QualityEngineer'].includes(r));

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

  const submitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !data || !recordName.trim()) return;
    if (recordFile && recordFile.size > 8 * 1024 * 1024) {
      toast.error('File must be 8MB or smaller');
      return;
    }
    setSubmitting(true);
    try {
      let fileBase64: string | undefined;
      let fileName: string | undefined;
      if (recordFile) {
        fileBase64 = await readFileAsBase64(recordFile);
        fileName = recordFile.name;
      }
      await apiJson('/records', {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: recordName.trim(),
          supplierId: data.supplier.id,
          internalOrSupplier: 'supplier',
          ...(fileBase64 ? { fileBase64, fileName } : {}),
        }),
      });
      setRecordName('');
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
    if (!token || !data || !shipDate.trim()) return;
    setSubmitting(true);
    try {
      await apiJson('/shipments', {
        token,
        method: 'POST',
        body: JSON.stringify({
          supplierId: data.supplier.id,
          purchaseOrder: shipPo.trim() || null,
          partNumber: shipPart.trim() || null,
          qty: shipQty.trim() ? Number(shipQty) : null,
          inspectionDate: shipDate.trim(),
        }),
      });
      setShipPo('');
      setShipPart('');
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

      {isSupplier && (
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Upload record (supplier)</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Submit a record name for review. Optional file attachment (max 8MB) is stored on the server.
          </p>
          <form onSubmit={submitRecord} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label className="input-label">Record name *</label>
              <input className="input" value={recordName} onChange={(e) => setRecordName(e.target.value)} required />
            </div>
            <div className="input-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label className="input-label">File (optional)</label>
              <input
                className="input"
                type="file"
                onChange={(e) => setRecordFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '…' : 'Submit record'}
            </button>
          </form>
        </div>
      </div>
      )}

      {isSupplier && (
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Request shipment inspection</h2>
          <form onSubmit={submitShipment}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
              <div className="input-group">
                <label className="input-label">Purchase order</label>
                <input className="input" value={shipPo} onChange={(e) => setShipPo(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Part #</label>
                <input className="input" value={shipPart} onChange={(e) => setShipPart(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Qty</label>
                <input className="input" type="number" min={0} value={shipQty} onChange={(e) => setShipQty(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Inspection date *</label>
                <input className="input" type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.75rem' }} disabled={submitting}>
              {submitting ? '…' : 'Submit request'}
            </button>
          </form>
        </div>
      </div>
      )}

      <SectionTable title="Audits" empty="No audits." rowCount={data.audits.length}>
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

      <SectionTable title="Findings" empty="No findings." rowCount={data.findings.length}>
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

      <SectionTable title="Corrective actions (CARs)" empty="No CARs." rowCount={data.cars.length}>
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
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
                <td>{c.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionTable>

      <SectionTable title="Risk history" empty="No risk snapshots." rowCount={data.riskSnapshots.length}>
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

      <SectionTable title="Records" empty="No records." rowCount={data.records.length}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
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
              <th>PO</th>
              <th>Part #</th>
              <th>Qty</th>
              <th>Inspection date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.shipments.map((s) => (
              <tr key={s.id}>
                <td>{s.purchaseOrder ?? '—'}</td>
                <td>{s.partNumber ?? '—'}</td>
                <td>{s.qty ?? '—'}</td>
                <td>{s.inspectionDate?.slice(0, 10) ?? '—'}</td>
                <td>{s.status}</td>
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

function SectionTable({
  title,
  empty,
  rowCount,
  children,
}: {
  title: string;
  empty: string;
  rowCount: number;
  children: ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <div className="table-wrap">
          {rowCount === 0 ? <p className="table-empty">{empty}</p> : children}
        </div>
      </div>
    </div>
  );
}
