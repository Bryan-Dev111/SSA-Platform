/**
 * Global Vendors — Samples list and creation modal with optional notes file.
 */
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, apiJson } from '../../api/client';
import type { FarmRow } from './FarmersInformationPage';

type SampleRow = {
  id: string;
  code: string;
  farmId: string | null;
  buyerName: string;
  buyerEmail: string | null;
  crop: string | null;
  shipmentAddress: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  farm: {
    id: string;
    code: string;
    farmName: string;
    country: string;
  } | null;
  notesFilePath: string | null;
  notesFileName: string | null;
};

export function SamplesPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [samples, setSamples] = useState<SampleRow[]>([]);
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [farmId, setFarmId] = useState<string>('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [crop, setCrop] = useState('');
  const [shipmentAddress, setShipmentAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [notesFile, setNotesFile] = useState<File | null>(null);

  const load = (opts?: { silent?: boolean }) => {
    if (!token) return;
    if (!opts?.silent) setLoading(true);
    setError(null);
    Promise.all([
      apiJson<SampleRow[]>('/samples', { token }),
      apiJson<FarmRow[]>('/farms', { token }),
    ])
      .then(([samplesRes, farmsRes]) => {
        setSamples(samplesRes);
        setFarms(farmsRes);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load samples')
      )
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
    setFarmId('');
    setBuyerName('');
    setBuyerEmail('');
    setCrop('');
    setShipmentAddress('');
    setNotes('');
    setNotesFile(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const form = new FormData();
      if (farmId) form.append('farmId', farmId);
      form.append('buyerName', buyerName);
      if (buyerEmail) form.append('buyerEmail', buyerEmail);
      if (crop) form.append('crop', crop);
      if (shipmentAddress) form.append('shipmentAddress', shipmentAddress);
      if (notes) form.append('notes', notes);
      if (notesFile) form.append('notesFile', notesFile);

      await apiFetch('/samples', {
        token,
        method: 'POST',
        body: form,
      });
      toast.success('Sample created');
      closeModal();
      load({ silent: true });
    } catch (err) {
      let msg = 'Could not create sample';
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

  // Placeholder for future extension: attach notes files after creation.
  // Currently unused; samples only support optional notes file on create.

  if (loading && samples.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Samples</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading samples…</p>
        </div>
      </div>
    );
  }

  if (error && samples.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Samples</h1>
        </header>
        <div className="alert-error">{error}</div>
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
        <h1 className="page-title">Samples</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModalOpen(true)}
        >
          Add sample
        </button>
      </header>
      {error && samples.length > 0 && (
        <div className="alert-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div className="card">
        <div className="table-wrap">
          <table className="table table--sticky-header">
            <thead>
              <tr>
                <th>Sample ID</th>
                <th>Buyer</th>
                <th>Buyer email</th>
                <th>Date sent</th>
                <th>Farm ID</th>
                <th>Farm name</th>
                <th>Country</th>
                <th>Crop</th>
                <th>Delivery address</th>
                <th>Notes</th>
                <th>Notes file</th>
              </tr>
            </thead>
            <tbody>
              {samples.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-empty">
                    No samples yet. Use <strong>Add sample</strong> to create
                    one.
                  </td>
                </tr>
              ) : (
                samples.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.code}</strong>
                    </td>
                    <td>{s.buyerName}</td>
                    <td>{s.buyerEmail ?? '—'}</td>
                    <td>
                      {new Date(s.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td>{s.farm ? s.farm.code : '—'}</td>
                    <td>{s.farm ? s.farm.farmName : '—'}</td>
                    <td>{s.farm ? s.farm.country : '—'}</td>
                    <td>{s.crop ?? '—'}</td>
                    <td>{s.shipmentAddress ?? '—'}</td>
                    <td>{s.notes ?? '—'}</td>
                    <td>
                      {s.notesFileName ? (
                        <span>{s.notesFileName}</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          None
                        </span>
                      )}
                    </td>
                    <td>
                      {new Date(s.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
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
          aria-labelledby="add-sample-title"
          onClick={closeModal}
          onKeyDown={(ev) => ev.key === 'Escape' && closeModal()}
        >
          <div
            className="confirm-dialog"
            style={{ maxWidth: 640 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="add-sample-title" className="confirm-dialog-title">
              Add sample
            </h3>
            <form
              onSubmit={submit}
              className="stack"
              style={{ gap: 12, marginTop: 16 }}
            >
              <label className="field">
                <span className="field-label">Buyer name</span>
                <input
                  className="input"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Buyer email</span>
                <input
                  className="input"
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Farm (optional)</span>
                <select
                  className="input"
                  value={farmId}
                  onChange={(e) => setFarmId(e.target.value)}
                >
                  <option value="">No farm selected</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} — {f.farmName} ({f.country})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Crop</span>
                <input
                  className="input"
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  placeholder="e.g. Coffee, Cocoa"
                />
              </label>
              <label className="field">
                <span className="field-label">Shipping address</span>
                <textarea
                  className="input"
                  rows={2}
                  value={shipmentAddress}
                  onChange={(e) => setShipmentAddress(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Notes</span>
                <textarea
                  className="input"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Notes file (optional)</span>
                <input
                  className="input"
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setNotesFile(file);
                  }}
                />
              </label>
              <div className="confirm-dialog-actions" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Create sample'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

