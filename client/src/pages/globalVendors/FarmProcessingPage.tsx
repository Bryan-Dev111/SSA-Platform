/**
 * Global Vendors — Processing & Quality page, sharing the same CMS-lite system.
 */
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, apiJson } from '../../api/client';
import type { FarmRow } from './FarmersInformationPage';

type ProcessingContent = {
  id: string | null;
  farmId: string;
  section: 'Profile' | 'Processing';
  body: string;
};

type ProcessingImage = {
  id: string;
  section: 'Profile' | 'Processing';
  fileName: string | null;
};

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const IMAGE_BASE = API_BASE.replace(/\/$/, '');

export function FarmProcessingPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { token, user } = useAuth();
  const toast = useToast();
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [content, setContent] = useState<ProcessingContent | null>(null);
  const [contentSaving, setContentSaving] = useState(false);
  const [images, setImages] = useState<ProcessingImage[]>([]);
  const [imageUploading, setImageUploading] = useState(false);

  const isAdmin = useMemo(
    () => Boolean(user?.roleNames?.includes('Admin')),
    [user?.roleNames]
  );

  const selectedFarm = useMemo(
    () => farms.find((f) => f.id === farmId) ?? null,
    [farms, farmId]
  );

  const load = async (opts?: { silent?: boolean }) => {
    if (!token || !farmId) return;
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const [farmsRes, contentRes, imagesRes] = await Promise.all([
        apiJson<FarmRow[]>('/farms', { token }),
        apiJson<ProcessingContent>(`/farm-profile/${farmId}/content?section=Processing`, { token }),
        apiJson<ProcessingImage[]>(`/farm-profile/${farmId}/images?section=Processing`, { token }),
      ]);
      setFarms(farmsRes);
      setContent(contentRes);
      setImages(imagesRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load processing page');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token / farmId driven
  }, [token, farmId]);

  const saveContent = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !farmId || !content) return;
    setContentSaving(true);
    try {
      const updated = await apiJson<ProcessingContent>(`/farm-profile/${farmId}/content`, {
        token,
        method: 'PUT',
        body: JSON.stringify({
          section: 'Processing',
          body: content.body,
        }),
      });
      setContent(updated);
      toast.success('Processing content saved');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save processing content'
      );
    } finally {
      setContentSaving(false);
    }
  };

  const uploadImage = async (file: File) => {
    if (!token || !farmId) return;
    setImageUploading(true);
    try {
      const form = new FormData();
      form.append('section', 'Processing');
      form.append('file', file);
      await apiFetch(`/farm-profile/${farmId}/images`, {
        token,
        method: 'POST',
        body: form,
      });
      toast.success('Image uploaded');
      await load({ silent: true });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to upload image'
      );
    } finally {
      setImageUploading(false);
    }
  };

  if (!farmId) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Processing &amp; Quality</h1>
        </header>
        <div className="alert-error">Farm ID is required in the URL.</div>
      </div>
    );
  }

  if (loading && !selectedFarm) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Processing &amp; Quality</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading processing page…</p>
        </div>
      </div>
    );
  }

  if (!selectedFarm) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Processing &amp; Quality</h1>
        </header>
        <div className="alert-error" style={{ marginBottom: 12 }}>
          Farm not found. It may have been removed.
        </div>
        <Link to="/global-vendors/farmers" className="btn">
          Back to Farmer Information
        </Link>
      </div>
    );
  }

  const hasSecondary = Boolean(selectedFarm.mainCrop && selectedFarm.farmCategory);

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Processing &amp; Quality</h1>
      </header>

      {error && (
        <div className="alert-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Processing overview</h2>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Primary processing details for <strong>{selectedFarm.code}</strong>.
          </p>
          <div
            style={{
              marginTop: '0.75rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.5rem',
            }}
          >
            <div>
              <div className="input-label">Main crop</div>
              <div>{selectedFarm.mainCrop ?? '—'}</div>
            </div>
            <div>
              <div className="input-label">Farm category</div>
              <div>{selectedFarm.farmCategory ?? '—'}</div>
            </div>
            <div>
              <div className="input-label">Production style</div>
              <div>{selectedFarm.productionStyle ?? '—'}</div>
            </div>
          </div>
          {hasSecondary && (
            <p
              style={{
                marginTop: '0.75rem',
                marginBottom: 0,
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-muted)',
              }}
            >
              Secondary crop or processing details can be captured in the admin notes below.
            </p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Processing notes</h2>
          {!isAdmin && (!content || !content.body.trim()) && (
            <p style={{ marginTop: 0, color: 'var(--color-text-muted)' }}>
              No processing notes have been added yet.
            </p>
          )}

          {isAdmin && (
            <form
              onSubmit={saveContent}
              className="stack"
              style={{ gap: 12, marginBottom: '1rem' }}
            >
              <label className="field">
                <span className="field-label">Admin notes / processing details</span>
                <textarea
                  className="input"
                  rows={6}
                  value={content?.body ?? ''}
                  onChange={(e) =>
                    setContent((prev) => ({
                      farmId,
                      section: 'Processing',
                      id: prev?.id ?? null,
                      body: e.target.value,
                    }))
                  }
                />
              </label>
              <div className="confirm-dialog-actions" style={{ marginTop: 4 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={contentSaving}
                >
                  {contentSaving ? 'Saving…' : 'Save notes'}
                </button>
              </div>
            </form>
          )}

          {content?.body?.trim() && (
            <div
              style={{
                padding: '0.75rem 0.9rem',
                borderRadius: 8,
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-surface-muted)',
                whiteSpace: 'pre-wrap',
                fontSize: 'var(--text-sm)',
              }}
            >
              {content.body}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Images</h2>
          {isAdmin && (
            <div style={{ marginBottom: '0.75rem' }}>
              <label className="btn">
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void uploadImage(file);
                    }
                    e.target.value = '';
                  }}
                  disabled={imageUploading}
                />
              </label>
              {imageUploading && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Uploading…
                </span>
              )}
            </div>
          )}

          {images.length === 0 ? (
            <p className="table-empty" style={{ margin: 0 }}>
              No images yet.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {images.map((img) => (
                <figure
                  key={img.id}
                  style={{
                    margin: 0,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid var(--color-border-subtle)',
                    background: 'var(--color-surface)',
                  }}
                >
                  <img
                    src={`${IMAGE_BASE}/farm-profile/images/${img.id}/download`}
                    alt={img.fileName ?? 'Processing image'}
                    style={{ width: '100%', display: 'block', objectFit: 'cover' }}
                  />
                  <figcaption
                    style={{
                      padding: '0.35rem 0.5rem',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={img.fileName ?? 'Processing image'}
                  >
                    {img.fileName ?? 'Processing image'}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

