/**
 * Global Vendors — Farm Information: list farms, add via modal.
 */
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, apiJson } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ExpandableTableText } from '../../components/ExpandableTableText';
import { SortableTh } from '../../components/SortableTh';
import { downloadTableXlsx, type ExportRow } from '../../utils/exportExcel';
import { type SortDir, cmpNum, cmpStr, toggleSort } from '../../utils/tableSort';
import { getDocumentLocale } from '../../i18n/locale';

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

export type FarmProfileImageRow = {
  id: string;
  section: string;
  fileName: string | null;
  fileMime: string | null;
  sortOrder: number | null;
  createdAt: string;
  url: string | null;
};

type CountryOption = {
  id: string;
  name: string;
};

type CropOption = {
  id: string;
  name: string;
};

type FarmInfoSortKey =
  | 'code'
  | 'farmName'
  | 'farmerName'
  | 'country'
  | 'region'
  | 'city'
  | 'elevationMeters'
  | 'farmCategory';

function farmRowToExportRow(f: FarmRow): ExportRow {
  const mainHarvest =
    f.harvestStartMonth && f.harvestEndMonth
      ? `${f.harvestStartMonth}–${f.harvestEndMonth}`
      : '—';
  const secondaryHarvest =
    f.secondaryHarvestStartMonth && f.secondaryHarvestEndMonth
      ? `${f.secondaryHarvestStartMonth}–${f.secondaryHarvestEndMonth}`
      : '—';
  const created = new Date(f.createdAt).toLocaleDateString(getDocumentLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return {
    'Farm ID': f.code,
    City: f.city ?? '—',
    'Farm name': f.farmName,
    'Contact name': f.farmerName,
    Country: f.country,
    Region: f.region ?? '—',
    'Farm category': f.farmCategory ?? '—',
    'Main crop': f.mainCrop ?? '—',
    'Elevation (m)': typeof f.elevationMeters === 'number' ? f.elevationMeters : '—',
    'Production style': f.productionStyle ?? '—',
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
    'Contact email': f.farmerEmail ?? '—',
    'Contact mobile': f.farmerMobile ?? '—',
    Latitude: typeof f.latitude === 'number' ? f.latitude : '—',
    Longitude: typeof f.longitude === 'number' ? f.longitude : '—',
    Notes: f.notes?.trim() ? f.notes : '—',
    Created: created,
  };
}

export function FarmersInformationPage() {
  const { token, user } = useAuth();
  const isAdmin = !!user?.roleNames?.includes('Admin');
  const toast = useToast();
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [farmName, setFarmName] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [country, setCountry] = useState('');
  const [mainCrop, setMainCrop] = useState('');
  const [city, setCity] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<FarmRow>>({});
  const [deleteTarget, setDeleteTarget] = useState<FarmRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [profileImages, setProfileImages] = useState<FarmProfileImageRow[]>([]);
  const [profileImagesLoading, setProfileImagesLoading] = useState(false);
  const [imageUploadBusy, setImageUploadBusy] = useState<'Profile' | 'Processing' | null>(null);
  const [deleteImageTarget, setDeleteImageTarget] = useState<FarmProfileImageRow | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);
  const [sort, setSort] = useState<{ key: FarmInfoSortKey | null; dir: SortDir }>({
    key: null,
    dir: 'asc',
  });
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  const [cropOptions, setCropOptions] = useState<CropOption[]>([]);

  const loadProfileImages = useCallback(async () => {
    if (!token || !editId) return;
    setProfileImagesLoading(true);
    try {
      const r = await apiJson<{ images: FarmProfileImageRow[] }>(
        `/farms/${editId}/profile-images`,
        { token }
      );
      setProfileImages(r.images);
    } catch {
      setProfileImages([]);
    } finally {
      setProfileImagesLoading(false);
    }
  }, [token, editId]);

  useEffect(() => {
    if (!editId || !token) {
      setProfileImages([]);
      return;
    }
    void loadProfileImages();
  }, [editId, token, loadProfileImages]);

  const load = (opts?: { silent?: boolean }) => {
    if (!token) return;
    if (!opts?.silent) setLoading(true);
    Promise.all([
      apiJson<FarmRow[]>('/farms', { token }),
      apiJson<{ list: CountryOption[] }>('/global-supply-options/countries', { token }).catch(() => ({
        list: [] as CountryOption[],
      })),
      apiJson<{ list: CropOption[] }>('/global-supply-options/crops', { token }).catch(() => ({
        list: [] as CropOption[],
      })),
    ])
      .then(([farmRows, countriesRes, cropsRes]) => {
        setFarms(farmRows);
        setCountryOptions(countriesRes.list);
        setCropOptions(cropsRes.list);
      })
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
    setMainCrop('');
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
        body: JSON.stringify({
          farmName,
          farmerName,
          country,
          mainCrop: mainCrop || null,
          city: city || null,
        }),
      });
      toast.success('Farm added');
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
    setProfileImages([]);
    setDeleteImageTarget(null);
  };

  const uploadProfileImage = async (section: 'Profile' | 'Processing', files: FileList | File[]) => {
    if (!token || !editId) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setImageUploadBusy(section);
    try {
      for (const file of arr) {
        const form = new FormData();
        form.append('file', file);
        form.append('section', section);
        const res = await apiFetch(`/farms/${editId}/profile-images`, {
          token,
          method: 'POST',
          body: form,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
      }
      toast.success(arr.length === 1 ? 'Photo added' : `${arr.length} photos added`);
      await loadProfileImages();
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
      setImageUploadBusy(null);
    }
  };

  const confirmDeleteProfileImage = async () => {
    if (!token || !editId || !deleteImageTarget || deletingImage) return;
    setDeletingImage(true);
    try {
      const res = await apiFetch(`/farms/${editId}/profile-images/${deleteImageTarget.id}`, {
        token,
        method: 'DELETE',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      toast.success('Photo removed');
      setDeleteImageTarget(null);
      await loadProfileImages();
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
      setDeletingImage(false);
    }
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
      toast.success('Farm updated');
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

  const confirmDeleteFarm = async () => {
    if (!token || !deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/farms/${deleteTarget.id}`, { token, method: 'DELETE' });
      if (!res.ok) {
        let msg = 'Could not delete farm';
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* ignore */
        }
        toast.error(msg);
        return;
      }
      toast.success('Farm deleted');
      setDeleteTarget(null);
      load({ silent: true });
    } catch {
      toast.error('Could not delete farm');
    } finally {
      setDeleting(false);
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
      downloadTableXlsx(`Farm_Information_${stamp}`, 'Farm Information', rows);
      toast.success('Exported to Excel');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  }, [farms, toast]);

  const sortedFarms = useMemo(() => {
    const rows = [...farms];
    const k = sort.key;
    if (!k) return rows;
    const dir = sort.dir;
    rows.sort((a, b) => {
      let c = 0;
      switch (k) {
        case 'code':
          c = cmpStr(a.code, b.code, dir);
          break;
        case 'farmName':
          c = cmpStr(a.farmName ?? '', b.farmName ?? '', dir);
          break;
        case 'farmerName':
          c = cmpStr(a.farmerName ?? '', b.farmerName ?? '', dir);
          break;
        case 'country':
          c = cmpStr(a.country ?? '', b.country ?? '', dir);
          break;
        case 'region':
          c = cmpStr(a.region ?? '', b.region ?? '', dir);
          break;
        case 'city':
          c = cmpStr(a.city ?? '', b.city ?? '', dir);
          break;
        case 'elevationMeters':
          c = cmpNum(a.elevationMeters ?? Number.NEGATIVE_INFINITY, b.elevationMeters ?? Number.NEGATIVE_INFINITY, dir);
          break;
        case 'farmCategory':
          c = cmpStr(a.farmCategory ?? '', b.farmCategory ?? '', dir);
          break;
        default:
          break;
      }
      if (c !== 0) return c;
      return cmpStr(a.code, b.code, 'asc');
    });
    return rows;
  }, [farms, sort]);

  const onSortColumn = (columnKey: string) => {
    setSort((prev) => toggleSort(prev, columnKey as FarmInfoSortKey));
  };

  if (loading && farms.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Farm Information</h1>
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
          <h1 className="page-title">Farm Information</h1>
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
        <h1 className="page-title">Farm Information</h1>
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
            Add Farm
          </button>
        </div>
      </header>

      <div className="card">
        <div className="table-wrap farmers-information-table-scroll">
          <table className="table table--sticky-header table--prevent-shrink farmers-information-table">
            <thead>
              <tr>
                <SortableTh
                  label="Farm ID"
                  columnKey="code"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                  style={{ minWidth: 130 }}
                />
                <SortableTh
                  label="Farm name"
                  columnKey="farmName"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                  style={{ minWidth: 180 }}
                />
                <SortableTh
                  label="Contact name"
                  columnKey="farmerName"
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
                  label="Region"
                  columnKey="region"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="City"
                  columnKey="city"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Elevation (m)"
                  columnKey="elevationMeters"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Farm category"
                  columnKey="farmCategory"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <th>Main crop</th>
                <th>Production style</th>
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
                <th>Contact email</th>
                <th>Contact mobile</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Notes</th>
                <th>Created</th>
                {isAdmin ? <th>Edit</th> : null}
                {isAdmin ? <th>Delete</th> : null}
              </tr>
            </thead>
            <tbody>
              {farms.length === 0 ? (
                <tr>
                  <td colSpan={40} className="table-empty">
                    No farms yet. Use <strong>Add Farm</strong> to create one.
                  </td>
                </tr>
              ) : (
                sortedFarms.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link
                        to={`/global-vendors/farm-profile?farmId=${encodeURIComponent(f.id)}`}
                        className="finding-code-link"
                        title="Open Farm profile"
                      >
                        <strong>{f.code}</strong>
                      </Link>
                    </td>
                    <td>{f.farmName}</td>
                    <td>{f.farmerName}</td>
                    <td>{f.country}</td>
                    <td>{f.region ?? '—'}</td>
                    <td>{f.city ?? '—'}</td>
                    <td>{typeof f.elevationMeters === 'number' ? f.elevationMeters : '—'}</td>
                    <td>{f.farmCategory ?? '—'}</td>
                    <td>{f.mainCrop ?? '—'}</td>
                    <td>{f.productionStyle ?? '—'}</td>
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
                    <td
                      style={{
                        maxWidth: 220,
                        verticalAlign: 'top',
                      }}
                    >
                      <ExpandableTableText value={f.notes} modalTitle={`Notes — ${f.code}`} />
                    </td>
                    <td>
                      {new Date(f.createdAt).toLocaleDateString(getDocumentLocale(), {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    {isAdmin ? (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn btn-sm" onClick={() => openEdit(f)}>
                          Edit
                        </button>
                      </td>
                    ) : null}
                    {isAdmin ? (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          style={{ color: 'var(--color-danger, #b91c1c)' }}
                          onClick={() => setDeleteTarget(f)}
                        >
                          Delete
                        </button>
                      </td>
                    ) : null}
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
          <div className="confirm-dialog confirm-dialog--medium-form" onClick={(e) => e.stopPropagation()}>
            <h3 id="add-farm-title" className="confirm-dialog-title">
              Add Farm
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
                <span className="field-label">Contact name</span>
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
                <select
                  className="input"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  required
                >
                  <option value="">Select country</option>
                  {countryOptions.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
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
              <label className="field">
                <span className="field-label">Crop</span>
                <select
                  className="input"
                  value={mainCrop}
                  onChange={(e) => setMainCrop(e.target.value)}
                >
                  <option value="">Select crop</option>
                  {cropOptions.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
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
          <div className="confirm-dialog confirm-dialog--wide" onClick={(e) => e.stopPropagation()}>
            <h3 id="edit-farm-title" className="confirm-dialog-title">
              Edit farm
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
                <span className="field-label">Contact name</span>
                <input
                  className="input"
                  value={edit.farmerName ?? ''}
                  onChange={(e) => updateEditField('farmerName', e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Country</span>
                <select
                  className="input"
                  value={edit.country ?? ''}
                  onChange={(e) => updateEditField('country', e.target.value)}
                  required
                >
                  <option value="">Select country</option>
                  {countryOptions.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
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
                <select
                  className="input"
                  value={edit.mainCrop ?? ''}
                  onChange={(e) => updateEditField('mainCrop', e.target.value)}
                >
                  <option value="">Select crop</option>
                  {cropOptions.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
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
                <select
                  className="input"
                  value={edit.secondaryCrop ?? ''}
                  onChange={(e) => updateEditField('secondaryCrop', e.target.value)}
                >
                  <option value="">Select crop</option>
                  {cropOptions.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
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
                <span className="field-label">Contact email</span>
                <input
                  className="input"
                  value={edit.farmerEmail ?? ''}
                  onChange={(e) => updateEditField('farmerEmail', e.target.value)}
                  type="email"
                />
              </label>
              <label className="field">
                <span className="field-label">Contact mobile</span>
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

              <div
                style={{
                  marginTop: 12,
                  paddingTop: 16,
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <p className="field-label" style={{ marginBottom: 12 }}>
                  Photos (JPEG, PNG, WebP, or GIF — max ~12 MB each)
                </p>
                {profileImagesLoading ? (
                  <p className="table-empty" style={{ marginBottom: 12 }}>
                    Loading photos…
                  </p>
                ) : null}

                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span className="field-label" style={{ marginBottom: 0 }}>
                      Farm profile
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        id="farm-profile-img-upload-profile"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const list = e.target.files;
                          if (list?.length) void uploadProfileImage('Profile', list);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        disabled={!!imageUploadBusy || saving}
                        onClick={() =>
                          document.getElementById('farm-profile-img-upload-profile')?.click()
                        }
                      >
                        {imageUploadBusy === 'Profile' ? 'Uploading…' : 'Add photo'}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {profileImages.filter((i) => i.section === 'Profile').length === 0 &&
                    !profileImagesLoading ? (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                        No profile photos yet.
                      </span>
                    ) : null}
                    {profileImages
                      .filter((i) => i.section === 'Profile')
                      .map((img) => (
                        <div key={img.id} style={{ width: 128 }}>
                          {img.url ? (
                            <img
                              src={img.url}
                              alt={img.fileName || 'Farm profile'}
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
                            style={{
                              marginTop: 6,
                              color: 'var(--color-danger, #b91c1c)',
                              width: '100%',
                            }}
                            disabled={!!imageUploadBusy || saving}
                            onClick={() => setDeleteImageTarget(img)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span className="field-label" style={{ marginBottom: 0 }}>
                      Processing &amp; quality
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        id="farm-profile-img-upload-processing"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const list = e.target.files;
                          if (list?.length) void uploadProfileImage('Processing', list);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        disabled={!!imageUploadBusy || saving}
                        onClick={() =>
                          document.getElementById('farm-profile-img-upload-processing')?.click()
                        }
                      >
                        {imageUploadBusy === 'Processing' ? 'Uploading…' : 'Add photo'}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {profileImages.filter((i) => i.section === 'Processing').length === 0 &&
                    !profileImagesLoading ? (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                        No processing or quality photos yet.
                      </span>
                    ) : null}
                    {profileImages
                      .filter((i) => i.section === 'Processing')
                      .map((img) => (
                        <div key={img.id} style={{ width: 128 }}>
                          {img.url ? (
                            <img
                              src={img.url}
                              alt={img.fileName || 'Processing'}
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
                            style={{
                              marginTop: 6,
                              color: 'var(--color-danger, #b91c1c)',
                              width: '100%',
                            }}
                            disabled={!!imageUploadBusy || saving}
                            onClick={() => setDeleteImageTarget(img)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete farm"
        message={
          deleteTarget ? (
            <span>
              Delete farm <strong>{deleteTarget.code}</strong> ({deleteTarget.farmName})? Purchase orders and samples
              linked to this farm will be unlinked. This cannot be undone.
            </span>
          ) : (
            ''
          )
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        variant="danger"
        onConfirm={() => void confirmDeleteFarm()}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={deleteImageTarget !== null}
        title="Remove photo?"
        message={
          deleteImageTarget ? (
            <span>
              Remove this photo{deleteImageTarget.fileName ? ` (${deleteImageTarget.fileName})` : ''} from
              the farm profile? This cannot be undone.
            </span>
          ) : (
            ''
          )
        }
        confirmLabel={deletingImage ? 'Removing…' : 'Remove'}
        variant="danger"
        onConfirm={() => void confirmDeleteProfileImage()}
        onCancel={() => !deletingImage && setDeleteImageTarget(null)}
      />
    </div>
  );
}
