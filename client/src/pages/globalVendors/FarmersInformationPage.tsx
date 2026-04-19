/**
 * Global Vendors — Farmer Information: list farms, add via modal.
 */
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiJson } from '../../api/client';
import { downloadTableXlsx, type ExportRow } from '../../utils/exportExcel';

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
  totalFarmSizeHa: number | null;
  mainCropAreaHa: number | null;
  mainCropAnnualOutputKg: number | null;
  secondaryCrop: string | null;
  secondaryCropAreaHa: number | null;
  secondaryCropAnnualOutputKg: number | null;
  mainVarieties: string | null;
  secondaryVarieties: string | null;
  harvestStartMonth: string | null;
  harvestEndMonth: string | null;
  secondaryHarvestStartMonth: string | null;
  secondaryHarvestEndMonth: string | null;
  mainProcessingMethods: string | null;
  mainFermentationDays: number | null;
  mainDryingMethod: string | null;
  mainBeanSize: string | null;
  mainQualityScore: number | null;
  secondaryProcessingMethods: string | null;
  secondaryFermentationDays: number | null;
  secondaryDryingMethod: string | null;
  secondaryBeanSize: string | null;
  secondaryQualityScore: number | null;
  language: string | null;
  samplesOk: boolean | null;
  farmerEmail: string | null;
  farmerMobile: string | null;
  notes: string | null;
  // Relationship fields (used by Relationship & Trust page as well)
  firstContactDate?: string | null;
  lastVisitDate?: string | null;
  visitCount?: number | null;
  relationshipStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

function farmRowToExportRow(f: FarmRow): ExportRow {
  const mainHarvest =
    f.harvestStartMonth && f.harvestEndMonth
      ? `${f.harvestStartMonth}–${f.harvestEndMonth}`
      : '—';
  const secondaryHarvest =
    f.secondaryHarvestStartMonth && f.secondaryHarvestEndMonth
      ? `${f.secondaryHarvestStartMonth}–${f.secondaryHarvestEndMonth}`
      : '—';
  const created = new Date(f.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return {
    'Farm ID': f.code,
    'Farm name': f.farmName,
    'Farmer name': f.farmerName,
    Country: f.country,
    Region: f.region ?? '—',
    'Farm category': f.farmCategory ?? '—',
    'Main crop': f.mainCrop ?? '—',
    'Elevation (m)': typeof f.elevationMeters === 'number' ? f.elevationMeters : '—',
    'Production style': f.productionStyle ?? '—',
    City: f.city ?? '—',
    'Total farm size (ha)': typeof f.totalFarmSizeHa === 'number' ? f.totalFarmSizeHa : '—',
    'Main crop area (ha)': typeof f.mainCropAreaHa === 'number' ? f.mainCropAreaHa : '—',
    'Main crop annual output (kg)':
      typeof f.mainCropAnnualOutputKg === 'number' ? f.mainCropAnnualOutputKg : '—',
    'Secondary crop': f.secondaryCrop ?? '—',
    'Secondary area (ha)': typeof f.secondaryCropAreaHa === 'number' ? f.secondaryCropAreaHa : '—',
    'Secondary annual output (kg)':
      typeof f.secondaryCropAnnualOutputKg === 'number' ? f.secondaryCropAnnualOutputKg : '—',
    'Main varieties': f.mainVarieties ?? '—',
    'Secondary varieties': f.secondaryVarieties ?? '—',
    'Main harvest window': mainHarvest,
    'Secondary harvest window': secondaryHarvest,
    'Main processing': f.mainProcessingMethods ?? '—',
    'Main fermentation (days)':
      typeof f.mainFermentationDays === 'number' ? f.mainFermentationDays : '—',
    'Main drying': f.mainDryingMethod ?? '—',
    'Main bean size': f.mainBeanSize ?? '—',
    'Main quality score': typeof f.mainQualityScore === 'number' ? f.mainQualityScore : '—',
    'Secondary processing': f.secondaryProcessingMethods ?? '—',
    'Secondary fermentation (days)':
      typeof f.secondaryFermentationDays === 'number' ? f.secondaryFermentationDays : '—',
    'Secondary drying': f.secondaryDryingMethod ?? '—',
    'Secondary bean size': f.secondaryBeanSize ?? '—',
    'Secondary quality score':
      typeof f.secondaryQualityScore === 'number' ? f.secondaryQualityScore : '—',
    Language: f.language ?? '—',
    'Samples OK': f.samplesOk == null ? '—' : f.samplesOk ? 'Yes' : 'No',
    'Farmer email': f.farmerEmail ?? '—',
    'Farmer mobile': f.farmerMobile ?? '—',
    Latitude: typeof f.latitude === 'number' ? f.latitude : '—',
    Longitude: typeof f.longitude === 'number' ? f.longitude : '—',
    Created: created,
    ...(origin
      ? {
          'Profile URL': `${origin}/global-vendors/farmers/${f.id}/profile`,
          'Processing URL': `${origin}/global-vendors/farmers/${f.id}/processing`,
        }
      : {}),
  };
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
        totalFarmSizeHa: edit.totalFarmSizeHa,
        mainCropAreaHa: edit.mainCropAreaHa,
        mainCropAnnualOutputKg: edit.mainCropAnnualOutputKg,
        secondaryCrop: edit.secondaryCrop,
        secondaryCropAreaHa: edit.secondaryCropAreaHa,
        secondaryCropAnnualOutputKg: edit.secondaryCropAnnualOutputKg,
        mainVarieties: edit.mainVarieties,
        secondaryVarieties: edit.secondaryVarieties,
        harvestStartMonth: edit.harvestStartMonth,
        harvestEndMonth: edit.harvestEndMonth,
        secondaryHarvestStartMonth: edit.secondaryHarvestStartMonth,
        secondaryHarvestEndMonth: edit.secondaryHarvestEndMonth,
        mainProcessingMethods: edit.mainProcessingMethods,
        mainFermentationDays: edit.mainFermentationDays,
        mainDryingMethod: edit.mainDryingMethod,
        mainBeanSize: edit.mainBeanSize,
        mainQualityScore: edit.mainQualityScore,
        secondaryProcessingMethods: edit.secondaryProcessingMethods,
        secondaryFermentationDays: edit.secondaryFermentationDays,
        secondaryDryingMethod: edit.secondaryDryingMethod,
        secondaryBeanSize: edit.secondaryBeanSize,
        secondaryQualityScore: edit.secondaryQualityScore,
        language: edit.language,
        samplesOk: edit.samplesOk,
        farmerEmail: edit.farmerEmail,
        farmerMobile: edit.farmerMobile,
        notes: edit.notes,
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

  const exportToExcel = useCallback(() => {
    if (farms.length === 0) {
      toast.info('No farms to export yet.');
      return;
    }
    try {
      const rows = farms.map(farmRowToExportRow);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTableXlsx(`Farmer_Information_${stamp}`, 'Farmer Information', rows);
      toast.success('Exported to Excel');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  }, [farms, toast]);

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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={exportToExcel}
            disabled={loading}
            title="Download the current table as an Excel file"
          >
            Export to Excel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            Add farmer
          </button>
        </div>
      </header>

      <div className="card">
        <div className="table-wrap farmers-information-table-scroll">
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
                <th>Total farm size (ha)</th>
                <th>Main crop area (ha)</th>
                <th>Main crop annual output (kg)</th>
                <th>Secondary crop</th>
                <th>Secondary area (ha)</th>
                <th>Secondary annual output (kg)</th>
                <th>Main varieties</th>
                <th>Secondary varieties</th>
                <th>Main harvest window</th>
                <th>Secondary harvest window</th>
                <th>Main processing</th>
                <th>Main fermentation (days)</th>
                <th>Main drying</th>
                <th>Main bean size</th>
                <th>Main quality score</th>
                <th>Secondary processing</th>
                <th>Secondary fermentation (days)</th>
                <th>Secondary drying</th>
                <th>Secondary bean size</th>
                <th>Secondary quality score</th>
                <th>Language</th>
                <th>Samples OK</th>
                <th>Farmer email</th>
                <th>Farmer mobile</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Created</th>
                <th>Profile</th>
                <th>Processing</th>
                <th>Edit</th>
              </tr>
            </thead>
            <tbody>
              {farms.length === 0 ? (
                <tr>
                  <td colSpan={40} className="table-empty">
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
                    <td>{typeof f.totalFarmSizeHa === 'number' ? f.totalFarmSizeHa : '—'}</td>
                    <td>{typeof f.mainCropAreaHa === 'number' ? f.mainCropAreaHa : '—'}</td>
                    <td>
                      {typeof f.mainCropAnnualOutputKg === 'number'
                        ? f.mainCropAnnualOutputKg.toLocaleString()
                        : '—'}
                    </td>
                    <td>{f.secondaryCrop ?? '—'}</td>
                    <td>
                      {typeof f.secondaryCropAreaHa === 'number'
                        ? f.secondaryCropAreaHa
                        : '—'}
                    </td>
                    <td>
                      {typeof f.secondaryCropAnnualOutputKg === 'number'
                        ? f.secondaryCropAnnualOutputKg.toLocaleString()
                        : '—'}
                    </td>
                    <td>{f.mainVarieties ?? '—'}</td>
                    <td>{f.secondaryVarieties ?? '—'}</td>
                    <td>
                      {f.harvestStartMonth && f.harvestEndMonth
                        ? `${f.harvestStartMonth}–${f.harvestEndMonth}`
                        : '—'}
                    </td>
                    <td>
                      {f.secondaryHarvestStartMonth && f.secondaryHarvestEndMonth
                        ? `${f.secondaryHarvestStartMonth}–${f.secondaryHarvestEndMonth}`
                        : '—'}
                    </td>
                    <td>{f.mainProcessingMethods ?? '—'}</td>
                    <td>
                      {typeof f.mainFermentationDays === 'number'
                        ? f.mainFermentationDays
                        : '—'}
                    </td>
                    <td>{f.mainDryingMethod ?? '—'}</td>
                    <td>{f.mainBeanSize ?? '—'}</td>
                    <td>
                      {typeof f.mainQualityScore === 'number'
                        ? f.mainQualityScore.toFixed(1)
                        : '—'}
                    </td>
                    <td>{f.secondaryProcessingMethods ?? '—'}</td>
                    <td>
                      {typeof f.secondaryFermentationDays === 'number'
                        ? f.secondaryFermentationDays
                        : '—'}
                    </td>
                    <td>{f.secondaryDryingMethod ?? '—'}</td>
                    <td>{f.secondaryBeanSize ?? '—'}</td>
                    <td>
                      {typeof f.secondaryQualityScore === 'number'
                        ? f.secondaryQualityScore.toFixed(1)
                        : '—'}
                    </td>
                    <td>{f.language ?? '—'}</td>
                    <td>{f.samplesOk == null ? '—' : f.samplesOk ? 'Yes' : 'No'}</td>
                    <td>{f.farmerEmail ?? '—'}</td>
                    <td>{f.farmerMobile ?? '—'}</td>
                    <td>{typeof f.latitude === 'number' ? f.latitude : '—'}</td>
                    <td>{typeof f.longitude === 'number' ? f.longitude : '—'}</td>
                    <td>
                      {new Date(f.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link
                        to={`/global-vendors/farmers/${f.id}/profile`}
                        className="btn btn-sm"
                      >
                        Profile
                      </Link>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link
                        to={`/global-vendors/farmers/${f.id}/processing`}
                        className="btn btn-sm btn-ghost"
                      >
                        Processing
                      </Link>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-sm" onClick={() => openEdit(f)}>
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
              style={{ gap: 12, marginTop: 16, maxHeight: '70vh', overflow: 'auto', paddingRight: 4 }}
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
                <span className="field-label">Total farm size (ha)</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={
                    typeof edit.totalFarmSizeHa === 'number'
                      ? String(edit.totalFarmSizeHa)
                      : ''
                  }
                  onChange={(e) => updateEditField('totalFarmSizeHa', e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Main crop area (ha)</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={
                    typeof edit.mainCropAreaHa === 'number'
                      ? String(edit.mainCropAreaHa)
                      : ''
                  }
                  onChange={(e) => updateEditField('mainCropAreaHa', e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Main crop annual output (kg)</span>
                <input
                  className="input"
                  type="number"
                  step="1"
                  value={
                    typeof edit.mainCropAnnualOutputKg === 'number'
                      ? String(edit.mainCropAnnualOutputKg)
                      : ''
                  }
                  onChange={(e) =>
                    updateEditField('mainCropAnnualOutputKg', e.target.value)
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Secondary crop</span>
                <input
                  className="input"
                  value={edit.secondaryCrop ?? ''}
                  onChange={(e) => updateEditField('secondaryCrop', e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Secondary crop area (ha)</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={
                    typeof edit.secondaryCropAreaHa === 'number'
                      ? String(edit.secondaryCropAreaHa)
                      : ''
                  }
                  onChange={(e) =>
                    updateEditField('secondaryCropAreaHa', e.target.value)
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Secondary crop annual output (kg)</span>
                <input
                  className="input"
                  type="number"
                  step="1"
                  value={
                    typeof edit.secondaryCropAnnualOutputKg === 'number'
                      ? String(edit.secondaryCropAnnualOutputKg)
                      : ''
                  }
                  onChange={(e) =>
                    updateEditField('secondaryCropAnnualOutputKg', e.target.value)
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Main varieties</span>
                <input
                  className="input"
                  value={edit.mainVarieties ?? ''}
                  onChange={(e) => updateEditField('mainVarieties', e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Secondary varieties</span>
                <input
                  className="input"
                  value={edit.secondaryVarieties ?? ''}
                  onChange={(e) =>
                    updateEditField('secondaryVarieties', e.target.value)
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Main harvest start month</span>
                <input
                  className="input"
                  value={edit.harvestStartMonth ?? ''}
                  onChange={(e) =>
                    updateEditField('harvestStartMonth', e.target.value)
                  }
                  placeholder="e.g. January"
                />
              </label>
              <label className="field">
                <span className="field-label">Main harvest end month</span>
                <input
                  className="input"
                  value={edit.harvestEndMonth ?? ''}
                  onChange={(e) => updateEditField('harvestEndMonth', e.target.value)}
                  placeholder="e.g. March"
                />
              </label>
              <label className="field">
                <span className="field-label">Secondary harvest start month</span>
                <input
                  className="input"
                  value={edit.secondaryHarvestStartMonth ?? ''}
                  onChange={(e) =>
                    updateEditField('secondaryHarvestStartMonth', e.target.value)
                  }
                  placeholder="e.g. June"
                />
              </label>
              <label className="field">
                <span className="field-label">Secondary harvest end month</span>
                <input
                  className="input"
                  value={edit.secondaryHarvestEndMonth ?? ''}
                  onChange={(e) =>
                    updateEditField('secondaryHarvestEndMonth', e.target.value)
                  }
                  placeholder="e.g. August"
                />
              </label>
              <label className="field">
                <span className="field-label">Main processing methods</span>
                <input
                  className="input"
                  value={edit.mainProcessingMethods ?? ''}
                  onChange={(e) =>
                    updateEditField('mainProcessingMethods', e.target.value)
                  }
                  placeholder="e.g. Washed, Natural"
                />
              </label>
              <label className="field">
                <span className="field-label">Main fermentation days</span>
                <input
                  className="input"
                  type="number"
                  step="1"
                  value={
                    typeof edit.mainFermentationDays === 'number'
                      ? String(edit.mainFermentationDays)
                      : ''
                  }
                  onChange={(e) =>
                    updateEditField('mainFermentationDays', e.target.value)
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Main drying method</span>
                <input
                  className="input"
                  value={edit.mainDryingMethod ?? ''}
                  onChange={(e) =>
                    updateEditField('mainDryingMethod', e.target.value)
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Main bean size</span>
                <input
                  className="input"
                  value={edit.mainBeanSize ?? ''}
                  onChange={(e) => updateEditField('mainBeanSize', e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Main quality score</span>
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  value={
                    typeof edit.mainQualityScore === 'number'
                      ? String(edit.mainQualityScore)
                      : ''
                  }
                  onChange={(e) =>
                    updateEditField('mainQualityScore', e.target.value)
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Secondary processing methods</span>
                <input
                  className="input"
                  value={edit.secondaryProcessingMethods ?? ''}
                  onChange={(e) =>
                    updateEditField('secondaryProcessingMethods', e.target.value)
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Secondary fermentation days</span>
                <input
                  className="input"
                  type="number"
                  step="1"
                  value={
                    typeof edit.secondaryFermentationDays === 'number'
                      ? String(edit.secondaryFermentationDays)
                      : ''
                  }
                  onChange={(e) =>
                    updateEditField('secondaryFermentationDays', e.target.value)
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Secondary drying method</span>
                <input
                  className="input"
                  value={edit.secondaryDryingMethod ?? ''}
                  onChange={(e) =>
                    updateEditField('secondaryDryingMethod', e.target.value)
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Secondary bean size</span>
                <input
                  className="input"
                  value={edit.secondaryBeanSize ?? ''}
                  onChange={(e) =>
                    updateEditField('secondaryBeanSize', e.target.value)
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Secondary quality score</span>
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  value={
                    typeof edit.secondaryQualityScore === 'number'
                      ? String(edit.secondaryQualityScore)
                      : ''
                  }
                  onChange={(e) =>
                    updateEditField('secondaryQualityScore', e.target.value)
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Language</span>
                <input
                  className="input"
                  value={edit.language ?? ''}
                  onChange={(e) => updateEditField('language', e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Samples OK</span>
                <select
                  className="input"
                  value={
                    edit.samplesOk == null ? '' : edit.samplesOk ? 'yes' : 'no'
                  }
                  onChange={(e) =>
                    setEdit((prev) => ({
                      ...prev,
                      samplesOk:
                        e.target.value === ''
                          ? null
                          : e.target.value === 'yes',
                    }))
                  }
                >
                  <option value="">Not set</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Farmer email</span>
                <input
                  className="input"
                  value={edit.farmerEmail ?? ''}
                  onChange={(e) => updateEditField('farmerEmail', e.target.value)}
                  type="email"
                />
              </label>
              <label className="field">
                <span className="field-label">Farmer mobile</span>
                <input
                  className="input"
                  value={edit.farmerMobile ?? ''}
                  onChange={(e) => updateEditField('farmerMobile', e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Notes</span>
                <textarea
                  className="input"
                  rows={3}
                  value={edit.notes ?? ''}
                  onChange={(e) => updateEditField('notes', e.target.value)}
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
