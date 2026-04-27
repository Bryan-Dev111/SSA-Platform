/**
 * Admin — Command Media (document library, same /documents API as the Command Media page).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiJson } from '../../api/client';
import { parseApiError, downloadWithAuthProgress } from '../../utils/apiHelpers';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SortableTh } from '../../components/SortableTh';
import { cmpNum, cmpStr, dateMs, toggleSort, type SortDir } from '../../utils/tableSort';
import { getDocumentLocale } from '../../i18n/locale';
import {
  COMMAND_MEDIA_DOCUMENT_TYPES,
  commandMediaDocumentTypeLabel,
} from '../../constants/commandMedia';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface CommandMediaApiRow {
  id: string;
  documentNumber: string;
  name: string;
  category: string | null;
  documentType: string;
  filePath: string | null;
  createdAt: string;
}

interface CommandMediaRow {
  id: string;
  documentNumber: string;
  name: string;
  revision: string | null;
  documentType: string;
  filePath: string | null;
  createdAt: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

interface AdminCommandMediaPanelProps {
  token: string | null;
  toast: ToastApi;
}

function formatCommandMediaDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(getDocumentLocale(), { year: 'numeric', month: 'short', day: 'numeric' });
}

export function AdminCommandMediaPanel({ token, toast }: AdminCommandMediaPanelProps) {
  const [form, setForm] = useState({
    documentNumber: '',
    name: '',
    documentType: 'Procedure',
    revision: '',
    file: null as File | null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<CommandMediaRow[]>([]);
  const [downloading, setDownloading] = useState<Record<string, number>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tableSort, setTableSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: 'asc' });

  const displayRows = useMemo(() => {
    if (!tableSort.key) return rows;
    const { key: k, dir } = tableSort;
    const list = [...rows];
    list.sort((a, b) => {
      switch (k) {
        case 'type':
          return cmpStr(
            commandMediaDocumentTypeLabel(a.documentType),
            commandMediaDocumentTypeLabel(b.documentType),
            dir
          );
        case 'number':
          return cmpStr(a.documentNumber, b.documentNumber, dir);
        case 'name':
          return cmpStr(a.name, b.name, dir);
        case 'revision':
          return cmpStr(a.revision ?? '', b.revision ?? '', dir);
        case 'created':
          return cmpNum(dateMs(a.createdAt), dateMs(b.createdAt), dir);
        default:
          return 0;
      }
    });
    return list;
  }, [rows, tableSort]);

  const load = useCallback(() => {
    if (!token) return;
    apiJson<CommandMediaApiRow[]>('/documents', { token })
      .then((docs) =>
        setRows(
          docs.map((r) => ({
            ...r,
            revision: r.category,
          }))
        )
      )
      .catch(() => setRows([]));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.documentNumber.trim() || !form.name.trim()) return;
    if (form.file && form.file.size > 150 * 1024 * 1024) {
      toast.error('File must be 150MB or smaller');
      return;
    }
    setSubmitting(true);
    setUploadProgress(form.file ? 0 : null);
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/documents`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (evt) => {
          if (!evt.lengthComputable) return;
          setUploadProgress(Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100))));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            resolve();
          } else {
            reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error while uploading file'));
        const data = new FormData();
        data.append('documentNumber', form.documentNumber.trim());
        data.append('name', form.name.trim());
        data.append('documentType', form.documentType);
        data.append('revision', form.revision.trim());
        if (form.file) data.append('file', form.file);
        xhr.send(data);
      });

      setForm({
        documentNumber: '',
        name: '',
        documentType: 'Procedure',
        revision: '',
        file: null,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadProgress(null);
      toast.success('Command media uploaded');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const downloadRow = async (r: CommandMediaRow) => {
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

  return (
    <>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Add document</h2>
          <form onSubmit={submit}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '0.75rem',
                alignItems: 'end',
              }}
            >
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Type *</label>
                <select
                  className="input"
                  value={form.documentType}
                  onChange={(e) => setForm((p) => ({ ...p, documentType: e.target.value }))}
                >
                  {COMMAND_MEDIA_DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Document Number *</label>
                <input
                  className="input"
                  value={form.documentNumber}
                  onChange={(e) => setForm((p) => ({ ...p, documentNumber: e.target.value }))}
                  required
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Revision</label>
                <input className="input" value={form.revision} onChange={(e) => setForm((p) => ({ ...p, revision: e.target.value }))} />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">File (optional)</label>
                <input
                  ref={fileInputRef}
                  className="input"
                  type="file"
                  onChange={(e) => setForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create'}
              </button>
            </div>
            {uploadProgress !== null && (
              <div style={{ marginTop: 8, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                Upload progress: {uploadProgress}%
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Library</h2>
          <div className="table-wrap">
            {rows.length === 0 ? (
              <p className="table-empty">No documents.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <SortableTh
                      label="Type"
                      columnKey="type"
                      activeKey={tableSort.key}
                      dir={tableSort.dir}
                      onSort={(col) => setTableSort((p) => toggleSort(p, col))}
                    />
                    <SortableTh
                      label="Number"
                      columnKey="number"
                      activeKey={tableSort.key}
                      dir={tableSort.dir}
                      onSort={(col) => setTableSort((p) => toggleSort(p, col))}
                    />
                    <SortableTh
                      label="Name"
                      columnKey="name"
                      activeKey={tableSort.key}
                      dir={tableSort.dir}
                      onSort={(col) => setTableSort((p) => toggleSort(p, col))}
                    />
                    <SortableTh
                      label="Revision"
                      columnKey="revision"
                      activeKey={tableSort.key}
                      dir={tableSort.dir}
                      onSort={(col) => setTableSort((p) => toggleSort(p, col))}
                    />
                    <SortableTh
                      label="Created"
                      columnKey="created"
                      activeKey={tableSort.key}
                      dir={tableSort.dir}
                      onSort={(col) => setTableSort((p) => toggleSort(p, col))}
                    />
                    <th>View</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((r) => (
                    <tr key={r.id}>
                      <td>{commandMediaDocumentTypeLabel(r.documentType)}</td>
                      <td>{r.documentNumber}</td>
                      <td>{r.name}</td>
                      <td>{r.revision ?? '—'}</td>
                      <td>{formatCommandMediaDate(r.createdAt)}</td>
                      <td>
                        {r.filePath ? (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => void downloadRow(r)}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
    </>
  );
}
