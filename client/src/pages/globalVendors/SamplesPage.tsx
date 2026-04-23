/**
 * Global Vendors — Samples list, creation modal, edit, Excel export.
 */
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ExpandableTableText } from '../../components/ExpandableTableText';
import { SortableTh } from '../../components/SortableTh';
import { apiFetch, apiJson } from '../../api/client';
import type { FarmRow } from './FarmersInformationPage';
import { downloadTableXlsx, type ExportRow } from '../../utils/exportExcel';
import {
  type SortDir,
  cmpNum,
  cmpStr,
  dateMs,
  toggleSort,
} from '../../utils/tableSort';

type SampleRow = {
  id: string;
  code: string;
  farmId: string | null;
  buyerName: string;
  buyerEmail: string | null;
  crop: string | null;
  shipmentAddress: string | null;
  notes: string | null;
  sentDate: string | null;
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

type EditDraft = {
  id: string;
  farmId: string;
  buyerName: string;
  buyerEmail: string;
  crop: string;
  shipmentAddress: string;
  notes: string;
  sentDate: string;
};

type SampleSortKey =
  | 'code'
  | 'buyerName'
  | 'buyerEmail'
  | 'sentDate'
  | 'farmCode'
  | 'farmName'
  | 'country'
  | 'crop'
  | 'shipmentAddress'
  | 'notes'
  | 'notesFileName';

function sampleToExportRow(s: SampleRow): ExportRow {
  const sent =
    s.sentDate != null
      ? new Date(s.sentDate).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '';
  const created = new Date(s.createdAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return {
    'Sample ID': s.code,
    Buyer: s.buyerName,
    'Buyer email': s.buyerEmail ?? '',
    'Date sent': sent,
    'Farm ID': s.farm?.code ?? '',
    'Farm name': s.farm?.farmName ?? '',
    Country: s.farm?.country ?? '',
    Crop: s.crop ?? '',
    'Delivery address': s.shipmentAddress ?? '',
    Notes: s.notes ?? '',
    'Notes file': s.notesFileName ?? '',
    Created: created,
  };
}

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
  const [sentDate, setSentDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editNotesFile, setEditNotesFile] = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [sort, setSort] = useState<{ key: SampleSortKey | null; dir: SortDir }>({
    key: null,
    dir: 'asc',
  });

  const sortedSamples = useMemo(() => {
    const rows = [...samples];
    const k = sort.key;
    if (!k) return rows;
    const dir = sort.dir;
    rows.sort((a, b) => {
      let c = 0;
      switch (k) {
        case 'code':
          c = cmpStr(a.code, b.code, dir);
          break;
        case 'buyerName':
          c = cmpStr(a.buyerName, b.buyerName, dir);
          break;
        case 'buyerEmail':
          c = cmpStr(a.buyerEmail ?? '', b.buyerEmail ?? '', dir);
          break;
        case 'sentDate':
          c = cmpNum(dateMs(a.sentDate), dateMs(b.sentDate), dir);
          break;
        case 'farmCode':
          c = cmpStr(a.farm?.code ?? '', b.farm?.code ?? '', dir);
          break;
        case 'farmName':
          c = cmpStr(a.farm?.farmName ?? '', b.farm?.farmName ?? '', dir);
          break;
        case 'country':
          c = cmpStr(a.farm?.country ?? '', b.farm?.country ?? '', dir);
          break;
        case 'crop':
          c = cmpStr(a.crop ?? '', b.crop ?? '', dir);
          break;
        case 'shipmentAddress':
          c = cmpStr(a.shipmentAddress ?? '', b.shipmentAddress ?? '', dir);
          break;
        case 'notes':
          c = cmpStr(a.notes ?? '', b.notes ?? '', dir);
          break;
        case 'notesFileName':
          c = cmpStr(a.notesFileName ?? '', b.notesFileName ?? '', dir);
          break;
        default:
          break;
      }
      if (c !== 0) return c;
      return cmpStr(a.id, b.id, 'asc');
    });
    return rows;
  }, [samples, sort]);

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
    setSentDate(new Date().toISOString().slice(0, 10));
  };

  const openEdit = (s: SampleRow) => {
    setEditDraft({
      id: s.id,
      farmId: s.farmId ?? '',
      buyerName: s.buyerName,
      buyerEmail: s.buyerEmail ?? '',
      crop: s.crop ?? '',
      shipmentAddress: s.shipmentAddress ?? '',
      notes: s.notes ?? '',
      sentDate: s.sentDate ? String(s.sentDate).slice(0, 10) : '',
    });
    setEditNotesFile(null);
  };

  const closeEdit = () => {
    setEditDraft(null);
    setEditNotesFile(null);
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
      form.append('sentDate', sentDate);
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

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !editDraft) return;
    if (!editDraft.buyerName.trim()) {
      toast.error('Buyer name is required');
      return;
    }
    if (!editDraft.sentDate || !/^\d{4}-\d{2}-\d{2}$/.test(editDraft.sentDate)) {
      toast.error('Date sample was sent is required');
      return;
    }
    setEditSaving(true);
    try {
      if (editNotesFile) {
        const form = new FormData();
        form.append('buyerName', editDraft.buyerName.trim());
        form.append('buyerEmail', editDraft.buyerEmail.trim());
        form.append('crop', editDraft.crop.trim());
        form.append('shipmentAddress', editDraft.shipmentAddress.trim());
        form.append('notes', editDraft.notes.trim());
        form.append('sentDate', editDraft.sentDate);
        form.append('farmId', editDraft.farmId.trim());
        form.append('notesFile', editNotesFile);
        const res = await apiFetch(`/samples/${editDraft.id}`, {
          token,
          method: 'PATCH',
          body: form,
        });
        if (!res.ok) {
          let msg = 'Could not update sample';
          try {
            const j = (await res.json()) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            /* ignore */
          }
          toast.error(msg);
          return;
        }
      } else {
        await apiJson<SampleRow>(`/samples/${editDraft.id}`, {
          token,
          method: 'PATCH',
          body: JSON.stringify({
            buyerName: editDraft.buyerName.trim(),
            buyerEmail: editDraft.buyerEmail.trim() || null,
            crop: editDraft.crop.trim() || null,
            shipmentAddress: editDraft.shipmentAddress.trim() || null,
            notes: editDraft.notes.trim() || null,
            farmId: editDraft.farmId.trim() || null,
            sentDate: editDraft.sentDate,
          }),
        });
      }
      toast.success('Sample updated');
      closeEdit();
      load({ silent: true });
    } catch (err) {
      let msg = 'Could not update sample';
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
      setEditSaving(false);
    }
  };

  const exportToExcel = useCallback(() => {
    if (sortedSamples.length === 0) {
      toast.info('No samples to export yet.');
      return;
    }
    try {
      const rows = sortedSamples.map(sampleToExportRow);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTableXlsx(`Samples_${stamp}`, 'Samples', rows);
      toast.success('Exported to Excel');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  }, [sortedSamples, toast]);

  const onSortColumn = (columnKey: string) => {
    setSort((prev) => toggleSort(prev, columnKey as SampleSortKey));
  };

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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={exportToExcel}
            disabled={loading}
            title="Download the table as an Excel file"
          >
            Export to Excel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalOpen(true)}
          >
            Add sample
          </button>
        </div>
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
                <SortableTh
                  label="Sample ID"
                  columnKey="code"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Buyer"
                  columnKey="buyerName"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Buyer email"
                  columnKey="buyerEmail"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Date sent"
                  columnKey="sentDate"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Farm ID"
                  columnKey="farmCode"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Farm name"
                  columnKey="farmName"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Country"
                  columnKey="country"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Crop"
                  columnKey="crop"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Delivery address"
                  columnKey="shipmentAddress"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Notes"
                  columnKey="notes"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Notes file"
                  columnKey="notesFileName"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <th style={{ width: 100 }} />
              </tr>
            </thead>
            <tbody>
              {sortedSamples.length === 0 ? (
                <tr>
                  <td colSpan={12} className="table-empty">
                    No samples yet. Use <strong>Add sample</strong> to create
                    one.
                  </td>
                </tr>
              ) : (
                sortedSamples.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.code}</strong>
                    </td>
                    <td>{s.buyerName}</td>
                    <td>{s.buyerEmail ?? '—'}</td>
                    <td>
                      {s.sentDate
                        ? new Date(s.sentDate).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td>{s.farm ? s.farm.code : '—'}</td>
                    <td>{s.farm ? s.farm.farmName : '—'}</td>
                    <td>{s.farm ? s.farm.country : '—'}</td>
                    <td>{s.crop ?? '—'}</td>
                    <td>{s.shipmentAddress ?? '—'}</td>
                    <td style={{ maxWidth: 280, verticalAlign: 'top' }}>
                      <ExpandableTableText value={s.notes} modalTitle={`Notes — ${s.code}`} />
                    </td>
                    <td>
                      {s.notesFileName ? (
                        <span>{s.notesFileName}</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          None
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-sm" onClick={() => openEdit(s)}>
                        Edit
                      </button>
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
          <div className="confirm-dialog confirm-dialog--medium-form" onClick={(e) => e.stopPropagation()}>
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
                <span className="field-label">Date sample was sent</span>
                <input
                  className="input"
                  type="date"
                  value={sentDate}
                  onChange={(e) => setSentDate(e.target.value)}
                  required
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

      {editDraft ? (
        <div
          className="confirm-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-sample-title"
          onClick={() => !editSaving && closeEdit()}
          onKeyDown={(ev) => ev.key === 'Escape' && !editSaving && closeEdit()}
        >
          <div className="confirm-dialog confirm-dialog--medium-form" onClick={(e) => e.stopPropagation()}>
            <h3 id="edit-sample-title" className="confirm-dialog-title">
              Edit sample <strong>{samples.find((x) => x.id === editDraft.id)?.code ?? ''}</strong>
            </h3>
            <form
              onSubmit={submitEdit}
              className="stack"
              style={{ gap: 12, marginTop: 16 }}
            >
              <label className="field">
                <span className="field-label">Buyer name</span>
                <input
                  className="input"
                  value={editDraft.buyerName}
                  onChange={(e) =>
                    setEditDraft((d) => (d ? { ...d, buyerName: e.target.value } : null))
                  }
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Buyer email</span>
                <input
                  className="input"
                  type="email"
                  value={editDraft.buyerEmail}
                  onChange={(e) =>
                    setEditDraft((d) => (d ? { ...d, buyerEmail: e.target.value } : null))
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Date sample was sent</span>
                <input
                  className="input"
                  type="date"
                  value={editDraft.sentDate}
                  onChange={(e) =>
                    setEditDraft((d) => (d ? { ...d, sentDate: e.target.value } : null))
                  }
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Farm (optional)</span>
                <select
                  className="input"
                  value={editDraft.farmId}
                  onChange={(e) =>
                    setEditDraft((d) => (d ? { ...d, farmId: e.target.value } : null))
                  }
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
                  value={editDraft.crop}
                  onChange={(e) =>
                    setEditDraft((d) => (d ? { ...d, crop: e.target.value } : null))
                  }
                  placeholder="e.g. Coffee, Cocoa"
                />
              </label>
              <label className="field">
                <span className="field-label">Shipping address</span>
                <textarea
                  className="input"
                  rows={2}
                  value={editDraft.shipmentAddress}
                  onChange={(e) =>
                    setEditDraft((d) =>
                      d ? { ...d, shipmentAddress: e.target.value } : null
                    )
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Notes</span>
                <textarea
                  className="input"
                  rows={3}
                  value={editDraft.notes}
                  onChange={(e) =>
                    setEditDraft((d) => (d ? { ...d, notes: e.target.value } : null))
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Replace notes file (optional)</span>
                <input
                  className="input"
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setEditNotesFile(file);
                  }}
                />
                {editNotesFile ? (
                  <p style={{ margin: '0.35rem 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    New file will be uploaded on save. Leave empty to keep the current file.
                  </p>
                ) : null}
              </label>
              <div className="confirm-dialog-actions" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeEdit}
                  disabled={editSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editSaving}
                >
                  {editSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
