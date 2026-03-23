/**
 * Day 10: Policies, SOPs, etc. — list & view for authorized roles; Admin/QE manage.
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError, downloadWithAuthProgress } from '../utils/apiHelpers';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface DocumentRow {
  id: string;
  documentNumber: string;
  name: string;
  revision: string | null;
  documentType: string;
  filePath: string | null;
  createdAt: string;
}

interface DocumentApiRow {
  id: string;
  documentNumber: string;
  name: string;
  category: string | null;
  documentType: string;
  filePath: string | null;
  createdAt: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function postDocumentWithProgress(
  payload: {
    documentNumber: string;
    name: string;
    documentType: string;
    revision: string;
    file: File | null;
  },
  token: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/documents`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      onProgress(Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100))));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error while uploading file'));
    const form = new FormData();
    form.append('documentNumber', payload.documentNumber);
    form.append('name', payload.name);
    form.append('documentType', payload.documentType);
    form.append('revision', payload.revision);
    if (payload.file) form.append('file', payload.file);
    xhr.send(form);
  });
}

const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'Procedure', label: 'Procedure' },
  { value: 'Policy', label: 'Policy' },
  { value: 'QualityManual', label: 'Quality Manual' },
  { value: 'Standard', label: 'Standard' },
  { value: 'StandardOperatingProcedure', label: 'SOP' },
  { value: 'WorkInstruction', label: 'Work Instruction' },
  { value: 'Form', label: 'Form' },
];

function typeLabel(t: string): string {
  return DOC_TYPES.find((d) => d.value === t)?.label ?? t;
}

export function Documents() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [docNum, setDocNum] = useState('');
  const [name, setName] = useState('');
  const [revision, setRevision] = useState('');
  const [docType, setDocType] = useState('Procedure');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canMutate =
    (user?.roleNames?.includes('Admin') ?? false) || (user?.roleNames?.includes('QualityEngineer') ?? false);
  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageSafe = Math.min(page, totalPages) || 1;
  const paginatedRows = rows.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const load = () => {
    if (!token) return;
    apiJson<DocumentApiRow[]>('/documents', { token })
      .then((list) =>
        setRows(
          list.map((r) => ({
            ...r,
            revision: r.category,
          }))
        )
      )
      .catch((e) => setError(parseApiError(e)));
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    apiJson<DocumentApiRow[]>('/documents', { token })
      .then((list) =>
        setRows(
          list.map((r) => ({
            ...r,
            revision: r.category,
          }))
        )
      )
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(rows.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [rows.length, page, pageSize]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !docNum.trim() || !name.trim()) return;
    if (file && file.size > 150 * 1024 * 1024) {
      toast.error('File must be 150MB or smaller');
      return;
    }
    setSubmitting(true);
    setUploadProgress(file ? 0 : null);
    try {
      await postDocumentWithProgress(
        {
          documentNumber: docNum.trim(),
          name: name.trim(),
          documentType: docType,
          revision: revision.trim(),
          file,
        },
        token,
        (p) => setUploadProgress(p)
      );
      setDocNum('');
      setName('');
      setRevision('');
      setDocType('Procedure');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadProgress(null);
      toast.success('Document created');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const remove = async (id: string) => {
    if (!token) return;
    setDeleteConfirmId(null);
    setDeletingId(id);
    try {
      await apiJson(`/documents/${id}`, { token, method: 'DELETE' });
      toast.success('Deleted');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDeletingId(null);
    }
  };

  const download = async (r: DocumentRow) => {
    if (!token || !r.filePath) {
      toast.error('No file attached');
      return;
    }
    try {
      setDownloading((prev) => ({ ...prev, [r.id]: 0 }));
      await downloadWithAuthProgress(`/documents/${r.id}/download`, token, `${r.documentNumber}-${r.name}`, (p) => {
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
        <h1 className="page-title">Documents</h1>
        <p className="page-description">
          Controlled policies, procedures, SOPs, work instructions, and forms.
        </p>
      </header>

      {error && <div className="alert-error">{error}</div>}

      {canMutate && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Add document</h2>
            <form onSubmit={submit}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'minmax(180px, 1fr) minmax(180px, 1fr) minmax(140px, 0.9fr) minmax(140px, 0.9fr) minmax(240px, 1.2fr) auto',
                  gap: '0.75rem',
                  alignItems: 'flex-end',
                  paddingBottom: 22,
                }}
              >
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Document Number *</label>
                  <input className="input" value={docNum} onChange={(e) => setDocNum(e.target.value)} required />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Name *</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Type *</label>
                  <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
                    {DOC_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Revision</label>
                  <input className="input" value={revision} onChange={(e) => setRevision(e.target.value)} />
                </div>
                <div className="input-group" style={{ marginBottom: 0, position: 'relative' }}>
                  <label className="input-label">File (optional)</label>
                  <input
                    ref={fileInputRef}
                    className="input"
                    type="file"
                    style={{ display: 'none' }}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
                        maxWidth: 170,
                      }}
                      title={file?.name || 'No file chosen'}
                    >
                      {file?.name || 'No file chosen'}
                    </span>
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 4,
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
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? '…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Library</h2>
          <div className="table-wrap">
            {loading ? (
              <p className="table-empty">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="table-empty">No documents.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Number</th>
                    <th>Name</th>
                    <th>Revision</th>
                    <th>View</th>
                    {canMutate ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((r) => (
                    <tr key={r.id}>
                      <td>{typeLabel(r.documentType)}</td>
                      <td>{r.documentNumber}</td>
                      <td>{r.name}</td>
                      <td>{r.revision ?? '—'}</td>
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
                      {canMutate ? (
                        <td>
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={deletingId === r.id}
                            onClick={() => setDeleteConfirmId(r.id)}
                          >
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
        open={deleteConfirmId !== null}
        title="Delete document"
        message="Delete this document? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (!deleteConfirmId) return;
          void remove(deleteConfirmId);
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
