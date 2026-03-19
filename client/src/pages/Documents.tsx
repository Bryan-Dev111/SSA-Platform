/**
 * Day 10: Policies, SOPs, etc. — list & view for authorized roles; Admin/QE manage.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError, readFileAsBase64, downloadWithAuth } from '../utils/apiHelpers';

interface DocumentRow {
  id: string;
  documentNumber: string;
  name: string;
  category: string | null;
  documentType: string;
  filePath: string | null;
  createdAt: string;
}

const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'Procedure', label: 'Procedure' },
  { value: 'Policy', label: 'Policy' },
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
  const [category, setCategory] = useState('');
  const [docType, setDocType] = useState('Procedure');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canMutate =
    (user?.roleNames?.includes('Admin') ?? false) || (user?.roleNames?.includes('QualityEngineer') ?? false);

  const load = () => {
    if (!token) return;
    apiJson<DocumentRow[]>('/documents', { token })
      .then(setRows)
      .catch((e) => setError(parseApiError(e)));
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    apiJson<DocumentRow[]>('/documents', { token })
      .then(setRows)
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !docNum.trim() || !name.trim()) return;
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
      await apiJson('/documents', {
        token,
        method: 'POST',
        body: JSON.stringify({
          documentNumber: docNum.trim(),
          name: name.trim(),
          category: category.trim() || null,
          documentType: docType,
          ...(fileBase64 ? { fileBase64, fileName } : {}),
        }),
      });
      setDocNum('');
      setName('');
      setCategory('');
      setFile(null);
      toast.success('Document created');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!token || !confirm('Delete this document?')) return;
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
      await downloadWithAuth(`/documents/${r.id}/download`, token, `${r.documentNumber}-${r.name}`);
    } catch (e) {
      toast.error(parseApiError(e));
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
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '0.75rem',
                  alignItems: 'flex-end',
                }}
              >
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Document # *</label>
                  <input className="input" value={docNum} onChange={(e) => setDocNum(e.target.value)} required />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Name *</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Category</label>
                  <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} />
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
                  <label className="input-label">File (optional)</label>
                  <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
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
                    <th>#</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>View</th>
                    {canMutate ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.documentNumber}</td>
                      <td>{r.name}</td>
                      <td>{typeLabel(r.documentType)}</td>
                      <td>{r.category ?? '—'}</td>
                      <td>
                        {r.filePath ? (
                          <button type="button" className="btn" onClick={() => download(r)}>
                            Download
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
                            onClick={() => remove(r.id)}
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
        </div>
      </div>
    </div>
  );
}
