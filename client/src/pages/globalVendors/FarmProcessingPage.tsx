/**
 * Global Vendors — Processing & Quality page, sharing the same CMS-lite system.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, apiJson } from '../../api/client';
import type { FarmRow } from './FarmersInformationPage';

type ProcessingContent = {
  id: string | null;
  farmId: string;
  section: string;
  body: string;
};

type ProcessingImage = {
  id: string;
  section: string;
  fileName: string | null;
};

/** Four CMS blocks (content + images per section key). No card titles — client request. */
const PROCESSING_STEPS = [
  { key: 'ProcessingStep1' },
  { key: 'ProcessingStep2' },
  { key: 'ProcessingStep3' },
  { key: 'ProcessingStep4' },
] as const;

type ProcessingStepKey = (typeof PROCESSING_STEPS)[number]['key'];

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const IMAGE_BASE = API_BASE.replace(/\/$/, '');

export function FarmProcessingPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { token, user } = useAuth();
  const toast = useToast();
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [contentByStep, setContentByStep] = useState<Record<ProcessingStepKey, ProcessingContent>>(() => {
    const fid = String(farmId ?? '');
    const initial = {} as Record<ProcessingStepKey, ProcessingContent>;
    for (const step of PROCESSING_STEPS) {
      initial[step.key] = { id: null, farmId: fid, section: step.key, body: '' };
    }
    return initial;
  });
  const [contentSavingStep, setContentSavingStep] = useState<ProcessingStepKey | null>(null);

  const [imagesByStep, setImagesByStep] = useState<Record<ProcessingStepKey, ProcessingImage[]>>(() => {
    const initial = {} as Record<ProcessingStepKey, ProcessingImage[]>;
    for (const step of PROCESSING_STEPS) {
      initial[step.key] = [];
    }
    return initial;
  });
  const [imageUploadingStep, setImageUploadingStep] = useState<ProcessingStepKey | null>(null);

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
      const [farmsRes, legacyContentRes, legacyImagesRes, stepContentsRes, stepImagesRes] =
        await Promise.all([
          apiJson<FarmRow[]>('/farms', { token }),
          apiJson<ProcessingContent>(`/farm-profile/${farmId}/content?section=Processing`, { token }),
          apiJson<ProcessingImage[]>(`/farm-profile/${farmId}/images?section=Processing`, { token }),
          Promise.all(
            PROCESSING_STEPS.map((s) =>
              apiJson<ProcessingContent>(
                `/farm-profile/${farmId}/content?section=${encodeURIComponent(s.key)}`,
                { token }
              )
            )
          ),
          Promise.all(
            PROCESSING_STEPS.map((s) =>
              apiJson<ProcessingImage[]>(
                `/farm-profile/${farmId}/images?section=${encodeURIComponent(s.key)}`,
                { token }
              )
            )
          ),
        ]);

      setFarms(farmsRes);
      const nextContent = {} as Record<ProcessingStepKey, ProcessingContent>;
      const nextImages = {} as Record<ProcessingStepKey, ProcessingImage[]>;

      PROCESSING_STEPS.forEach((s, i) => {
        nextContent[s.key] = stepContentsRes[i];
        nextImages[s.key] = stepImagesRes[i];
      });

      // Backward compatibility: if the legacy 'Processing' content/images exist,
      // show them in Step 1 when Step 1 is empty.
      const step1Key = PROCESSING_STEPS[0].key;
      if (!nextContent[step1Key].body.trim() && legacyContentRes.body.trim()) {
        nextContent[step1Key] = { ...nextContent[step1Key], body: legacyContentRes.body };
      }
      if (nextImages[step1Key].length === 0 && legacyImagesRes.length > 0) {
        nextImages[step1Key] = legacyImagesRes;
      }

      // Ensure stored values use the current farmId (in case initial render used '').
      for (const s of PROCESSING_STEPS) {
        nextContent[s.key] = { ...nextContent[s.key], farmId };
      }

      setContentByStep(nextContent);
      setImagesByStep(nextImages);
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

  const saveStepNotes = async (stepKey: ProcessingStepKey) => {
    if (!token || !farmId) return;
    const current = contentByStep[stepKey];
    setContentSavingStep(stepKey);
    try {
      const updated = await apiJson<ProcessingContent>(`/farm-profile/${farmId}/content`, {
        token,
        method: 'PUT',
        body: JSON.stringify({
          section: stepKey,
          body: current.body,
        }),
      });
      setContentByStep((prev) => ({ ...prev, [stepKey]: updated }));
      toast.success('Step notes saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save step notes');
    } finally {
      setContentSavingStep(null);
    }
  };

  const uploadImage = async (stepKey: ProcessingStepKey, file: File) => {
    if (!token || !farmId) return;
    setImageUploadingStep(stepKey);
    try {
      const form = new FormData();
      form.append('section', stepKey);
      form.append('file', file);
      await apiFetch(`/farm-profile/${farmId}/images`, {
        token,
        method: 'POST',
        body: form,
      });
      toast.success('Image uploaded');
      await load({ silent: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setImageUploadingStep(null);
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
          <h1 className="page-title">Processing &amp; Quality</h1>
          {farmId ? (
            <Link to={`/global-vendors/farmers/${farmId}/profile`} className="btn btn-ghost">
              Return to Farmer profile
            </Link>
          ) : null}
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
          <h1 className="page-title">Processing &amp; Quality</h1>
          {farmId ? (
            <Link to={`/global-vendors/farmers/${farmId}/profile`} className="btn btn-ghost">
              Return to Farmer profile
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
        <h1 className="page-title">Processing &amp; Quality</h1>
        <Link to={`/global-vendors/farmers/${farmId}/profile`} className="btn btn-ghost">
          Return to Farmer profile
        </Link>
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
            Use the sections below to capture photos and a short description for each processing block for{' '}
            <strong>{selectedFarm.code}</strong>.
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
              <div className="input-label">Secondary crop</div>
              <div>{selectedFarm.secondaryCrop ?? '—'}</div>
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
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Processing &amp; quality details</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th />
                  <th>Main</th>
                  <th>Secondary</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Processing methods</th>
                  <td>{selectedFarm.mainProcessingMethods ?? '—'}</td>
                  <td>{selectedFarm.secondaryProcessingMethods ?? '—'}</td>
                </tr>
                <tr>
                  <th scope="row">Fermentation days</th>
                  <td>
                    {selectedFarm.mainFermentationDays != null
                      ? selectedFarm.mainFermentationDays
                      : '—'}
                  </td>
                  <td>
                    {selectedFarm.secondaryFermentationDays != null
                      ? selectedFarm.secondaryFermentationDays
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Drying method</th>
                  <td>{selectedFarm.mainDryingMethod ?? '—'}</td>
                  <td>{selectedFarm.secondaryDryingMethod ?? '—'}</td>
                </tr>
                <tr>
                  <th scope="row">Bean size</th>
                  <td>{selectedFarm.mainBeanSize ?? '—'}</td>
                  <td>{selectedFarm.secondaryBeanSize ?? '—'}</td>
                </tr>
                <tr>
                  <th scope="row">Quality score</th>
                  <td>
                    {selectedFarm.mainQualityScore != null
                      ? selectedFarm.mainQualityScore.toFixed(1)
                      : '—'}
                  </td>
                  <td>
                    {selectedFarm.secondaryQualityScore != null
                      ? selectedFarm.secondaryQualityScore.toFixed(1)
                      : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          alignItems: 'stretch',
        }}
      >
        {PROCESSING_STEPS.map((step) => {
        const stepContent = contentByStep[step.key];
        const stepImages = imagesByStep[step.key];

        return (
          <div className="card" style={{ marginBottom: 0 }} key={step.key}>
            <div className="card-body">
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
                          void uploadImage(step.key, file);
                        }
                        e.target.value = '';
                      }}
                      disabled={imageUploadingStep === step.key}
                    />
                  </label>
                  {imageUploadingStep === step.key && (
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

              {stepImages.length === 0 ? (
                <p className="table-empty" style={{ margin: 0 }}>
                  No images yet for this step.
                </p>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '0.75rem',
                  }}
                >
                  {stepImages.map((img) => (
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
                        title={img.fileName ?? 'Processing image'}
                      >
                        {img.fileName ?? 'Processing image'}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '0.75rem' }}>
                {isAdmin ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveStepNotes(step.key);
                    }}
                    className="stack"
                    style={{ gap: 12 }}
                  >
                    <label className="field">
                      <span className="field-label">Description / notes</span>
                      <textarea
                        className="input"
                        rows={6}
                        value={stepContent?.body ?? ''}
                        onChange={(e) =>
                          setContentByStep((prev) => ({
                            ...prev,
                            [step.key]: {
                              ...prev[step.key],
                              body: e.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <div className="confirm-dialog-actions" style={{ marginTop: 4 }}>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={contentSavingStep === step.key}
                      >
                        {contentSavingStep === step.key ? 'Saving…' : 'Save notes'}
                      </button>
                    </div>
                  </form>
                ) : stepContent?.body?.trim() ? (
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
                    {stepContent.body}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                    No notes for this step yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

