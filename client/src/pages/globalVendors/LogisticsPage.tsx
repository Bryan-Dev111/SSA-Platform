/**
 * Global Supply — Logistics: sites with typed labels (color-coded).
 */
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, apiJson } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ExpandableTableText } from '../../components/ExpandableTableText';
import { MetricCard } from '../../components/MetricCard';
import { SortableTh } from '../../components/SortableTh';
import { downloadTableXlsx, type ExportRow } from '../../utils/exportExcel';
import { cmpStr, toggleSort, type SortDir } from '../../utils/tableSort';

export const LOGISTICS_SITE_TYPES = [
  { value: 'Port', label: 'Port', bg: '#171717', fg: '#fafafa' },
  { value: 'Exporter', label: 'Exporter', bg: '#2563eb', fg: '#ffffff' },
  { value: 'Mill', label: 'Mill', bg: '#16a34a', fg: '#ffffff' },
  { value: 'Trucking', label: 'Trucking', bg: '#eab308', fg: '#422006' },
  { value: 'Warehouse', label: 'Warehouse', bg: '#ea580c', fg: '#ffffff' },
  { value: 'Inspection', label: 'Inspection', bg: '#8b5a2b', fg: '#ffffff' },
] as const;

const TYPE_STYLE = Object.fromEntries(LOGISTICS_SITE_TYPES.map((t) => [t.value, t])) as Record<
  string,
  { bg: string; fg: string; label: string }
>;

export interface LogisticsRow {
  id: string;
  code: string;
  siteType: string;
  company: string;
  country: string;
  city: string | null;
  registrationNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: LogisticsAttachmentRow[];
}

type LogisticsAttachmentRow = {
  id: string;
  fileName: string | null;
  fileMime: string | null;
  createdAt: string;
};

function logisticsDisplayCode(code: string): string {
  return code.startsWith('LOG-') ? `BUS-${code.slice(4)}` : code;
}

type LogisticsSortKey = 'code' | 'siteType' | 'company' | 'city' | 'country';

function TypeBadge({ siteType }: { siteType: string }) {
  const s = TYPE_STYLE[siteType];
  if (!s) {
    return <span>{siteType}</span>;
  }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.15rem 0.5rem',
        borderRadius: 6,
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        background: s.bg,
        color: s.fg,
      }}
    >
      {s.label}
    </span>
  );
}

export function LogisticsPage() {
  const { token, user } = useAuth();
  const isAdmin = !!user?.roleNames?.includes('Admin');
  const toast = useToast();
  const [rows, setRows] = useState<LogisticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [attachSavingId, setAttachSavingId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: LogisticsSortKey | null; dir: SortDir }>({
    key: 'country',
    dir: 'asc',
  });

  const [siteType, setSiteType] = useState<string>('Port');
  const [company, setCompany] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [longitude, setLongitude] = useState('');
  const [latitude, setLatitude] = useState('');
  const [notes, setNotes] = useState('');

  const [editRow, setEditRow] = useState<LogisticsRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<LogisticsRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      apiJson<LogisticsRow[]>('/supply-logistics', { token })
        .then(setRows)
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load logistics'))
        .finally(() => {
          if (!opts?.silent) setLoading(false);
        });
    },
    [token]
  );

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setSiteType('Port');
    setCompany('');
    setCountry('');
    setCity('');
    setRegistrationNumber('');
    setLongitude('');
    setLatitude('');
    setNotes('');
  };

  const submitAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !isAdmin || !company.trim() || !country.trim()) return;
    setSaving(true);
    try {
      await apiJson<LogisticsRow>('/supply-logistics', {
        token,
        method: 'POST',
        body: JSON.stringify({
          siteType,
          company: company.trim(),
          country: country.trim(),
          city: city.trim() || null,
          registrationNumber: registrationNumber.trim() || null,
          longitude: longitude.trim() === '' ? null : Number(longitude),
          latitude: latitude.trim() === '' ? null : Number(latitude),
          notes: notes.trim() || null,
        }),
      });
      toast.success('Logistics site saved');
      resetForm();
      load({ silent: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !isAdmin || !editRow) return;
    setSaving(true);
    try {
      await apiJson<LogisticsRow>(`/supply-logistics/${editRow.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          siteType: editRow.siteType,
          company: editRow.company,
          country: editRow.country,
          city: editRow.city,
          registrationNumber: editRow.registrationNumber,
          longitude: editRow.longitude,
          latitude: editRow.latitude,
          notes: editRow.notes,
        }),
      });
      toast.success('Updated');
      setEditRow(null);
      load({ silent: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !isAdmin || !deleteRow || deleting) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/supply-logistics/${deleteRow.id}`, { token, method: 'DELETE' });
      if (!res.ok) {
        toast.error('Could not delete');
        return;
      }
      toast.success('Deleted');
      setDeleteRow(null);
      load({ silent: true });
    } finally {
      setDeleting(false);
    }
  };

  const uploadAttachments = async (logisticsId: string, files: FileList | File[]) => {
    if (!token || !isAdmin) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setAttachSavingId(logisticsId);
    try {
      for (const file of arr) {
        const form = new FormData();
        form.append('file', file);
        const res = await apiFetch(`/supply-logistics/${logisticsId}/attachments`, {
          token,
          method: 'POST',
          body: form,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
      }
      toast.success(arr.length === 1 ? 'Attachment uploaded' : `${arr.length} attachments uploaded`);
      load({ silent: true });
    } catch (err) {
      let msg = 'Could not upload attachment';
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
      setAttachSavingId(null);
    }
  };

  const handleAttachmentFiles = (logisticsId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    void uploadAttachments(logisticsId, list);
    e.target.value = '';
  };

  const openAttachmentDownload = async (logisticsId: string, attachmentId: string) => {
    if (!token) return;
    try {
      const r = await apiJson<{ url: string }>(
        `/supply-logistics/${logisticsId}/attachments/${attachmentId}/url`,
        { token }
      );
      window.open(r.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      let msg = 'Could not open attachment';
      if (err instanceof Error) {
        try {
          const j = JSON.parse(err.message) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          msg = err.message || msg;
        }
      }
      toast.error(msg);
    }
  };

  const deleteAttachment = async (logisticsId: string, attachmentId: string) => {
    if (!token || !isAdmin) return;
    setAttachSavingId(logisticsId);
    try {
      const res = await apiFetch(`/supply-logistics/${logisticsId}/attachments/${attachmentId}`, {
        token,
        method: 'DELETE',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      toast.success('Attachment removed');
      load({ silent: true });
    } catch (err) {
      let msg = 'Could not remove attachment';
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
      setAttachSavingId(null);
    }
  };

  const sortedRows = useMemo(() => {
    const list = [...rows];
    const { key, dir } = sort;
    if (!key) return list;
    return list.sort((a, b) => {
      switch (key) {
        case 'code':
          return cmpStr(logisticsDisplayCode(a.code), logisticsDisplayCode(b.code), dir);
        case 'siteType':
          return cmpStr(a.siteType ?? '', b.siteType ?? '', dir);
        case 'company':
          return cmpStr(a.company ?? '', b.company ?? '', dir);
        case 'city':
          return cmpStr((a.city ?? '').trim(), (b.city ?? '').trim(), dir);
        case 'country':
          return cmpStr(a.country ?? '', b.country ?? '', dir);
        default:
          return 0;
      }
    });
  }, [rows, sort]);

  const onSortColumn = (columnKey: string) => {
    setSort((prev) => toggleSort(prev, columnKey as LogisticsSortKey));
  };

  const exportToExcel = useCallback(() => {
    if (sortedRows.length === 0) {
      toast.info('No logistics sites to export yet.');
      return;
    }
    try {
      const exportRows: ExportRow[] = sortedRows.map((r) => ({
        Code: logisticsDisplayCode(r.code),
        Type: r.siteType,
        Company: r.company,
        Country: r.country,
        City: (r.city ?? '').trim() || '—',
        'Registration #': (r.registrationNumber ?? '').trim() || '—',
        Longitude: r.longitude ?? '—',
        Latitude: r.latitude ?? '—',
        Notes: (r.notes ?? '').trim() || '—',
        Attachments: r.attachments.map((a) => a.fileName || 'file').join('; ') || '—',
      }));
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTableXlsx(`Logistics_${stamp}`, 'Logistics', exportRows);
      toast.success('Exported to Excel');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  }, [sortedRows, toast]);

  if (loading && rows.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Logistics</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
        </div>
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
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Logistics
        </h1>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={exportToExcel}
          disabled={loading}
          title="Download the table as an Excel file"
        >
          Export to Excel
        </button>
      </header>

      {error && rows.length === 0 ? <div className="alert-error">{error}</div> : null}

      <div
        className="dashboard-metric-grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
          marginBottom: '1rem',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          gap: '0.75rem',
        }}
      >
        <MetricCard title="Total logistics sites" value={rows.length} />
      </div>

      {isAdmin ? (
        <div className="card" style={{ marginBottom: '1rem', width: '100%', maxWidth: '100%', minWidth: 0 }}>
          <div className="card-body">
            <form onSubmit={submitAdd} className="stack" style={{ gap: 12, marginTop: 16 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))',
                  gap: '0.6rem',
                  alignItems: 'end',
                }}
              >
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="field-label">Type</span>
                  <select className="input" value={siteType} onChange={(e) => setSiteType(e.target.value)}>
                    {LOGISTICS_SITE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="field-label">Company</span>
                  <input
                    className="input"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                    autoComplete="organization"
                  />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="field-label">Country</span>
                  <input
                    className="input"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                    autoComplete="country-name"
                  />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="field-label">City</span>
                  <input
                    className="input"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    autoComplete="address-level2"
                  />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="field-label">Registration #</span>
                  <input
                    className="input"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                  />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="field-label">Longitude</span>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. -74.006"
                  />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="field-label">Latitude</span>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 40.7128"
                  />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Notes</span>
                <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <div>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <p
          className="table-empty"
          style={{ marginBottom: '1rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}
        >
          View only. Only administrators can add logistics businesses or change attachments.
        </p>
      )}

      <div className="card" style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="table table--prevent-shrink">
              <thead>
                <tr>
                  <SortableTh
                    label="Code"
                    columnKey="code"
                    activeKey={sort.key}
                    dir={sort.dir}
                    onSort={onSortColumn}
                  />
                  <SortableTh
                    label="Type"
                    columnKey="siteType"
                    activeKey={sort.key}
                    dir={sort.dir}
                    onSort={onSortColumn}
                  />
                  <SortableTh
                    label="Company"
                    columnKey="company"
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
                    label="City"
                    columnKey="city"
                    activeKey={sort.key}
                    dir={sort.dir}
                    onSort={onSortColumn}
                  />
                  <th>Registration #</th>
                  <th>Longitude</th>
                  <th>Latitude</th>
                  <th>Notes</th>
                  <th style={{ minWidth: 220 }}>Attach files</th>
                  {isAdmin ? <th style={{ width: 170 }}>Edit/Delete</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 11 : 10} className="table-empty">
                      {isAdmin
                        ? 'No logistics sites yet. Use the form above to add one.'
                        : 'No logistics sites yet.'}
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link
                          to={`/global-vendors/logistics-profile?logisticsId=${encodeURIComponent(r.id)}`}
                          className="finding-code-link"
                          title={`Open Logistics profile — ${r.company}`}
                        >
                          <strong>{logisticsDisplayCode(r.code)}</strong>
                        </Link>
                      </td>
                      <td>
                        <TypeBadge siteType={r.siteType} />
                      </td>
                      <td>{r.company}</td>
                      <td>{r.country}</td>
                      <td>{r.city?.trim() ? r.city : '—'}</td>
                      <td>{r.registrationNumber?.trim() ? r.registrationNumber : '—'}</td>
                      <td>{typeof r.longitude === 'number' ? r.longitude : '—'}</td>
                      <td>{typeof r.latitude === 'number' ? r.latitude : '—'}</td>
                      <td style={{ maxWidth: 260, verticalAlign: 'top' }}>
                        <ExpandableTableText value={r.notes} modalTitle={`Notes — ${logisticsDisplayCode(r.code)}`} />
                      </td>
                      <td style={{ minWidth: 220, whiteSpace: 'normal', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <input
                          id={`logistics-file-upload-${r.id}`}
                          type="file"
                          multiple
                          style={{ display: 'none' }}
                          onChange={(e) => handleAttachmentFiles(r.id, e)}
                          disabled={!isAdmin || attachSavingId === r.id || saving}
                        />
                        <button
                          type="button"
                          className="btn btn-xs"
                          onClick={() => document.getElementById(`logistics-file-upload-${r.id}`)?.click()}
                          disabled={!isAdmin || attachSavingId === r.id || saving}
                          title={!isAdmin ? 'Only administrators can add attachments' : undefined}
                        >
                          Add file
                        </button>
                          {attachSavingId === r.id ? (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                              Uploading...
                            </span>
                          ) : null}
                          {r.attachments.length > 0 ? (
                            <ul
                              style={{
                                margin: '4px 0 0',
                                paddingLeft: 16,
                                fontSize: 'var(--text-xs)',
                                listStyle: 'disc',
                              }}
                            >
                              {r.attachments.map((a) => (
                                <li key={a.id}>
                                  <button
                                    type="button"
                                    className="link-button"
                                    style={{
                                      padding: 0,
                                      fontSize: 'inherit',
                                      verticalAlign: 'baseline',
                                    }}
                                    onClick={() => void openAttachmentDownload(r.id, a.id)}
                                  >
                                    {a.fileName || 'Download'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-ghost"
                                    style={{ marginLeft: 6 }}
                                    title={
                                      !isAdmin ? 'Only administrators can remove attachments' : 'Remove attachment'
                                    }
                                    disabled={!isAdmin || attachSavingId === r.id}
                                    onClick={() => void deleteAttachment(r.id, a.id)}
                                  >
                                    Remove
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </td>
                    {isAdmin ? (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setEditRow({ ...r })}
                          disabled={attachSavingId === r.id}
                        >
                          Edit
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          style={{ color: 'var(--color-danger, #b91c1c)' }}
                          onClick={() => setDeleteRow(r)}
                          disabled={attachSavingId === r.id}
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
      </div>

      {editRow ? (
        <div
          className="confirm-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-logistics-title"
          onClick={() => !saving && setEditRow(null)}
          onKeyDown={(ev) => ev.key === 'Escape' && !saving && setEditRow(null)}
        >
          <div className="confirm-dialog confirm-dialog--medium-form" onClick={(e) => e.stopPropagation()}>
            <h3 id="edit-logistics-title" className="confirm-dialog-title">
              Edit logistics site
            </h3>
            <form onSubmit={saveEdit} className="stack" style={{ gap: 12, marginTop: 16 }}>
              <label className="field">
                <span className="field-label">Type</span>
                <select
                  className="input"
                  value={editRow.siteType}
                  onChange={(e) => setEditRow((p) => (p ? { ...p, siteType: e.target.value } : null))}
                >
                  {LOGISTICS_SITE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Company</span>
                <input
                  className="input"
                  value={editRow.company}
                  onChange={(e) => setEditRow((p) => (p ? { ...p, company: e.target.value } : null))}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Country</span>
                <input
                  className="input"
                  value={editRow.country}
                  onChange={(e) => setEditRow((p) => (p ? { ...p, country: e.target.value } : null))}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">City</span>
                <input
                  className="input"
                  value={editRow.city ?? ''}
                  onChange={(e) => setEditRow((p) => (p ? { ...p, city: e.target.value || null } : null))}
                />
              </label>
              <label className="field">
                <span className="field-label">Registration #</span>
                <input
                  className="input"
                  value={editRow.registrationNumber ?? ''}
                  onChange={(e) =>
                    setEditRow((p) =>
                      p ? { ...p, registrationNumber: e.target.value.trim() ? e.target.value : null } : null
                    )
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Longitude</span>
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={editRow.longitude ?? ''}
                  onChange={(e) =>
                    setEditRow((p) =>
                      p
                        ? {
                            ...p,
                            longitude:
                              e.target.value === '' ? null : Number(e.target.value),
                          }
                        : null
                    )
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Latitude</span>
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={editRow.latitude ?? ''}
                  onChange={(e) =>
                    setEditRow((p) =>
                      p
                        ? {
                            ...p,
                            latitude:
                              e.target.value === '' ? null : Number(e.target.value),
                          }
                        : null
                    )
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Notes</span>
                <textarea
                  className="input"
                  rows={3}
                  value={editRow.notes ?? ''}
                  onChange={(e) =>
                    setEditRow((p) =>
                      p ? { ...p, notes: e.target.value.trim() ? e.target.value : null } : null
                    )
                  }
                />
              </label>
              <div className="confirm-dialog-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditRow(null)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteRow !== null}
        title="Delete logistics site"
        message={
          deleteRow ? (
            <span>
              Delete <strong>{deleteRow.code}</strong> ({deleteRow.company})? This cannot be undone.
            </span>
          ) : (
            ''
          )
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => !deleting && setDeleteRow(null)}
      />
    </div>
  );
}
