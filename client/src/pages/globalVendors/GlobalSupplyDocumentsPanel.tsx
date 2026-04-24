import { useEffect, useMemo, useRef, useState } from 'react';
import { apiJson } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { parseApiError, downloadWithAuthProgress } from '../../utils/apiHelpers';

type InternalRow = {
  id: string;
  name: string;
  category: string | null;
  note: string | null;
  filePath: string | null;
  updatedAt: string;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
};

export function GlobalSupplyDocumentsPanel({
  token,
  toast,
  canDelete = false,
}: {
  token: string | null;
  toast: ToastApi;
  canDelete?: boolean;
}) {
  const [rows, setRows] = useState<InternalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const documentRows = useMemo(
    () => rows.filter((r) => (r.category ?? '').toLowerCase() === 'document'),
    [rows]
  );

  const load = () => {
    if (!token) return;
    apiJson<InternalRow[]>('/internal-docs', { token })
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token refresh only
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) return;
    if (file && file.size > 8 * 1024 * 1024) {
      toast.error('File must be 8MB or smaller');
      return;
    }
    setSubmitting(true);
    setUploadProgress(file ? 0 : null);
    try {
      let fileBase64: string | undefined;
      let fileName: string | undefined;
      if (file) {
        fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onprogress = (evt) => {
            if (!evt.lengthComputable) return;
            setUploadProgress(Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100))));
          };
          reader.onload = () => {
            const s = reader.result as string;
            const i = s.indexOf(',');
            setUploadProgress(100);
            resolve(i >= 0 ? s.slice(i + 1) : s);
          };
          reader.onerror = () => reject(new Error('Could not read file'));
          reader.readAsDataURL(file);
        });
        fileName = file.name;
      }
      await apiJson('/internal-docs', {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          category: 'Document',
          note: note.trim() || null,
          ...(fileBase64 ? { fileBase64, fileName } : {}),
        }),
      });
      setName('');
      setNote('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadProgress(null);
      toast.success('Saved');
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
      await apiJson(`/internal-docs/${id}`, { token, method: 'DELETE' });
      toast.success('Deleted');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDeletingId(null);
    }
  };

  const download = async (r: InternalRow) => {
    if (!token || !r.filePath) {
      toast.error('No file attached');
      return;
    }
    try {
      setDownloading((prev) => ({ ...prev, [r.id]: 0 }));
      await downloadWithAuthProgress(`/internal-docs/${r.id}/download`, token, r.name, (p) => {
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
    <>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Upload</h2>
          <form onSubmit={submit}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 1fr) minmax(220px, 1.2fr) minmax(240px, 1.2fr) auto',
                gap: '0.75rem',
                alignItems: 'flex-end',
                paddingBottom: 22,
              }}
            >
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Name *</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Notes</label>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="input-group" style={{ marginBottom: 0, position: 'relative' }}>
                <label className="input-label">File (optional)</label>
                <input
                  ref={fileInputRef}
                  className="input"
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setUploadProgress(null);
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" className="btn file-picker-btn" onClick={() => fileInputRef.current?.click()}>
                    Choose file
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
                      ? `Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB · Ext: ${
                          file.name.includes('.') ? `.${file.name.split('.').pop()}` : '-'
                        }`
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
                {submitting ? '...' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Library</h2>
          <div className="table-wrap">
            {loading ? (
              <p className="table-empty">Loading...</p>
            ) : documentRows.length === 0 ? (
              <p className="table-empty">No documents.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Notes</th>
                    <th>View</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {documentRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td>{r.note ?? '-'}</td>
                      <td>
                        {r.filePath ? (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => void download(r)}
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
                          '-'
                        )}
                      </td>
                      <td>{new Date(r.updatedAt).toLocaleString()}</td>
                      <td>
                        {canDelete ? (
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={deletingId === r.id}
                            onClick={() => setDeleteConfirmId(r.id)}
                          >
                            Delete
                          </button>
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
        open={canDelete && deleteConfirmId !== null}
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
    </>
  );
}
