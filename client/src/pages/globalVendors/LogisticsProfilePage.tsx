/**
 * Global Supply — Logistics profile page.
 * Opens from Logistics table to show one company's details, content, and images.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, apiJson } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';

type LogisticsAttachment = {
  id: string;
  fileName: string | null;
  fileMime: string | null;
  createdAt: string;
};

type LogisticsProfileRow = {
  id: string;
  code: string;
  siteType: string;
  company: string;
  country: string;
  registrationNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: LogisticsAttachment[];
};

function logisticsDisplayCode(code: string): string {
  return code.startsWith('LOG-') ? `BUS-${code.slice(4)}` : code;
}

function isImageAttachment(a: LogisticsAttachment): boolean {
  if (a.fileMime && a.fileMime.toLowerCase().startsWith('image/')) return true;
  const name = (a.fileName || '').toLowerCase();
  return /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(name);
}

export function LogisticsProfilePage() {
  const { token } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlLogisticsId = searchParams.get('logisticsId');

  const [rows, setRows] = useState<LogisticsProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowId, setRowId] = useState('');
  const [content, setContent] = useState('');
  const [savingContent, setSavingContent] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LogisticsAttachment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const loadRows = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await apiJson<LogisticsProfileRow[]>('/supply-logistics', { token });
      setRows(list);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (rows.length === 0) {
      setRowId('');
      return;
    }
    if (urlLogisticsId && rows.some((r) => r.id === urlLogisticsId)) {
      setRowId(urlLogisticsId);
      return;
    }
    if (urlLogisticsId && !rows.some((r) => r.id === urlLogisticsId)) {
      const first = rows[0].id;
      setRowId(first);
      setSearchParams({ logisticsId: first }, { replace: true });
      return;
    }
    setRowId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0].id));
  }, [rows, urlLogisticsId, setSearchParams]);

  const selected = useMemo(() => rows.find((r) => r.id === rowId) || null, [rows, rowId]);
  const imageAttachments = useMemo(
    () => (selected ? selected.attachments.filter(isImageAttachment) : []),
    [selected]
  );

  useEffect(() => {
    setContent(selected?.notes ?? '');
  }, [selected?.id, selected?.notes]);

  useEffect(() => {
    if (!token || !selected) {
      setImageUrls({});
      return;
    }
    const targets = selected.attachments.filter(isImageAttachment);
    if (targets.length === 0) {
      setImageUrls({});
      return;
    }
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        targets.map(async (a) => {
          try {
            const r = await apiJson<{ url: string }>(
              `/supply-logistics/${selected.id}/attachments/${a.id}/url`,
              { token }
            );
            return [a.id, r.url] as const;
          } catch {
            return [a.id, ''] as const;
          }
        })
      );
      if (cancelled) return;
      setImageUrls(
        pairs.reduce<Record<string, string>>((acc, [id, url]) => {
          if (url) acc[id] = url;
          return acc;
        }, {})
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selected]);

  const saveContent = async () => {
    if (!token || !selected || savingContent) return;
    setSavingContent(true);
    try {
      await apiJson(`/supply-logistics/${selected.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ notes: content.trim() || null }),
      });
      toast.success('Content saved');
      await loadRows();
    } catch (err) {
      let msg = 'Could not save content';
      if (err instanceof Error) {
        try {
          const j = JSON.parse(err.message) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          msg = err.message || msg;
        }
      }
      toast.error(msg);
    } finally {
      setSavingContent(false);
    }
  };

  const uploadImages = async (files: FileList | File[]) => {
    if (!token || !selected) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploadBusy(true);
    try {
      for (const file of arr) {
        const form = new FormData();
        form.append('file', file);
        const res = await apiFetch(`/supply-logistics/${selected.id}/attachments`, {
          token,
          method: 'POST',
          body: form,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
      }
      toast.success(arr.length === 1 ? 'Image added' : `${arr.length} images added`);
      await loadRows();
    } catch (err) {
      let msg = 'Could not upload image';
      if (err instanceof Error) {
        try {
          const j = JSON.parse(err.message) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          msg = err.message || msg;
        }
      }
      toast.error(msg);
    } finally {
      setUploadBusy(false);
    }
  };

  const confirmDeleteImage = async () => {
    if (!token || !selected || !deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/supply-logistics/${selected.id}/attachments/${deleteTarget.id}`, {
        token,
        method: 'DELETE',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      toast.success('Image removed');
      setDeleteTarget(null);
      await loadRows();
    } catch (err) {
      let msg = 'Could not remove image';
      if (err instanceof Error) {
        try {
          const j = JSON.parse(err.message) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          msg = err.message || msg;
        }
      }
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  if (loading && rows.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Logistics profile</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading logistics companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Logistics profile</h1>
      </header>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body">
          <label className="field" style={{ marginBottom: 0, display: 'block' }}>
            <span className="field-label">Logistics company</span>
            <select
              className="input"
              value={rowId}
              onChange={(e) => {
                const id = e.target.value;
                setRowId(id);
                setSearchParams(id ? { logisticsId: id } : {}, { replace: true });
              }}
              style={{ maxWidth: 460 }}
            >
              {rows.length === 0 ? (
                <option value="">No logistics companies yet</option>
              ) : (
                rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {logisticsDisplayCode(r.code)} - {r.company}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      </div>

      {selected ? (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Company information</h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 10,
                }}
              >
                <div>
                  <strong>Code:</strong> {logisticsDisplayCode(selected.code)}
                </div>
                <div>
                  <strong>Type:</strong> {selected.siteType}
                </div>
                <div>
                  <strong>Company:</strong> {selected.company}
                </div>
                <div>
                  <strong>Country:</strong> {selected.country}
                </div>
                <div>
                  <strong>Registration #:</strong> {selected.registrationNumber || '—'}
                </div>
                <div>
                  <strong>Latitude:</strong> {typeof selected.latitude === 'number' ? selected.latitude : '—'}
                </div>
                <div>
                  <strong>Longitude:</strong> {typeof selected.longitude === 'number' ? selected.longitude : '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Content and images</h2>

              <label className="field">
                <span className="field-label">Content</span>
                <textarea
                  className="input"
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write profile content for this logistics company..."
                />
              </label>
              <div style={{ marginBottom: 14 }}>
                <button type="button" className="btn btn-primary" onClick={() => void saveContent()} disabled={savingContent}>
                  {savingContent ? 'Saving...' : 'Save content'}
                </button>
              </div>

              <p className="field-label" style={{ marginBottom: 10 }}>
                Images (JPEG, PNG, WebP, or GIF)
              </p>
              <div style={{ marginBottom: 12 }}>
                <label className="btn btn-sm btn-ghost">
                  {uploadBusy ? 'Uploading...' : 'Add image'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const list = e.target.files;
                      if (list?.length) void uploadImages(list);
                      e.target.value = '';
                    }}
                    disabled={uploadBusy || savingContent}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {imageAttachments.length === 0 ? (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>No images yet.</span>
                ) : null}
                {imageAttachments.map((img) => (
                  <div key={img.id} style={{ width: 140 }}>
                    {imageUrls[img.id] ? (
                      <img
                        src={imageUrls[img.id]}
                        alt={img.fileName || selected.company}
                        style={{
                          width: '100%',
                          height: 104,
                          objectFit: 'cover',
                          borderRadius: 6,
                          border: '1px solid var(--color-border)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          height: 104,
                          borderRadius: 6,
                          border: '1px dashed var(--color-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          color: 'var(--color-text-muted)',
                          padding: 8,
                          textAlign: 'center',
                        }}
                      >
                        Preview unavailable
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      style={{ marginTop: 6, color: 'var(--color-danger, #b91c1c)', width: '100%' }}
                      disabled={uploadBusy || deleting}
                      onClick={() => setDeleteTarget(img)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove image?"
        message={
          deleteTarget ? (
            <span>
              Remove this image{deleteTarget.fileName ? ` (${deleteTarget.fileName})` : ''}? This cannot be undone.
            </span>
          ) : (
            ''
          )
        }
        confirmLabel={deleting ? 'Removing...' : 'Remove'}
        variant="danger"
        onConfirm={() => void confirmDeleteImage()}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  );
}
