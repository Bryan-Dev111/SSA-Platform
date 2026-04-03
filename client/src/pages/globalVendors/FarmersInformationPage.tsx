/**
 * Global Vendors — Farmer Information: list farms, add via modal.
 */
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiJson } from '../../api/client';

export interface FarmRow {
  id: string;
  code: string;
  farmName: string;
  farmerName: string;
  country: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  region: string | null;
  farmCategory: string | null;
  mainCrop: string | null;
  elevationMeters: number | null;
  productionStyle: string | null;
  createdAt: string;
  updatedAt: string;
}

export function FarmersInformationPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [farmName, setFarmName] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<FarmRow>>({});

  const load = (opts?: { silent?: boolean }) => {
    if (!token) return;
    if (!opts?.silent) setLoading(true);
    apiJson<FarmRow[]>('/farms', { token })
      .then(setFarms)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load farms'))
      .finally(() => {
        if (!opts?.silent) setLoading(false);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token-driven refresh
  }, [token]);

  const closeModal = () => {
    setModalOpen(false);
    setFarmName('');
    setFarmerName('');
    setCountry('');
    setCity('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      await apiJson<FarmRow>('/farms', {
        token,
        method: 'POST',
        body: JSON.stringify({ farmName, farmerName, country, city: city || null }),
      });
      toast.success('Farmer added');
      closeModal();
      load({ silent: true });
    } catch (err) {
      let msg = 'Could not create farm';
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
      setSaving(false);
    }
  };

  const openEdit = (farm: FarmRow) => {
    setEditId(farm.id);
    setEdit(farm);
  };

  const closeEdit = () => {
    setEditId(null);
    setEdit({});
  };

  const updateEditField = (field: keyof FarmRow, value: string) => {
    setEdit((prev) => ({
      ...prev,
      [field]:
        field === 'latitude' || field === 'longitude' || field === 'elevationMeters'
          ? (value === '' ? null : Number(value))
          : value,
    }));
  };

  const saveEdit = async () => {
    if (!token || !editId) return;
    setSaving(true);
    try {
      const payload = {
        farmName: edit.farmName,
        farmerName: edit.farmerName,
        country: edit.country,
        city: edit.city,
        latitude: edit.latitude,
        longitude: edit.longitude,
        region: edit.region,
        farmCategory: edit.farmCategory,
        mainCrop: edit.mainCrop,
        elevationMeters: edit.elevationMeters,
        productionStyle: edit.productionStyle,
      };
      await apiJson<FarmRow>(`/farms/${editId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      toast.success('Farmer updated');
      closeEdit();
      load({ silent: true });
    } catch (err) {
      let msg = 'Could not update farm';
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
      setSaving(false);
    }
  };

  if (loading && farms.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Farmer Information</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading farms…</p>
        </div>
      </div>
    );
  }

  if (error && farms.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Farmer Information</h1>
        </header>
        <div className="alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header
        className="page-header"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <h1 className="page-title">Farmer Information</h1>
        <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
          Add farmer
        </button>
      </header>

      <div className="card">
        <div className="table-wrap">
          <table className="table table--sticky-header table--prevent-shrink">
            <thead>
              <tr>
                <th>Farm ID</th>
                <th>Farm name</th>
                <th>Farmer name</th>
                <th>Country</th>
                <th>Region</th>
                <th>Farm category</th>
                <th>Main crop</th>
                <th>Elevation (m)</th>
                <th>Production style</th>
                <th>City</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {farms.length === 0 ? (
                <tr>
                  <td colSpan={14} className="table-empty">
                    No farms yet. Use <strong>Add farmer</strong> to create one.
                  </td>
                </tr>
              ) : (
                farms.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.code}</strong>
                    </td>
                    <td>{f.farmName}</td>
                    <td>{f.farmerName}</td>
                    <td>{f.country}</td>
                    <td>{f.region ?? '—'}</td>
                    <td>{f.farmCategory ?? '—'}</td>
                    <td>{f.mainCrop ?? '—'}</td>
                    <td>{typeof f.elevationMeters === 'number' ? f.elevationMeters : '—'}</td>
                    <td>{f.productionStyle ?? '—'}</td>
                    <td>{f.city ?? '—'}</td>
                    <td>{typeof f.latitude === 'number' ? f.latitude : '—'}</td>
                    <td>{typeof f.longitude === 'number' ? f.longitude : '—'}</td>
                    <td>
                      {new Date(f.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 4,
                          justifyContent: 'flex-end',
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => openEdit(f)}
                        >
                          Edit
                        </button>
                        <Link
                          to={`/global-vendors/farmers/${f.id}/profile`}
                          className="btn btn-sm"
                        >
                          Profile
                        </Link>
                        <Link
                          to={`/global-vendors/farmers/${f.id}/processing`}
                          className="btn btn-sm"
                        >
                          Processing
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen ? (
        <div
          className="confirm-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-farm-title"
          onClick={closeModal}
          onKeyDown={(ev) => ev.key === 'Escape' && closeModal()}
        >
          <div className="confirm-dialog" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h3 id="add-farm-title" className="confirm-dialog-title">
              Add farmer
            </h3>
            <form onSubmit={submit} className="stack" style={{ gap: 12, marginTop: 16 }}>
              <label className="field">
                <span className="field-label">Farm name</span>
                <input
                  className="input"
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  required
                  autoComplete="organization"
                />
              </label>
              <label className="field">
                <span className="field-label">Farmer name</span>
                <input
                  className="input"
                  value={farmerName}
                  onChange={(e) => setFarmerName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </label>
              <label className="field">
                <span className="field-label">Country</span>
                <input
                  className="input"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  required
                  autoComplete="country-name"
                />
              </label>
              <label className="field">
                <span className="field-label">City</span>
                <input
                  className="input"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  autoComplete="address-level2"
                />
              </label>
              <div className="confirm-dialog-actions" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editId ? (
        <div
          className="confirm-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-farm-title"
          onClick={closeEdit}
          onKeyDown={(ev) => ev.key === 'Escape' && closeEdit()}
        >
          <div className="confirm-dialog" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <h3 id="edit-farm-title" className="confirm-dialog-title">
              Edit farmer
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveEdit();
              }}
              className="stack"
              style={{ gap: 12, marginTop: 16 }}
            >
              <label className="field">
                <span className="field-label">Farm name</span>
                <input
                  className="input"
                  value={edit.farmName ?? ''}
                  onChange={(e) => updateEditField('farmName', e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Farmer name</span>
                <input
                  className="input"
                  value={edit.farmerName ?? ''}
                  onChange={(e) => updateEditField('farmerName', e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Country</span>
                <input
                  className="input"
                  value={edit.country ?? ''}
                  onChange={(e) => updateEditField('country', e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">City</span>
                <input
                  className="input"
                  value={edit.city ?? ''}
                  onChange={(e) => updateEditField('city', e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Region</span>
                <input
                  className="input"
                  value={edit.region ?? ''}
                  onChange={(e) => updateEditField('region', e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Farm category</span>
                <input
                  className="input"
                  value={edit.farmCategory ?? ''}
                  onChange={(e) => updateEditField('farmCategory', e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Main crop</span>
                <input
                  className="input"
                  value={edit.mainCrop ?? ''}
                  onChange={(e) => updateEditField('mainCrop', e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Elevation (meters)</span>
                <input
                  className="input"
                  type="number"
                  value={
                    typeof edit.elevationMeters === 'number'
                      ? String(edit.elevationMeters)
                      : ''
                  }
                  onChange={(e) => updateEditField('elevationMeters', e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Production style</span>
                <input
                  className="input"
                  value={edit.productionStyle ?? ''}
                  onChange={(e) => updateEditField('productionStyle', e.target.value)}
                  placeholder="e.g. Organic, Conventional"
                />
              </label>
              <label className="field">
                <span className="field-label">Latitude</span>
                <input
                  className="input"
                  type="number"
                  step="0.000001"
                  min={-90}
                  max={90}
                  value={
                    typeof edit.latitude === 'number' ? String(edit.latitude) : ''
                  }
                  onChange={(e) => updateEditField('latitude', e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Longitude</span>
                <input
                  className="input"
                  type="number"
                  step="0.000001"
                  min={-180}
                  max={180}
                  value={
                    typeof edit.longitude === 'number' ? String(edit.longitude) : ''
                  }
                  onChange={(e) => updateEditField('longitude', e.target.value)}
                />
              </label>
              <div className="confirm-dialog-actions" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
