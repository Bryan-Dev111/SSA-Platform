/**
 * Day 10: Records list (scoped); upload Supplier/Auditor/Buyer/Admin/QE; Admin/QE approve-reject; download.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError, downloadWithAuth } from '../utils/apiHelpers';
import { ConfirmDialog } from '../components/ConfirmDialog';

const MAX_UPLOAD_BYTES = 75 * 1024 * 1024;
const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface RecordRow {
  id: string;
  name: string;
  internalOrSupplier: string;
  status: string;
  filePath: string | null;
  supplierId: string | null;
  supplier: { id: string; code: string; name: string } | null;
  uploadedBy: { id: string; email: string; name: string | null } | null;
  createdAt: string;
}

function postRecordWithProgress(
  payload: { name: string; supplierId: string | null; internalOrSupplier: 'supplier' | 'internal'; file: File | null },
  token: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    console.log('[Records Upload] Request started');
    xhr.open('POST', `${API_BASE}/records`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const percent = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
      console.log(`[Records Upload] Progress: ${percent}% (${evt.loaded}/${evt.total} bytes)`);
      onProgress(percent);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log('[Records Upload] Completed successfully');
        onProgress(100);
        resolve();
      } else {
        console.log(`[Records Upload] Failed: HTTP ${xhr.status}`, xhr.responseText);
        reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => {
      console.log('[Records Upload] Network error');
      reject(new Error('Network error while uploading file'));
    };
    const form = new FormData();
    form.append('name', payload.name);
    form.append('internalOrSupplier', payload.internalOrSupplier);
    form.append('supplierId', payload.supplierId ?? '');
    if (payload.file) form.append('file', payload.file);
    xhr.send(form);
  });
}

export function Records() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [source, setSource] = useState<'supplier' | 'internal'>('supplier');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null);

  const isAdmin = user?.roleNames?.includes('Admin') ?? false;
  const isQE = user?.roleNames?.includes('QualityEngineer') ?? false;
  const isSupplier = user?.roleNames?.includes('Supplier') ?? false;
  const canReview = isAdmin || isQE;
  const canUpload =
    isAdmin ||
    isQE ||
    isSupplier ||
    user?.roleNames?.includes('Auditor') ||
    user?.roleNames?.includes('Buyer');

  const load = () => {
    if (!token) return;
    const q = filterSupplierId ? `?supplierId=${encodeURIComponent(filterSupplierId)}` : '';
    apiJson<RecordRow[]>(`/records${q}`, { token }).then(setRows).catch((e) => setError(parseApiError(e)));
  };

  useEffect(() => {
    if (!token) return;
    apiJson<Supplier[]>('/suppliers', { token })
      .then((list) => {
        setSuppliers(list);
        if (isSupplier && list.length === 1) {
          setSupplierId(list[0].id);
        }
      })
      .catch(() => setSuppliers([]));
  }, [token, isSupplier]);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) return;
    if (isSupplier && source !== 'supplier') {
      toast.error('Suppliers may only submit supplier-sourced records');
      return;
    }
    if (file && file.size > MAX_UPLOAD_BYTES) {
      toast.error('File exceeds current upload limit (75MB)');
      return;
    }
    setSubmitting(true);
    setUploadProgress(file ? 0 : null);
    try {
      const payload = {
        name: name.trim(),
        supplierId: supplierId || null,
        internalOrSupplier: source,
        file: file ?? null,
      };
      await postRecordWithProgress(payload, token, (p) => setUploadProgress(p));
      setName('');
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
      console.log('[Records Upload] File cleared');
      setFile(null);
      setUploadProgress(null);
      return;
    }
    console.log(`[Records Upload] File selected: ${f.name} (${f.size} bytes)`);
    if (f.size > MAX_UPLOAD_BYTES) {
      console.log(`[Records Upload] File rejected: exceeds ${MAX_UPLOAD_BYTES} bytes`);
      setFile(null);
      setUploadProgress(null);
      toast.error('Selected file is too large. Maximum is 75MB.');
      return;
    }
    setFile(f);
    setUploadProgress(0);
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
      await downloadWithAuth(`/records/${r.id}/download`, token, `${r.name}-file`);
    } catch (e) {
      toast.error(parseApiError(e));
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Records</h1>
        <p className="page-description">
          Supplier and internal quality records. Admin and QE approve or reject pending items.
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

      {canUpload && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Upload record</h2>
            <form onSubmit={submit}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '0.75rem',
                  alignItems: 'flex-end',
                }}
              >
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Name *</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                {!isSupplier && (
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Source</label>
                    <select
                      className="input"
                      value={source}
                      onChange={(e) => setSource(e.target.value as 'supplier' | 'internal')}
                    >
                      <option value="supplier">Supplier</option>
                      <option value="internal">Internal</option>
                    </select>
                  </div>
                )}
                {!isSupplier && (
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Supplier</label>
                    <select
                      className="input"
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                    >
                      <option value="">None</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span>File (optional)</span>
                    {uploadProgress !== null && file && (
                      <span style={{ minWidth: 140, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <progress value={uploadProgress} max={100} style={{ width: 90, height: 8 }} />
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{uploadProgress}%</span>
                      </span>
                    )}
                  </label>
                  <input className="input" type="file" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? '…' : 'Submit'}
                </button>
              </div>
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
                    <th>Name</th>
                    <th>Supplier</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>File</th>
                    <th>Uploaded by</th>
                    <th>Created</th>
                    {canReview ? <th>Review</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td>{r.supplier?.code ?? 'None'}</td>
                      <td>{r.internalOrSupplier}</td>
                      <td>{r.status}</td>
                      <td>
                        {r.filePath ? (
                          <button type="button" className="btn" onClick={() => download(r)}>
                            Download
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{r.uploadedBy?.name?.trim() || '—'}</td>
                      <td>{new Date(r.createdAt).toLocaleString()}</td>
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
                              disabled={reviewingId === r.id}
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
