/**
 * Global Vendors — Samples list, creation modal, edit, Excel export.
 */
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ExpandableTableText } from '../../components/ExpandableTableText';
import { MetricCard } from '../../components/MetricCard';
import { SortableTh } from '../../components/SortableTh';
import { apiFetch, apiJson } from '../../api/client';
import type { FarmRow } from './FarmersInformationPage';
import { downloadTableXlsx, type ExportRow } from '../../utils/exportExcel';
import { useLanguage } from '../../context/LanguageContext';
import {
  type SortDir,
  cmpNum,
  cmpStr,
  dateMs,
  toggleSort,
} from '../../utils/tableSort';
import { GLOBAL_VENDORS_PROJECT } from '../../utils/globalSupplyClosedPoMetrics';

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
  country: string;
  buyerName: string;
  buyerEmail: string;
  crop: string;
  shipmentAddress: string;
  notes: string;
  sentDate: string;
};

type CropOption = {
  id: string;
  name: string;
};

type CountryOption = {
  id: string;
  name: string;
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

type GvExpenseRow = {
  amount: number;
  type?: string | null;
  project: string;
  description?: string | null;
};

function formatUsd(n: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function SamplesPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { t, locale } = useLanguage();
  const [samples, setSamples] = useState<SampleRow[]>([]);
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [cropOptions, setCropOptions] = useState<CropOption[]>([]);
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [farmId, setFarmId] = useState<string>('');
  const [country, setCountry] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [crop, setCrop] = useState('');
  const [shipmentAddress, setShipmentAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [notesFile, setNotesFile] = useState<File | null>(null);
  const [sentDate, setSentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [gvExpenses, setGvExpenses] = useState<GvExpenseRow[]>([]);
  const [sampleExpensesUnavailable, setSampleExpensesUnavailable] = useState(false);

  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editNotesFile, setEditNotesFile] = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [sort, setSort] = useState<{ key: SampleSortKey | null; dir: SortDir }>({
    key: null,
    dir: 'asc',
  });

  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [topScrollInnerWidth, setTopScrollInnerWidth] = useState(0);

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

  const sampleToExportRow = useCallback(
    (s: SampleRow): ExportRow => {
      const sent =
        s.sentDate != null
          ? new Date(s.sentDate).toLocaleDateString(locale, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '';
      const created = new Date(s.createdAt).toLocaleString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      return {
        [t('samples.col.sampleId')]: s.code,
        [t('samples.col.buyer')]: s.buyerName,
        [t('samples.col.buyerEmail')]: s.buyerEmail ?? '',
        [t('samples.col.dateSent')]: sent,
        [t('samples.col.farmId')]: s.farm?.code ?? '',
        [t('samples.col.farmName')]: s.farm?.farmName ?? '',
        [t('samples.col.country')]: s.farm?.country ?? '',
        [t('samples.col.crop')]: s.crop ?? '',
        [t('samples.col.deliveryAddress')]: s.shipmentAddress ?? '',
        [t('samples.col.notes')]: s.notes ?? '',
        [t('samples.col.notesFile')]: s.notesFileName ?? '',
        [t('samples.col.created')]: created,
      };
    },
    [locale, t]
  );

  const totalSampleExpenseAmountUsd = useMemo(() => {
    const sampleCodes = new Set(samples.map((s) => s.code));
    return gvExpenses
      .filter(
        (e) =>
          (e.type ?? '').trim() === 'Sample' &&
          (e.project ?? '').trim() === GLOBAL_VENDORS_PROJECT &&
          sampleCodes.has((e.description ?? '').trim())
      )
      .reduce(
        (sum, e) => sum + (typeof e.amount === 'number' && Number.isFinite(e.amount) ? e.amount : 0),
        0
      );
  }, [gvExpenses, samples]);

  const load = (opts?: { silent?: boolean }) => {
    if (!token) return;
    if (!opts?.silent) setLoading(true);
    setError(null);
    Promise.all([
      apiJson<SampleRow[]>('/samples', { token }),
      apiJson<FarmRow[]>('/farms', { token }),
      apiJson<{ list: CropOption[] }>('/global-supply-options/crops', { token }).catch(
        () => ({ list: [] as CropOption[] })
      ),
      apiJson<{ list: CountryOption[] }>('/global-supply-options/countries', { token }).catch(
        () => ({ list: [] as CountryOption[] })
      ),
      apiJson<{ list: GvExpenseRow[] }>('/expenses', { token })
        .then((r) => ({ list: r.list, ok: true as const }))
        .catch(() => ({ list: [] as GvExpenseRow[], ok: false as const })),
    ])
      .then(([samplesRes, farmsRes, cropsRes, countriesRes, expensesBundle]) => {
        setSamples(samplesRes);
        setFarms(farmsRes);
        setCropOptions(cropsRes.list);
        setCountryOptions(countriesRes.list);
        setGvExpenses(expensesBundle.list);
        setSampleExpensesUnavailable(!expensesBundle.ok);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : t('samples.loadFailed'))
      )
      .finally(() => {
        if (!opts?.silent) setLoading(false);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token-driven refresh
  }, [token]);

  useEffect(() => {
    const syncTopTrackWidth = () => {
      setTopScrollInnerWidth(tableRef.current?.scrollWidth ?? 0);
    };
    syncTopTrackWidth();
    window.addEventListener('resize', syncTopTrackWidth);
    return () => window.removeEventListener('resize', syncTopTrackWidth);
  }, [samples, sort, loading]);

  const syncScrollFromTop = () => {
    if (!topScrollRef.current || !tableScrollRef.current) return;
    tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
  };

  const syncScrollFromTable = () => {
    if (!topScrollRef.current || !tableScrollRef.current) return;
    topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
  };

  const closeModal = () => {
    setModalOpen(false);
    setFarmId('');
    setCountry('');
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
      country: s.farm?.country ?? '',
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
      toast.success(t('samples.toast.created'));
      closeModal();
      load({ silent: true });
    } catch (err) {
      let msg = t('samples.toast.createFailed');
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
      toast.error(t('samples.toast.buyerNameRequired'));
      return;
    }
    if (!editDraft.sentDate || !/^\d{4}-\d{2}-\d{2}$/.test(editDraft.sentDate)) {
      toast.error(t('samples.toast.dateSentRequired'));
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
          let msg = t('samples.toast.updateFailed');
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
      toast.success(t('samples.toast.updated'));
      closeEdit();
      load({ silent: true });
    } catch (err) {
      let msg = t('samples.toast.updateFailed');
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
      toast.info(t('samples.toast.nothingToExport'));
      return;
    }
    try {
      const rows = sortedSamples.map(sampleToExportRow);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTableXlsx(
        `${t('samples.exportFilePrefix')}_${stamp}`,
        t('samples.exportSheet'),
        rows
      );
      toast.success(t('findings.exportDone'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('findings.exportFailed'));
    }
  }, [sortedSamples, toast, t, sampleToExportRow]);

  const onSortColumn = (columnKey: string) => {
    setSort((prev) => toggleSort(prev, columnKey as SampleSortKey));
  };

  const addFarmOptions = useMemo(() => {
    if (!country) return farms;
    return farms.filter((f) => (f.country ?? '').trim() === country);
  }, [farms, country]);

  const editFarmOptions = useMemo(() => {
    if (!editDraft?.country) return farms;
    return farms.filter((f) => (f.country ?? '').trim() === editDraft.country);
  }, [farms, editDraft?.country]);

  if (loading && samples.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">{t('nav.samples')}</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>{t('samples.loadingSamples')}</p>
        </div>
      </div>
    );
  }

  if (error && samples.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">{t('nav.samples')}</h1>
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
        <h1 className="page-title">{t('nav.samples')}</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={exportToExcel}
            disabled={loading}
            title={t('common.exportExcelHint')}
          >
            {t('common.exportExcel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalOpen(true)}
          >
            {t('samples.addSample')}
          </button>
        </div>
      </header>

      <div
        className="dashboard-metric-grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          marginBottom: '1rem',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <MetricCard title={t('samples.totalSamples')} value={samples.length} />
        <MetricCard
          title={t('samples.totalSamplesValue')}
          value={sampleExpensesUnavailable ? '—' : formatUsd(totalSampleExpenseAmountUsd)}
          subtitle={sampleExpensesUnavailable ? t('samples.expensesUnavailable') : undefined}
        />
      </div>

      {error && samples.length > 0 && (
        <div className="alert-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div className="card">
        <div
          ref={topScrollRef}
          className="purchase-orders-table-scroll"
          style={{ overflowY: 'hidden', marginBottom: 6 }}
          onScroll={syncScrollFromTop}
          aria-label={t('samples.scrollTopAria')}
        >
          <div style={{ height: 1, width: topScrollInnerWidth || '100%' }} />
        </div>
        <div
          ref={tableScrollRef}
          className="table-wrap purchase-orders-table-scroll"
          onScroll={syncScrollFromTable}
        >
          <table
            ref={tableRef}
            className="table table--sticky-header table--prevent-shrink samples-table--freeze-first-2"
          >
            <thead>
              <tr>
                <SortableTh
                  label={t('samples.col.sampleId')}
                  columnKey="code"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                  style={{ minWidth: 140 }}
                />
                <SortableTh
                  label={t('samples.col.buyer')}
                  columnKey="buyerName"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                  style={{ minWidth: 220 }}
                />
                <SortableTh
                  label={t('samples.col.buyerEmail')}
                  columnKey="buyerEmail"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label={t('samples.col.dateSent')}
                  columnKey="sentDate"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label={t('samples.col.farmId')}
                  columnKey="farmCode"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label={t('samples.col.farmName')}
                  columnKey="farmName"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label={t('samples.col.country')}
                  columnKey="country"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label={t('samples.col.crop')}
                  columnKey="crop"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label={t('samples.col.deliveryAddress')}
                  columnKey="shipmentAddress"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label={t('samples.col.notes')}
                  columnKey="notes"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label={t('samples.col.notesFile')}
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
                    {t('samples.emptyList')}
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
                        ? new Date(s.sentDate).toLocaleDateString(locale, {
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
                      <ExpandableTableText
                        value={s.notes}
                        modalTitle={t('samples.notesModalTitle', { code: s.code })}
                      />
                    </td>
                    <td>
                      {s.notesFileName ? (
                        <span>{s.notesFileName}</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('common.none')}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-sm" onClick={() => openEdit(s)}>
                        {t('common.edit')}
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
              {t('samples.modalTitle')}
            </h3>
            <form
              onSubmit={submit}
              className="stack"
              style={{ gap: 12, marginTop: 16 }}
            >
              <label className="field">
                <span className="field-label">{t('samples.field.buyerName')}</span>
                <input
                  className="input"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">{t('samples.field.buyerEmail')}</span>
                <input
                  className="input"
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">{t('samples.field.dateSent')}</span>
                <input
                  className="input"
                  type="date"
                  value={sentDate}
                  onChange={(e) => setSentDate(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">{t('samples.field.country')}</span>
                <select
                  className="input"
                  value={country}
                  onChange={(e) => {
                    const next = e.target.value;
                    setCountry(next);
                    if (!next) return;
                    const selectedFarm = farms.find((f) => f.id === farmId);
                    if (selectedFarm && selectedFarm.country !== next) {
                      setFarmId('');
                    }
                  }}
                >
                  <option value="">{t('samples.selectCountry')}</option>
                  {countryOptions.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t('samples.field.farmOptional')}</span>
                <select
                  className="input"
                  value={farmId}
                  onChange={(e) => {
                    const nextFarmId = e.target.value;
                    setFarmId(nextFarmId);
                    const selectedFarm = farms.find((f) => f.id === nextFarmId);
                    if (selectedFarm) {
                      setCountry(selectedFarm.country);
                    }
                  }}
                >
                  <option value="">{t('samples.noFarmSelected')}</option>
                  {addFarmOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} — {f.farmName} ({f.country})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t('samples.field.crop')}</span>
                <select
                  className="input"
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                >
                  <option value="">{t('samples.selectCrop')}</option>
                  {cropOptions.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t('samples.field.shippingAddress')}</span>
                <textarea
                  className="input"
                  rows={2}
                  value={shipmentAddress}
                  onChange={(e) => setShipmentAddress(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">{t('samples.field.notes')}</span>
                <textarea
                  className="input"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">{t('samples.field.notesFileOptional')}</span>
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
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? t('common.saving') : t('samples.createSample')}
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
              {t('samples.modalEditTitle', {
                code: samples.find((x) => x.id === editDraft.id)?.code ?? '',
              })}
            </h3>
            <form
              onSubmit={submitEdit}
              className="stack"
              style={{ gap: 12, marginTop: 16 }}
            >
              <label className="field">
                <span className="field-label">{t('samples.field.buyerName')}</span>
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
                <span className="field-label">{t('samples.field.buyerEmail')}</span>
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
                <span className="field-label">{t('samples.field.dateSent')}</span>
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
                <span className="field-label">{t('samples.field.country')}</span>
                <select
                  className="input"
                  value={editDraft.country}
                  onChange={(e) =>
                    setEditDraft((d) => {
                      if (!d) return null;
                      const next = e.target.value;
                      const selectedFarm = farms.find((f) => f.id === d.farmId);
                      return {
                        ...d,
                        country: next,
                        farmId:
                          selectedFarm && selectedFarm.country !== next ? '' : d.farmId,
                      };
                    })
                  }
                >
                  <option value="">{t('samples.selectCountry')}</option>
                  {countryOptions.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t('samples.field.farmOptional')}</span>
                <select
                  className="input"
                  value={editDraft.farmId}
                  onChange={(e) =>
                    setEditDraft((d) => {
                      if (!d) return null;
                      const nextFarmId = e.target.value;
                      const selectedFarm = farms.find((f) => f.id === nextFarmId);
                      return {
                        ...d,
                        farmId: nextFarmId,
                        country: selectedFarm ? selectedFarm.country : d.country,
                      };
                    })
                  }
                >
                  <option value="">{t('samples.noFarmSelected')}</option>
                  {editFarmOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} — {f.farmName} ({f.country})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t('samples.field.crop')}</span>
                <select
                  className="input"
                  value={editDraft.crop}
                  onChange={(e) =>
                    setEditDraft((d) => (d ? { ...d, crop: e.target.value } : null))
                  }
                >
                  <option value="">{t('samples.selectCrop')}</option>
                  {cropOptions.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t('samples.field.shippingAddress')}</span>
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
                <span className="field-label">{t('samples.field.notes')}</span>
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
                <span className="field-label">{t('samples.field.replaceNotesFileOptional')}</span>
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
                    {t('samples.replaceNotesHint')}
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
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editSaving}
                >
                  {editSaving ? t('common.saving') : t('common.saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
