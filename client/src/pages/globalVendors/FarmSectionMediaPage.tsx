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

type ProcessingBlock = {
  id: string;
  text: string;
  imageIds: string[];
};

function newProcessingBlock(): ProcessingBlock {
  return {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: '',
    imageIds: [],
  };
}

function parseProcessingBlocks(raw: string): ProcessingBlock[] {
  const text = raw.trim();
  if (!text) return [newProcessingBlock()];
  try {
    const parsed = JSON.parse(text) as { blocks?: Array<{ id?: string; text?: string; imageIds?: string[] }> };
    if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
      return [newProcessingBlock()];
    }
    const blocks = parsed.blocks.map((b, idx) => ({
      id: typeof b.id === 'string' && b.id.trim() ? b.id : `block-${idx + 1}`,
      text: typeof b.text === 'string' ? b.text : '',
      imageIds: Array.isArray(b.imageIds) ? b.imageIds.filter((id): id is string => typeof id === 'string') : [],
    }));
    return blocks.length > 0 ? blocks : [newProcessingBlock()];
  } catch {
    // Backward compatibility: existing plain text becomes the first block's text.
    return [{ ...newProcessingBlock(), text: raw }];
  }
}

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
  const [content, setContent] = useState('');
  const [processingBlocks, setProcessingBlocks] = useState<ProcessingBlock[]>([newProcessingBlock()]);
  const [contentLoading, setContentLoading] = useState(false);
  const [savingContent, setSavingContent] = useState(false);

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

  useEffect(() => {
    if (!token || !farmId) {
      setContent('');
      setProcessingBlocks([newProcessingBlock()]);
      return;
    }
    let cancelled = false;
    const loadContent = async () => {
      setContentLoading(true);
      try {
        const q = section === 'Profile' ? '?section=Profile' : '?section=Processing';
        const r = await apiJson<{ body: string }>(`/farms/${farmId}/profile-content${q}`, { token });
        if (!cancelled) {
          const body = r.body || '';
          setContent(body);
          if (section === 'Processing') {
            setProcessingBlocks(parseProcessingBlocks(body));
          }
        }
      } catch {
        if (!cancelled) {
          setContent('');
          if (section === 'Processing') {
            setProcessingBlocks([newProcessingBlock()]);
          }
        }
      } finally {
        if (!cancelled) setContentLoading(false);
      }
    };
    void loadContent();
    return () => {
      cancelled = true;
    };
  }, [token, farmId, section]);

  const openManager = (id: string, nextSection: Section) => {
    setFarmId(id);
    setSection(nextSection);
    setSearchParams({ farmId: id }, { replace: true });
  };

  const saveContent = async () => {
    if (!token || !farmId || savingContent) return;
    setSavingContent(true);
    try {
      const bodyToSave =
        section === 'Processing'
          ? JSON.stringify({ blocks: processingBlocks.map((b) => ({ id: b.id, text: b.text, imageIds: b.imageIds })) })
          : content;
      await apiJson(`/farms/${farmId}/profile-content`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ section, body: bodyToSave }),
      });
      toast.success(section === 'Profile' ? 'Farm profile text saved' : 'Processing & quality text saved');
    } catch (err) {
      let msg = 'Could not save text';
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

  const uploadFiles = async (files: FileList | File[], blockId?: string) => {
    if (!token || !farmId) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploadBusy(true);
    try {
      const uploadedIds: string[] = [];
      for (const file of arr) {
        const form = new FormData();
        form.append('file', file);
        form.append('section', section);
        const res = await apiFetch(`/farms/${farmId}/profile-images`, { token, method: 'POST', body: form });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        if (section === 'Processing' && blockId) {
          try {
            const json = (await res.json()) as { image?: { id?: string } };
            if (json.image?.id) uploadedIds.push(json.image.id);
          } catch {
            // ignore parse issues, gallery still reloads
          }
        }
      }
      toast.success(arr.length === 1 ? 'Photo added' : `${arr.length} photos added`);
      await loadImages();
      if (section === 'Processing' && blockId && uploadedIds.length > 0) {
        setProcessingBlocks((prev) =>
          prev.map((block) =>
            block.id === blockId
              ? {
                  ...block,
                  imageIds: [...new Set([...block.imageIds, ...uploadedIds])],
                }
              : block
          )
        );
      }
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
      if (section === 'Processing') {
        setProcessingBlocks((prev) =>
          prev.map((block) => ({
            ...block,
            imageIds: block.imageIds.filter((id) => id !== deleteTarget.id),
          }))
        );
      }
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
          <label className="field" style={{ marginBottom: 0, display: 'block', maxWidth: 420 }}>
            <span className="field-label">Supplier lookup by Farm ID</span>
            <select
              className="input"
              value={farmId}
              onChange={(e) => {
                const id = e.target.value;
                setFarmId(id);
                setSearchParams(id ? { farmId: id } : {}, { replace: true });
              }}
            >
              <option value="">Select farm</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} - {f.farmName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div><strong>Farm ID:</strong> {selectedFarm.code}</div>
              <div><strong>Farm Name:</strong> {selectedFarm.farmName}</div>
              <div><strong>Main/Secondary Crop:</strong> {selectedFarm.mainCrop || '—'} / {selectedFarm.secondaryCrop || '—'}</div>
              <div><strong>Country:</strong> {selectedFarm.country}</div>
              <div><strong>Region:</strong> {selectedFarm.region || '—'}</div>
              <div><strong>Elevation:</strong> {typeof selectedFarm.elevationMeters === 'number' ? `${selectedFarm.elevationMeters} m` : '—'}</div>
            </div>
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

            <div className="table-wrap" style={{ marginBottom: 12 }}>
              <table className="table">
                <thead>
                  <tr>
                    {section === 'Profile' ? (
                      <>
                        <th>Total Farm Size (ha)</th>
                        <th>Production Area (ha) Main/Secondary</th>
                        <th>Annual Output (Kg) Main/Secondary</th>
                        <th>Production Style</th>
                        <th>Varieties</th>
                        <th>Harvest Window (Main)</th>
                        <th>Harvest Window (Secondary)</th>
                      </>
                    ) : (
                      <>
                        <th>Main Processing Methods</th>
                        <th>Main Fermentation Days</th>
                        <th>Main Drying Method</th>
                        <th>Main Bean Size</th>
                        <th>Main Quality Score</th>
                        <th>Secondary Processing Details</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {section === 'Profile' ? (
                      <>
                        <td>{typeof selectedFarm.totalFarmSizeHa === 'number' ? selectedFarm.totalFarmSizeHa : '—'}</td>
                        <td>
                          {typeof selectedFarm.mainCropAreaHa === 'number' ? selectedFarm.mainCropAreaHa : '—'} /{' '}
                          {typeof selectedFarm.secondaryCropAreaHa === 'number' ? selectedFarm.secondaryCropAreaHa : '—'}
                        </td>
                        <td>
                          {typeof selectedFarm.mainCropAnnualOutputKg === 'number' ? selectedFarm.mainCropAnnualOutputKg.toLocaleString() : '—'} /{' '}
                          {typeof selectedFarm.secondaryCropAnnualOutputKg === 'number' ? selectedFarm.secondaryCropAnnualOutputKg.toLocaleString() : '—'}
                        </td>
                        <td>{selectedFarm.productionStyle || '—'}</td>
                        <td>{selectedFarm.mainVarieties || '—'}{selectedFarm.secondaryVarieties ? ` / ${selectedFarm.secondaryVarieties}` : ''}</td>
                        <td>
                          {selectedFarm.harvestStartMonth && selectedFarm.harvestEndMonth
                            ? `${selectedFarm.harvestStartMonth} - ${selectedFarm.harvestEndMonth}`
                            : '—'}
                        </td>
                        <td>
                          {selectedFarm.secondaryHarvestStartMonth && selectedFarm.secondaryHarvestEndMonth
                            ? `${selectedFarm.secondaryHarvestStartMonth} - ${selectedFarm.secondaryHarvestEndMonth}`
                            : '—'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{selectedFarm.mainProcessingMethods || '—'}</td>
                        <td>{typeof selectedFarm.mainFermentationDays === 'number' ? selectedFarm.mainFermentationDays : '—'}</td>
                        <td>{selectedFarm.mainDryingMethod || '—'}</td>
                        <td>{selectedFarm.mainBeanSize || '—'}</td>
                        <td>{typeof selectedFarm.mainQualityScore === 'number' ? selectedFarm.mainQualityScore : '—'}</td>
                        <td>
                          {selectedFarm.secondaryProcessingMethods || selectedFarm.secondaryFermentationDays || selectedFarm.secondaryDryingMethod || selectedFarm.secondaryBeanSize || selectedFarm.secondaryQualityScore
                            ? `${selectedFarm.secondaryProcessingMethods || 'Method: —'} | Fermentation: ${typeof selectedFarm.secondaryFermentationDays === 'number' ? selectedFarm.secondaryFermentationDays : '—'} | Drying: ${selectedFarm.secondaryDryingMethod || '—'} | Bean Size: ${selectedFarm.secondaryBeanSize || '—'} | Quality: ${typeof selectedFarm.secondaryQualityScore === 'number' ? selectedFarm.secondaryQualityScore : '—'}`
                            : 'No secondary processing data'}
                        </td>
                      </>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>

            <label className="field" style={{ display: 'block', marginBottom: 12 }}>
              {section === 'Profile' ? (
                <>
                  <span className="field-label">Farm profile text</span>
                  <textarea
                    className="input"
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Add profile narrative for this farm..."
                    disabled={contentLoading}
                  />
                </>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span className="field-label" style={{ marginBottom: 0 }}>
                      Processing &amp; quality blocks
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() =>
                        setProcessingBlocks((prev) => [...prev, newProcessingBlock()])
                      }
                    >
                      Add
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {processingBlocks.map((block, idx) => (
                      <div
                        key={block.id}
                        style={{
                          border: '1px solid var(--color-border)',
                          borderRadius: 8,
                          padding: 10,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 8,
                          }}
                        >
                          <strong>Block {idx + 1}</strong>
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost"
                            onClick={() =>
                              setProcessingBlocks((prev) =>
                                prev.length <= 1
                                  ? [{ ...prev[0], text: '', imageIds: [] }]
                                  : prev.filter((b) => b.id !== block.id)
                              )
                            }
                          >
                            Remove block
                          </button>
                        </div>
                        <textarea
                          className="input"
                          rows={3}
                          value={block.text}
                          onChange={(e) =>
                            setProcessingBlocks((prev) =>
                              prev.map((b) =>
                                b.id === block.id ? { ...b, text: e.target.value } : b
                              )
                            )
                          }
                          placeholder="Add processing and quality narrative for this block..."
                          disabled={contentLoading}
                        />
                        <div style={{ marginTop: 8 }}>
                          <input
                            id={`processing-block-upload-${block.id}`}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            multiple
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const list = e.target.files;
                              if (list?.length) void uploadFiles(list, block.id);
                              e.target.value = '';
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost"
                            disabled={uploadBusy}
                            onClick={() =>
                              document
                                .getElementById(`processing-block-upload-${block.id}`)
                                ?.click()
                            }
                          >
                            Add photo to block
                          </button>
                        </div>
                        {block.imageIds.length > 0 ? (
                          <div
                            style={{
                              marginTop: 8,
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 8,
                            }}
                          >
                            {block.imageIds.map((imageId) => {
                              const image = images.find((img) => img.id === imageId);
                              if (!image) return null;
                              return (
                                <div
                                  key={image.id}
                                  style={{ width: 90, display: 'flex', flexDirection: 'column', gap: 4 }}
                                >
                                  {image.url ? (
                                    <img
                                      src={image.url}
                                      alt={image.fileName || 'Block image'}
                                      style={{
                                        width: '100%',
                                        height: 70,
                                        objectFit: 'cover',
                                        borderRadius: 6,
                                        border: '1px solid var(--color-border)',
                                      }}
                                    />
                                  ) : null}
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-ghost"
                                    onClick={() =>
                                      setProcessingBlocks((prev) =>
                                        prev.map((b) =>
                                          b.id === block.id
                                            ? {
                                                ...b,
                                                imageIds: b.imageIds.filter((id) => id !== image.id),
                                              }
                                            : b
                                        )
                                      )
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void saveContent()}
              disabled={savingContent || contentLoading}
              style={{ marginBottom: 12 }}
            >
              {savingContent ? 'Saving…' : 'Save text'}
            </button>

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
