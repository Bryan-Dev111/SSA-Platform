/**
 * Global Supply — Farm profile photos manager.
 * Processing & quality is accessible from this page via row actions.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, apiJson } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { FarmProfileImageRow, FarmRow } from './FarmersInformationPage';

type Section = 'Profile' | 'Processing';

export function GlobalFarmProfilePage() {
  const { token } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFarmId = searchParams.get('farmId');
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [farmId, setFarmId] = useState<string>('');
  const [section, setSection] = useState<Section>('Profile');
  const [images, setImages] = useState<FarmProfileImageRow[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FarmProfileImageRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedFarm = useMemo(() => farms.find((f) => f.id === farmId) || null, [farms, farmId]);

  const loadFarms = useCallback(async () => {
    if (!token) return;
    try {
      const list = await apiJson<FarmRow[]>('/farms', { token });
      setFarms(list);
    } catch {
      setFarms([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadFarms();
  }, [loadFarms]);

  useEffect(() => {
    if (farms.length === 0) {
      setFarmId('');
      return;
    }
    if (urlFarmId && farms.some((f) => f.id === urlFarmId)) {
      setFarmId(urlFarmId);
      setSection('Profile');
      return;
    }
    setFarmId((prev) => (prev && farms.some((f) => f.id === prev) ? prev : ''));
  }, [farms, urlFarmId]);

  const loadImages = useCallback(async () => {
    if (!token || !farmId) {
      setImages([]);
      return;
    }
    setImagesLoading(true);
    try {
      const q = section === 'Profile' ? '?section=Profile' : '?section=Processing';
      const r = await apiJson<{ images: FarmProfileImageRow[] }>(`/farms/${farmId}/profile-images${q}`, {
        token,
      });
      setImages(r.images);
    } catch {
      setImages([]);
    } finally {
      setImagesLoading(false);
    }
  }, [token, farmId, section]);

  useEffect(() => {
    void loadImages();
  }, [loadImages]);

  const openManager = (id: string, nextSection: Section) => {
    setFarmId(id);
    setSection(nextSection);
    setSearchParams({ farmId: id }, { replace: true });
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!token || !farmId) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploadBusy(true);
    try {
      for (const file of arr) {
        const form = new FormData();
        form.append('file', file);
        form.append('section', section);
        const res = await apiFetch(`/farms/${farmId}/profile-images`, { token, method: 'POST', body: form });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
      }
      toast.success(arr.length === 1 ? 'Photo added' : `${arr.length} photos added`);
      await loadImages();
    } catch (err) {
      let msg = 'Could not upload photo';
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

  const confirmDelete = async () => {
    if (!token || !farmId || !deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/farms/${farmId}/profile-images/${deleteTarget.id}`, {
        token,
        method: 'DELETE',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      toast.success('Photo removed');
      setDeleteTarget(null);
      await loadImages();
    } catch (err) {
      let msg = 'Could not remove photo';
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

  if (loading && farms.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Farm profile</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading…</p>
        </div>
      </div>
    );
  }

  const uploadInputId = `farm-profile-media-${section}`;

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Farm profile</h1>
        <p className="page-description" style={{ marginTop: '0.35rem' }}>
          Manage profile and processing photos by farm. You can also open this page from{' '}
          <Link to="/global-vendors/farmers">Farm Information</Link>.
        </p>
      </header>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Farms</h2>
          <div className="table-wrap">
            {farms.length === 0 ? (
              <p className="table-empty">No farms yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Farm ID</th>
                    <th>Farm name</th>
                    <th>Country</th>
                    <th>Farm profile</th>
                    <th>Processing &amp; quality</th>
                  </tr>
                </thead>
                <tbody>
                  {farms.map((f) => (
                    <tr key={f.id}>
                      <td>{f.code}</td>
                      <td>{f.farmName}</td>
                      <td>{f.country}</td>
                      <td>
                        <button
                          type="button"
                          className={farmId === f.id && section === 'Profile' ? 'btn btn-primary btn-sm' : 'btn btn-sm btn-ghost'}
                          onClick={() => openManager(f.id, 'Profile')}
                        >
                          Open
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={farmId === f.id && section === 'Processing' ? 'btn btn-primary btn-sm' : 'btn btn-sm btn-ghost'}
                          onClick={() => openManager(f.id, 'Processing')}
                        >
                          Open
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

      {selectedFarm ? (
        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>
              {selectedFarm.code} — {selectedFarm.farmName}
            </h2>
            <p className="field-label" style={{ marginBottom: 10 }}>
              {section === 'Profile' ? 'Farm profile photos' : 'Processing & quality photos'}
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={section === 'Profile' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
                onClick={() => setSection('Profile')}
              >
                Farm profile
              </button>
              <button
                type="button"
                className={section === 'Processing' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
                onClick={() => setSection('Processing')}
              >
                Processing &amp; quality
              </button>
            </div>

            <input
              id={uploadInputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                const list = e.target.files;
                if (list?.length) void uploadFiles(list);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={uploadBusy}
              onClick={() => document.getElementById(uploadInputId)?.click()}
              style={{ marginBottom: 12 }}
            >
              {uploadBusy ? 'Uploading…' : 'Add photo'}
            </button>

            {imagesLoading ? (
              <p className="table-empty">Loading photos…</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {images.length === 0 ? (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    {section === 'Profile' ? 'No profile photos yet.' : 'No processing or quality photos yet.'}
                  </span>
                ) : null}
                {images.map((img) => (
                  <div key={img.id} style={{ width: 128 }}>
                    {img.url ? (
                      <img
                        src={img.url}
                        alt={img.fileName || selectedFarm.farmName}
                        style={{
                          width: '100%',
                          height: 96,
                          objectFit: 'cover',
                          borderRadius: 6,
                          border: '1px solid var(--color-border)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          height: 96,
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
                      disabled={uploadBusy}
                      onClick={() => setDeleteTarget(img)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove photo?"
        message={
          deleteTarget ? (
            <span>
              Remove this photo{deleteTarget.fileName ? ` (${deleteTarget.fileName})` : ''}? This cannot be undone.
            </span>
          ) : (
            ''
          )
        }
        confirmLabel={deleting ? 'Removing…' : 'Remove'}
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  );
}
