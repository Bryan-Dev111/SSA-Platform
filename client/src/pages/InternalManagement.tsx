/**
 * Day 10: Internal Management — contracts, SOW, etc. Admin only.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError, readFileAsBase64, downloadWithAuth } from '../utils/apiHelpers';
import { Navigate } from 'react-router-dom';
import { getDefaultPath } from '../config/rolePageAccess';

interface InternalRow {
  id: string;
  name: string;
  category: string | null;
  note: string | null;
  filePath: string | null;
  createdAt: string;
  updatedAt: string;
}

export function InternalManagement() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<InternalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = user?.roleNames?.includes('Admin') ?? false;

  const load = () => {
    if (!token) return;
    apiJson<InternalRow[]>('/internal-docs', { token })
      .then(setRows)
      .catch((e) => setError(parseApiError(e)));
  };

  useEffect(() => {
    if (!token || !isAdmin) return;
    setLoading(true);
    setError(null);
    apiJson<InternalRow[]>('/internal-docs', { token })
      .then(setRows)
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token, isAdmin]);

  if (user && !isAdmin) {
    return <Navigate to={getDefaultPath(user.roleNames)} replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) return;
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
      await apiJson('/internal-docs', {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || null,
          note: note.trim() || null,
          ...(fileBase64 ? { fileBase64, fileName } : {}),
        }),
      });
      setName('');
      setCategory('');
      setNote('');
      setFile(null);
      toast.success('Saved');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!token || !confirm('Delete this item?')) return;
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
      await downloadWithAuth(`/internal-docs/${r.id}/download`, token, r.name);
    } catch (e) {
      toast.error(parseApiError(e));
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Internal Management</h1>
        <p className="page-description">Internal contracts, SOWs, and other non-supplier documents (Admin only).</p>
      </header>

      {error && <div className="alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Upload</h2>
          <form onSubmit={submit}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '0.75rem',
                alignItems: 'flex-end',
              }}
            >
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Name *</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Type</label>
                <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Note</label>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">File (optional)</label>
                <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? '…' : 'Add'}
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
              <p className="table-empty">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="table-empty">No internal documents.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Note</th>
                    <th>View</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td>{r.category ?? '—'}</td>
                      <td>{r.note ?? '—'}</td>
                      <td>
                        {r.filePath ? (
                          <button type="button" className="btn" onClick={() => download(r)}>
                            Download
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{new Date(r.updatedAt).toLocaleString()}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={deletingId === r.id}
                          onClick={() => remove(r.id)}
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
    </div>
  );
}
