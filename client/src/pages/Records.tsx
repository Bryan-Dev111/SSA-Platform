/**
 * Day 10: Records list (scoped); upload Supplier/Auditor/Buyer/Admin/QE; Admin/QE approve-reject; download.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError, downloadWithAuthProgress } from '../utils/apiHelpers';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MAX_RECORD_UPLOAD_BYTES, postRecordWithProgress } from '../utils/recordUpload';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface AuditListOption {
  id: string;
  code: string;
  auditDate: string;
  derivedStatus: string;
}

interface ShipmentListOption {
  id: string;
  code: string | null;
  inspectionDate: string | null;
}

interface CarListOption {
  id: string;
  code: string;
  status: string;
}

function formatCarStatusForRecords(status: string): string {
  if (status === 'WaitingApproval') return 'Waiting Approval';
  if (status === 'FollowUp') return 'Follow Up';
  return status;
}

interface RecordRow {
  id: string;
  name: string;
  notes: string | null;
  internalOrSupplier: string;
  status: string;
  filePath: string | null;
  supplierId: string | null;
  supplier: { id: string; code: string; name: string } | null;
  auditId?: string | null;
  audit?: { id: string; code: string } | null;
  shipmentId?: string | null;
  shipment?: { id: string; code: string | null } | null;
  carId?: string | null;
  car?: { id: string; code: string } | null;
  uploadedBy: { id: string; email: string; name: string | null } | null;
  approvedBy: { id: string; email: string; name: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

function getRecordReviewLabel(status: string): 'Pending' | 'Approved' | 'Rejected' {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'approved') return 'Approved';
  if (normalized === 'rejected') return 'Rejected';
  return 'Pending';
}

function getRecordRowSlug(status: string): 'pending' | 'approved' | 'rejected' {
  const label = getRecordReviewLabel(status);
  if (label === 'Approved') return 'approved';
  if (label === 'Rejected') return 'rejected';
  return 'pending';
}

const RECORD_REVIEW_SORT_RANK: Record<'Pending' | 'Approved' | 'Rejected', number> = {
  Pending: 0,
  Approved: 1,
  Rejected: 2,
};

export function Records() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const auditSeed = searchParams.get('auditId');
  const shipmentSeed = searchParams.get('shipmentId');
  const carSeed = searchParams.get('carId');
  const supplierSeed = searchParams.get('supplierId');
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [auditOptions, setAuditOptions] = useState<AuditListOption[]>([]);
  const [shipmentOptions, setShipmentOptions] = useState<ShipmentListOption[]>([]);
  const [carOptions, setCarOptions] = useState<CarListOption[]>([]);
  const [uploadAuditId, setUploadAuditId] = useState('');
  const [uploadShipmentId, setUploadShipmentId] = useState('');
  const [uploadCarId, setUploadCarId] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<
    | 'name'
    | 'notes'
    | 'supplier'
    | 'audit'
    | 'shipment'
    | 'car'
    | 'status'
    | 'file'
    | 'uploadedBy'
    | 'approvedBy'
    | 'reviewedAt'
    | 'created'
  >('created');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = user?.roleNames?.includes('Admin') ?? false;
  const isQE = user?.roleNames?.includes('QualityEngineer') ?? false;
  const isQM = user?.roleNames?.includes('QualityManager') ?? false;
  const isSupplier = user?.roleNames?.includes('Supplier') ?? false;
  const canReview = isAdmin || isQE || isQM;
  const canUpload =
    isAdmin ||
    isQE ||
    isQM ||
    user?.roleNames?.includes('Auditor') ||
    user?.roleNames?.includes('Buyer');

  const sortedRows = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const getValue = (r: RecordRow): string | number => {
      switch (sortBy) {
        case 'name':
          return r.name;
        case 'notes':
          return r.notes?.trim() ?? '';
        case 'supplier':
          return r.supplier ? `${r.supplier.code} ${r.supplier.name}` : '';
        case 'audit':
          return r.audit?.code ?? '';
        case 'shipment':
          return r.shipment?.code ?? '';
        case 'car':
          return r.car?.code ?? '';
        case 'status':
          return RECORD_REVIEW_SORT_RANK[getRecordReviewLabel(r.status)];
        case 'file':
          return r.filePath ? 1 : 0;
        case 'uploadedBy':
          return r.uploadedBy?.name?.trim() || r.uploadedBy?.email || '';
        case 'approvedBy':
          return getRecordReviewLabel(r.status) === 'Approved'
            ? r.approvedBy?.name?.trim() || r.approvedBy?.email || ''
            : '';
        case 'reviewedAt':
          return getRecordReviewLabel(r.status) === 'Pending' ? 0 : new Date(r.updatedAt).getTime();
        case 'created':
          return new Date(r.createdAt).getTime();
      }
    };
    return [...rows].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [rows, sortBy, sortDir]);
  const onSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('asc');
    }
    setPage(1);
  };
  const sortIndicator = (key: typeof sortBy) => (sortBy !== key ? '▲▼' : sortDir === 'asc' ? '↑' : '↓');

  /** Supplier used to load audit/shipment picklists and as fallback for upload when filter is "All" but URL supplies supplier. */
  const supplierForLinks = filterSupplierId || supplierSeed || '';

  const totalCount = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageSafe = Math.min(page, totalPages) || 1;
  const paginatedRows = sortedRows.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);
  const recordStats = useMemo(() => {
    const isApproved = (r: RecordRow) => getRecordReviewLabel(r.status) === 'Approved';
    const isPending = (r: RecordRow) => getRecordReviewLabel(r.status) === 'Pending';
    const source = (r: RecordRow) => (r.internalOrSupplier ?? '').trim().toLowerCase();

    const total = rows.length;
    const supplierRows = rows.filter((r) => source(r) === 'supplier');
    const internalRows = rows.filter((r) => source(r) === 'internal');
    const openRows = rows.filter(isPending);

    const pct = (approvedCount: number, base: number): string =>
      base > 0 ? `${Math.round((approvedCount / base) * 100)}% approved` : '0% approved';

    return {
      total,
      totalApprovedSubtitle: pct(rows.filter(isApproved).length, total),
      supplierTotal: supplierRows.length,
      supplierApprovedSubtitle: pct(supplierRows.filter(isApproved).length, supplierRows.length),
      internalTotal: internalRows.length,
      internalApprovedSubtitle: pct(internalRows.filter(isApproved).length, internalRows.length),
      openTotal: openRows.length,
    };
  }, [rows]);

  const load = () => {
    if (!token) return;
    const q = filterSupplierId ? `?supplierId=${encodeURIComponent(filterSupplierId)}` : '';
    apiJson<RecordRow[]>(`/records${q}`, { token }).then(setRows).catch((e) => setError(parseApiError(e)));
  };

  useEffect(() => {
    if (!token) return;
    apiJson<Supplier[]>('/suppliers', { token })
      .then((list) => setSuppliers(list))
      .catch(() => setSuppliers([]));
  }, [token]);

  useEffect(() => {
    if (!supplierSeed || suppliers.length === 0) return;
    if (suppliers.some((s) => s.id === supplierSeed)) setFilterSupplierId(supplierSeed);
  }, [supplierSeed, suppliers]);

  useEffect(() => {
    if (!token || !supplierForLinks || isSupplier || !canUpload) {
      setAuditOptions([]);
      setShipmentOptions([]);
      setCarOptions([]);
      setUploadAuditId('');
      setUploadShipmentId('');
      setUploadCarId('');
      return;
    }
    let cancelled = false;
    Promise.all([
      apiJson<AuditListOption[]>(`/audits?supplierId=${encodeURIComponent(supplierForLinks)}`, { token }),
      apiJson<ShipmentListOption[]>(`/shipments?supplierId=${encodeURIComponent(supplierForLinks)}`, { token }),
      apiJson<{ list: CarListOption[] }>(`/cars?supplierId=${encodeURIComponent(supplierForLinks)}`, { token }).then(
        (r) => r.list
      ),
    ])
      .then(([audits, shipments, cars]) => {
        if (cancelled) return;
        setAuditOptions(audits);
        setShipmentOptions(shipments);
        setCarOptions(cars);
        setUploadAuditId((id) => (id && audits.some((a) => a.id === id) ? id : ''));
        setUploadShipmentId((id) => (id && shipments.some((s) => s.id === id) ? id : ''));
        setUploadCarId((id) => (id && cars.some((c) => c.id === id) ? id : ''));
      })
      .catch(() => {
        if (!cancelled) {
          setAuditOptions([]);
          setShipmentOptions([]);
          setCarOptions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, supplierForLinks, isSupplier, canUpload]);

  /** Apply deep-link query params once lists for the supplier are loaded. */
  useEffect(() => {
    if (!auditSeed || auditOptions.length === 0) return;
    if (auditOptions.some((a) => a.id === auditSeed)) {
      setUploadAuditId(auditSeed);
      setUploadShipmentId('');
      setUploadCarId('');
    }
  }, [auditSeed, auditOptions]);

  useEffect(() => {
    if (!shipmentSeed || shipmentOptions.length === 0) return;
    if (shipmentOptions.some((s) => s.id === shipmentSeed)) {
      setUploadShipmentId(shipmentSeed);
      setUploadAuditId('');
      setUploadCarId('');
    }
  }, [shipmentSeed, shipmentOptions]);

  useEffect(() => {
    if (!carSeed || carOptions.length === 0) return;
    if (carOptions.some((c) => c.id === carSeed)) {
      setUploadCarId(carSeed);
      setUploadAuditId('');
      setUploadShipmentId('');
    }
  }, [carSeed, carOptions]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const q = filterSupplierId ? `?supplierId=${encodeURIComponent(filterSupplierId)}` : '';
    apiJson<RecordRow[]>(`/records${q}`, { token })
      .then(setRows)
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token, filterSupplierId]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(rows.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [rows.length, page, pageSize]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) return;
    const effectiveSupplierId = filterSupplierId || supplierSeed || '';
    if (!effectiveSupplierId) {
      toast.error('Choose a supplier in the filter above. The record will be linked to that supplier.');
      return;
    }
    if (!file) {
      toast.error('File is required');
      return;
    }
    if (file.size > MAX_RECORD_UPLOAD_BYTES) {
      toast.error('File exceeds current upload limit (75MB)');
      return;
    }
    const auditId = uploadAuditId.trim() || null;
    const shipId = uploadShipmentId.trim() || null;
    const carId = uploadCarId.trim() || null;
    if ([auditId, shipId, carId].filter(Boolean).length > 1) {
      toast.error('Link this record to one item only (audit, shipment, or CAR).');
      return;
    }
    setSubmitting(true);
    setUploadProgress(0);
    try {
      const payload = {
        name: name.trim(),
        supplierId: effectiveSupplierId,
        auditId,
        shipmentId: shipId,
        carId,
        internalOrSupplier: 'internal' as const,
        file,
        notes: uploadNotes.trim(),
      };
      await postRecordWithProgress(payload, token, (p) => setUploadProgress(p));
      setName('');
      setUploadNotes('');
      setUploadAuditId('');
      setUploadShipmentId('');
      setUploadCarId('');
      setFile(null);
      setUploadProgress(null);
      toast.success('Record submitted');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };
  const onFileChange = (f: File | null) => {
    if (!f) {
      setFile(null);
      setUploadProgress(null);
      return;
    }
    if (f.size > MAX_RECORD_UPLOAD_BYTES) {
      setFile(null);
      setUploadProgress(null);
      toast.error('Selected file is too large. Maximum is 75MB.');
      return;
    }
    setFile(f);
    setUploadProgress(null);
  };


  const review = async (id: string, status: 'Approved' | 'Rejected') => {
    if (!token) return;
    setReviewingId(id);
    try {
      await apiJson(`/records/${id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast.success(`Record ${status.toLowerCase()}`);
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setReviewingId(null);
    }
  };

  const download = async (r: RecordRow) => {
    if (!token || !r.filePath) return;
    try {
      setDownloading((prev) => ({ ...prev, [r.id]: 0 }));
      await downloadWithAuthProgress(`/records/${r.id}/download`, token, `${r.name}-file`, (p) => {
        setDownloading((prev) => ({ ...prev, [r.id]: p }));
      });
      toast.success('Download completed');
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDownloading((prev) => {
        const next = { ...prev };
        delete next[r.id];
        return next;
      });
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Records</h1>
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div className="card">
          <div className="card-body" style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Total Records</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{recordStats.total}</div>
            <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
              {recordStats.totalApprovedSubtitle}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Total Supplier</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{recordStats.supplierTotal}</div>
            <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
              {recordStats.supplierApprovedSubtitle}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Total Internal</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{recordStats.internalTotal}</div>
            <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
              {recordStats.internalApprovedSubtitle}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Open Records</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{recordStats.openTotal}</div>
          </div>
        </div>
      </div>

      {canUpload && !isSupplier && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Upload record</h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 0 }}>
              Choose a supplier (filter above). Optionally link this file to <strong>one</strong> audit, shipment, or CAR
              only.
            </p>
            <form onSubmit={submit}>
              <div className="input-group">
                <label className="input-label">Name *</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Audit (optional)</label>
                <select
                  className="input"
                  style={{ maxWidth: 480 }}
                  value={uploadAuditId}
                  disabled={!supplierForLinks || auditOptions.length === 0}
                  onChange={(e) => {
                    setUploadAuditId(e.target.value);
                    setUploadShipmentId('');
                    setUploadCarId('');
                  }}
                >
                  <option value="">— None —</option>
                  {auditOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.auditDate?.slice(0, 10) ?? ''} · {a.derivedStatus}
                    </option>
                  ))}
                </select>
                {!supplierForLinks ? (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    Select a supplier in the filter to load audits.
                  </span>
                ) : auditOptions.length === 0 ? (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    No audits for this supplier in your scope.
                  </span>
                ) : null}
              </div>
              <div className="input-group">
                <label className="input-label">Shipment (optional)</label>
                <select
                  className="input"
                  style={{ maxWidth: 480 }}
                  value={uploadShipmentId}
                  disabled={!supplierForLinks || shipmentOptions.length === 0}
                  onChange={(e) => {
                    setUploadShipmentId(e.target.value);
                    setUploadAuditId('');
                    setUploadCarId('');
                  }}
                >
                  <option value="">— None —</option>
                  {shipmentOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {(s.code ?? s.id).slice(0, 32)}
                      {s.inspectionDate ? ` · req. ${s.inspectionDate.slice(0, 10)}` : ''}
                    </option>
                  ))}
                </select>
                {!supplierForLinks ? (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    Select a supplier in the filter to load shipments.
                  </span>
                ) : shipmentOptions.length === 0 ? (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    No shipment requests for this supplier in your scope.
                  </span>
                ) : null}
              </div>
              <div className="input-group">
                <label className="input-label">CAR (optional)</label>
                <select
                  className="input"
                  style={{ maxWidth: 480 }}
                  value={uploadCarId}
                  disabled={!supplierForLinks || carOptions.length === 0}
                  onChange={(e) => {
                    setUploadCarId(e.target.value);
                    setUploadAuditId('');
                    setUploadShipmentId('');
                  }}
                >
                  <option value="">— None —</option>
                  {carOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {formatCarStatusForRecords(c.status)}
                    </option>
                  ))}
                </select>
                {!supplierForLinks ? (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    Select a supplier in the filter to load corrective actions.
                  </span>
                ) : carOptions.length === 0 ? (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    No CARs for this supplier in your scope.
                  </span>
                ) : (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    Opens from CAR Record with supplier and CAR pre-selected when you use Add attachment.
                  </span>
                )}
              </div>
              <div className="input-group" style={{ position: 'relative' }}>
                <label className="input-label">File *</label>
                <input
                  ref={fileInputRef}
                  className="input"
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    className="btn file-picker-btn"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Choose File
                  </button>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'inline-block',
                      maxWidth: 280,
                    }}
                    title={file?.name || 'No file chosen'}
                  >
                    {file?.name || 'No file chosen'}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 8,
                    minHeight: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <span>
                    {file
                      ? `Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB · Ext: ${file.name.includes('.') ? `.${file.name.split('.').pop()}` : '—'}`
                      : ''}
                  </span>
                  {uploadProgress !== null && file ? (
                    <span style={{ minWidth: 140, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <progress value={uploadProgress} max={100} style={{ width: 90, height: 8 }} />
                      <span>{uploadProgress}%</span>
                    </span>
                  ) : (
                    <span />
                  )}
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Notes (optional)</label>
                <textarea className="input" rows={2} value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? '…' : 'Submit'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>All records</h2>
          <div className="table-wrap">
            {loading ? (
              <p className="table-empty">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="table-empty">No records.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('name')}>
                      Name {sortIndicator('name')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('notes')}>
                      Notes {sortIndicator('notes')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('supplier')}>
                      Supplier {sortIndicator('supplier')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('audit')}>
                      Audit {sortIndicator('audit')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('shipment')}>
                      Shipment {sortIndicator('shipment')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('car')}>
                      CAR {sortIndicator('car')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('status')}>
                      Review {sortIndicator('status')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('file')}>
                      File {sortIndicator('file')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('uploadedBy')}>
                      Uploaded by {sortIndicator('uploadedBy')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('approvedBy')}>
                      Approved by {sortIndicator('approvedBy')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('reviewedAt')}>
                      Reviewed At {sortIndicator('reviewedAt')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => onSort('created')}>
                      Created {sortIndicator('created')}
                    </th>
                    {canReview ? <th>Review</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((r) => (
                    <tr key={r.id} className={`record-row record-row--${getRecordRowSlug(r.status)}`}>
                      <td>{r.name}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.notes ?? ''}>
                        {r.notes?.trim() ? r.notes : '—'}
                      </td>
                      <td>{r.supplier?.code ?? 'None'}</td>
                      <td>{r.audit?.code ?? 'None'}</td>
                      <td>{r.shipment?.code ?? 'None'}</td>
                      <td>{r.car?.code ?? 'None'}</td>
                      <td>{getRecordReviewLabel(r.status)}</td>
                      <td>
                        {r.filePath ? (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => download(r)}
                            disabled={downloading[r.id] !== undefined}
                            style={downloading[r.id] !== undefined ? { minWidth: 160 } : undefined}
                          >
                            {downloading[r.id] !== undefined ? (
                              <span style={{ minWidth: 140, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <progress value={downloading[r.id]} max={100} style={{ width: 90, height: 8 }} />
                                <span>{downloading[r.id]}%</span>
                              </span>
                            ) : (
                              'Download'
                            )}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{r.uploadedBy?.name?.trim() || '—'}</td>
                      <td>
                        {getRecordReviewLabel(r.status) === 'Approved'
                          ? r.approvedBy?.name?.trim() ||
                            r.approvedBy?.email ||
                            '—'
                          : '—'}
                      </td>
                      <td>
                        {getRecordReviewLabel(r.status) === 'Pending'
                          ? '—'
                          : new Date(r.updatedAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                      </td>
                      <td>
                        {new Date(r.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      {canReview ? (
                        <td>
                          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn"
                              style={{ background: 'var(--color-success)', color: '#fff' }}
                              disabled={reviewingId === r.id || r.status === 'Approved'}
                              title={r.status === 'Approved' ? 'Already approved' : 'Approve'}
                              onClick={() => review(r.id, 'Approved')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={reviewingId === r.id || r.status === 'Rejected'}
                              title={r.status === 'Rejected' ? 'Already rejected' : 'Reject'}
                              onClick={() => setRejectConfirmId(r.id)}
                            >
                              Reject
                            </button>
                          </span>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {rows.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, totalCount)} of {totalCount}
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)' }}>
                Rows per page:
                <select
                  className="input"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  style={{ width: 'auto' }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span style={{ alignSelf: 'center', fontSize: 'var(--text-sm)' }}>
                  Page {pageSafe} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={rejectConfirmId !== null}
        title="Reject record"
        message="Are you sure you want to reject this record?"
        confirmLabel="Reject"
        variant="danger"
        onConfirm={() => {
          if (!rejectConfirmId) return;
          void review(rejectConfirmId, 'Rejected');
          setRejectConfirmId(null);
        }}
        onCancel={() => setRejectConfirmId(null)}
      />
    </div>
  );
}
