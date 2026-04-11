/**
 * Global Vendors — Farmer Profile page with CMS-lite admin text + images.
 */
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, apiJson } from '../../api/client';
import type { FarmRow } from './FarmersInformationPage';

type ProfileContent = {
  id: string | null;
  farmId: string;
  section: 'Profile' | 'Processing';
  body: string;
};

type ProfileImage = {
  id: string;
  section: 'Profile' | 'Processing';
  fileName: string | null;
};

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const IMAGE_BASE = API_BASE.replace(/\/$/, '');

export function FarmProfilePage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { token, user } = useAuth();
  const toast = useToast();
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [content, setContent] = useState<ProfileContent | null>(null);
  const [contentSaving, setContentSaving] = useState(false);
  const [images, setImages] = useState<ProfileImage[]>([]);
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
        apiJson<ProfileContent>(`/farm-profile/${farmId}/content?section=Profile`, { token }),
        apiJson<ProfileImage[]>(`/farm-profile/${farmId}/images?section=Profile`, { token }),
      ]);
      setFarms(farmsRes);
      setContent(contentRes);
      setImages(imagesRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile');
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
      const updated = await apiJson<ProfileContent>(`/farm-profile/${farmId}/content`, {
        token,
        method: 'PUT',
        body: JSON.stringify({
          section: 'Profile',
          body: content.body,
        }),
      });
      setContent(updated);
      toast.success('Profile content saved');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save profile content'
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
      form.append('section', 'Profile');
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
          <h1 className="page-title">Farmer Profile</h1>
        </header>
        <div className="alert-error">Farm ID is required in the URL.</div>
      </div>
    );
  }

  if (loading && !selectedFarm) {
    return (
      <div className="page">
        <header
          className="page-header"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <h1 className="page-title">Farmer Profile</h1>
          {farmId ? (
            <Link to={`/global-vendors/farmers/${farmId}/processing`} className="btn btn-primary">
              Processing &amp; Quality
            </Link>
          ) : null}
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading farmer profile…</p>
        </div>
      </div>
    );
  }

  if (!selectedFarm) {
    return (
      <div className="page">
        <header
          className="page-header"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <h1 className="page-title">Farmer Profile</h1>
          {farmId ? (
            <Link to={`/global-vendors/farmers/${farmId}/processing`} className="btn btn-primary">
              Processing &amp; Quality
            </Link>
          ) : null}
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

  return (
    <div className="page">
      <header
        className="page-header"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <h1 className="page-title">Farmer Profile</h1>
        <Link to={`/global-vendors/farmers/${farmId}/processing`} className="btn btn-primary">
          Processing &amp; Quality
        </Link>
      </header>

      {error && (
        <div className="alert-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Overview</h2>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Details for farm <strong>{selectedFarm.code}</strong>.
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
              <div className="input-label">Farm name</div>
              <div>{selectedFarm.farmName}</div>
            </div>
            <div>
              <div className="input-label">Farmer name</div>
              <div>{selectedFarm.farmerName}</div>
            </div>
            <div>
              <div className="input-label">Country</div>
              <div>{selectedFarm.country}</div>
            </div>
            <div>
              <div className="input-label">Region</div>
              <div>{selectedFarm.region ?? '—'}</div>
            </div>
            <div>
              <div className="input-label">Main crop</div>
              <div>{selectedFarm.mainCrop ?? '—'}</div>
            </div>
            <div>
              <div className="input-label">Elevation (m)</div>
              <div>
                {typeof selectedFarm.elevationMeters === 'number'
                  ? selectedFarm.elevationMeters
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Farmer record details</h2>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                <tr>
                  <th style={{ width: 220 }}>Farm ID</th>
                  <td>{selectedFarm.code}</td>
                </tr>
                <tr>
                  <th>Farm category</th>
                  <td>{selectedFarm.farmCategory ?? '—'}</td>
                </tr>
                <tr>
                  <th>Production style</th>
                  <td>{selectedFarm.productionStyle ?? '—'}</td>
                </tr>
                <tr>
                  <th>City</th>
                  <td>{selectedFarm.city ?? '—'}</td>
                </tr>
                <tr>
                  <th>Total farm size (ha)</th>
                  <td>
                    {typeof selectedFarm.totalFarmSizeHa === 'number'
                      ? selectedFarm.totalFarmSizeHa
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <th>Production area (ha) — main / secondary</th>
                  <td>
                    {typeof selectedFarm.mainCropAreaHa === 'number'
                      ? selectedFarm.mainCropAreaHa
                      : '—'}
                    {' / '}
                    {typeof selectedFarm.secondaryCropAreaHa === 'number'
                      ? selectedFarm.secondaryCropAreaHa
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <th>Annual output (kg) — main / secondary</th>
                  <td>
                    {typeof selectedFarm.mainCropAnnualOutputKg === 'number'
                      ? selectedFarm.mainCropAnnualOutputKg.toLocaleString()
                      : '—'}
                    {' / '}
                    {typeof selectedFarm.secondaryCropAnnualOutputKg ===
                    'number'
                      ? selectedFarm.secondaryCropAnnualOutputKg.toLocaleString()
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <th>Varieties (main / secondary)</th>
                  <td>
                    {selectedFarm.mainVarieties ?? '—'}
                    {' / '}
                    {selectedFarm.secondaryVarieties ?? '—'}
                  </td>
                </tr>
                <tr>
                  <th>Main harvest window</th>
                  <td>
                    {selectedFarm.harvestStartMonth &&
                    selectedFarm.harvestEndMonth
                      ? `${selectedFarm.harvestStartMonth}–${selectedFarm.harvestEndMonth}`
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <th>Secondary harvest window</th>
                  <td>
                    {selectedFarm.secondaryHarvestStartMonth &&
                    selectedFarm.secondaryHarvestEndMonth
                      ? `${selectedFarm.secondaryHarvestStartMonth}–${selectedFarm.secondaryHarvestEndMonth}`
                      : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Profile content</h2>
          {!isAdmin && (!content || !content.body.trim()) && (
            <p style={{ marginTop: 0, color: 'var(--color-text-muted)' }}>
              No profile content has been added yet.
            </p>
          )}

          {isAdmin && (
            <form
              onSubmit={saveContent}
              className="stack"
              style={{ gap: 12, marginBottom: '1rem' }}
            >
              <label className="field">
                <span className="field-label">Profile content</span>
                <textarea
                  className="input"
                  rows={6}
                  value={content?.body ?? ''}
                  onChange={(e) =>
                    setContent((prev) => ({
                      farmId,
                      section: 'Profile',
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
                  {contentSaving ? 'Saving…' : 'Save content'}
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
                    alt={img.fileName ?? 'Farm image'}
                    style={{ width: '100%', height: 120, display: 'block', objectFit: 'cover' }}
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
                    title={img.fileName ?? 'Farm image'}
                  >
                    {img.fileName ?? 'Farm image'}
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

