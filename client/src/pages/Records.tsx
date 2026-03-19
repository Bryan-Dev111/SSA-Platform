/**
 * Day 10: Records list (scoped); upload Supplier/Auditor/Buyer/Admin/QE; Admin/QE approve-reject; download.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError, readFileAsBase64, downloadWithAuth } from '../utils/apiHelpers';

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
  supplierId: string;
  supplier: { id: string; code: string; name: string };
  uploadedBy: { id: string; email: string; name: string | null } | null;
  createdAt: string;
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
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

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
    if (!token || !name.trim() || !supplierId) return;
    if (isSupplier && source !== 'supplier') {
      toast.error('Suppliers may only submit supplier-sourced records');
      return;
    }
    if (file && file.size > 8 * 1024 * 1024) {
      toast.error('File must be 8MB or smaller');
      return;
    }
    setSubmitting(true);
    try {
      let fileBase64: string | undefined;
      let fileName: string | undefined;
      if (file) {
        fileBase64 = await readFileAsBase64(file);
        fileName = file.name;
      }
      await apiJson('/records', {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          supplierId,
          internalOrSupplier: source,
          ...(fileBase64 ? { fileBase64, fileName } : {}),
        }),
      });
      setName('');
      setFile(null);
      toast.success('Record submitted');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
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
                {!isSupplier && (
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Supplier *</label>
                    <select
                      className="input"
                      required
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Name *</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">File (optional)</label>
                  <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
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
                      <td>{r.supplier?.code ?? '—'}</td>
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
                      <td>{r.uploadedBy?.email ?? '—'}</td>
                      <td>{new Date(r.createdAt).toLocaleString()}</td>
                      {canReview ? (
                        <td>
                          {r.status === 'PENDING' ? (
                            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn"
                                style={{ background: 'var(--color-success)', color: '#fff' }}
                                disabled={reviewingId === r.id}
                                onClick={() => review(r.id, 'Approved')}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger"
                                disabled={reviewingId === r.id}
                                onClick={() => review(r.id, 'Rejected')}
                              >
                                Reject
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
    </div>
  );
}
