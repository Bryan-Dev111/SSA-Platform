/**
 * Global Vendors — Farmer Information: list farms, add via modal.
 */
import { FormEvent, useEffect, useState } from 'react';
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
          <table className="table">
            <thead>
              <tr>
                <th>Farm ID</th>
                <th>Farm name</th>
                <th>Farmer name</th>
                <th>Country</th>
                <th>City</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {farms.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
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
                    <td>{f.city ?? '—'}</td>
                    <td>{new Date(f.createdAt).toLocaleDateString()}</td>
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
    </div>
  );
}
