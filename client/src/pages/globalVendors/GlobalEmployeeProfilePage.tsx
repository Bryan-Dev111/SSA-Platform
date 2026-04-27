/**
 * Employee / contractor profile: narrative content + image gallery (Internal Management roster).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, apiJson } from '../../api/client';
import { parseApiError } from '../../utils/apiHelpers';
import { ConfirmDialog } from '../../components/ConfirmDialog';

type ProfileImage = {
  id: string;
  fileName: string | null;
  fileMime: string | null;
  sortOrder: number | null;
  createdAt: string;
  url: string | null;
};

type ProfileResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    isEmployee: boolean;
    isContractor: boolean;
    assignedCountryNames: string[];
  };
  body: string;
  canEdit: boolean;
  images: ProfileImage[];
};

export function GlobalEmployeeProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { pathname } = useLocation();
  const { token } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bodyDraft, setBodyDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProfileImage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const backHref = useMemo(() => {
    if (pathname.includes('/global-vendors/')) return '/global-vendors/internal-management';
    return '/internal-management';
  }, [pathname]);

  const load = useCallback(async () => {
    if (!token || !userId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const r = await apiJson<ProfileResponse>(`/employee-profiles/${userId}`, { token });
      setData(r);
      setBodyDraft(r.body);
    } catch (e) {
      setData(null);
      setLoadError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveBody = async () => {
    if (!token || !userId || !data?.canEdit) return;
    setSaving(true);
    try {
      await apiJson(`/employee-profiles/${userId}`, {
        token,
        method: 'PUT',
        body: JSON.stringify({ body: bodyDraft }),
      });
      toast.success('Profile text saved');
      await load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (file: File) => {
    if (!token || !userId || !data?.canEdit) return;
    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch(`/employee-profiles/${userId}/images`, {
        token,
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      toast.success('Image uploaded');
      await load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setUploadBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !userId || !deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/employee-profiles/${userId}/images/${deleteTarget.id}`, {
        token,
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      toast.success('Image removed');
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDeleting(false);
    }
  };

  if (!userId) {
    return (
      <div className="page">
        <div className="alert-error">Missing employee id.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading-message" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="loading-spinner" />
          <p style={{ margin: 0 }}>Loading profile…</p>
        </div>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Employee profile</h1>
        </header>
        <div className="alert-error" role="alert">
          {loadError || 'Profile could not be loaded.'}
        </div>
        <p style={{ marginTop: '1rem' }}>
          <Link to={backHref}>Back to Internal Management</Link>
        </p>
      </div>
    );
  }

  const { user, canEdit, images } = data;
  const displayName = user.name?.trim() || user.email;
  const typeLabel = user.isContractor ? 'Contractor' : 'Employee';

  return (
    <div className="page">
      <header className="page-header" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.75rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          {displayName}
        </h1>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {typeLabel} · {user.email}
        </span>
      </header>
      <p style={{ marginTop: 0, marginBottom: '1rem' }}>
        <Link to={backHref}>Back to Internal Management</Link>
      </p>

      {user.assignedCountryNames.length > 0 && (
        <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: '1rem' }}>
          <strong>Countries:</strong> {user.assignedCountryNames.join(', ')}
        </p>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Profile content</h2>
          <textarea
            className="input"
            value={bodyDraft}
            onChange={(e) => setBodyDraft(e.target.value)}
            readOnly={!canEdit}
            rows={14}
            style={{ width: '100%', minHeight: 220, resize: 'vertical', fontFamily: 'inherit' }}
            aria-label="Profile text"
          />
          {canEdit ? (
            <div style={{ marginTop: '0.75rem' }}>
              <button type="button" className="btn btn-primary" onClick={() => void saveBody()} disabled={saving}>
                {saving ? 'Saving…' : 'Save text'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Pictures</h2>
          {canEdit ? (
            <div style={{ marginBottom: '1rem' }}>
              <label className="input-label" htmlFor="emp-profile-upload">
                Upload image (JPEG, PNG, WebP, or GIF)
              </label>
              <input
                id="emp-profile-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploadBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void uploadImage(f);
                }}
              />
            </div>
          ) : null}
          {images.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)' }}>No images yet.</p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '1rem',
              }}
            >
              {images.map((img) => (
                <figure
                  key={img.id}
                  style={{
                    margin: 0,
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: 'var(--color-bg-subtle, #f4f4f5)',
                  }}
                >
                  {img.url ? (
                    <a href={img.url} target="_blank" rel="noreferrer">
                      <img src={img.url} alt={img.fileName || 'Profile'} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                    </a>
                  ) : (
                    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-sm)' }}>
                      Preview unavailable
                    </div>
                  )}
                  <figcaption style={{ padding: '0.5rem', fontSize: 'var(--text-xs)', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.fileName || img.id}</span>
                    {canEdit ? (
                      <button type="button" className="btn btn-ghost" style={{ padding: '0.15rem 0.35rem', fontSize: 'var(--text-xs)' }} onClick={() => setDeleteTarget(img)}>
                        Remove
                      </button>
                    ) : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove image?"
        message="This permanently deletes the file from storage."
        confirmLabel={deleting ? 'Removing…' : 'Remove'}
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
