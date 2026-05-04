import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiJson } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { getDocumentLocale } from '../../i18n/locale';
import { downloadTableXlsx, type ExportRow } from '../../utils/exportExcel';
import type { FarmRow } from './FarmersInformationPage';

type EditableFields = {
  firstContactDate: string | null;
  lastVisitDate: string | null;
  visitCount: number | null;
  relationshipStatus: string | null;
};

function sliceIsoDay(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value).slice(0, 10);
}

function editableFieldsFromFarm(f: FarmRow): EditableFields {
  return {
    firstContactDate: sliceIsoDay(f.firstContactDate),
    lastVisitDate: sliceIsoDay(f.lastVisitDate),
    visitCount: typeof f.visitCount === 'number' ? f.visitCount : null,
    relationshipStatus: typeof f.relationshipStatus === 'string' ? f.relationshipStatus : null,
  };
}

function formatIsoDayForMessage(isoDay: string): string {
  try {
    const d = new Date(`${isoDay}T12:00:00.000Z`);
    return d.toLocaleDateString(undefined, { dateStyle: 'long', timeZone: 'UTC' });
  } catch {
    return isoDay;
  }
}

function isFirstContactLocked(farm: FarmRow): boolean {
  return Boolean(sliceIsoDay(farm.firstContactDate));
}

export function RelationshipTrustPage() {
  const { token, user } = useAuth();
  const isAdmin = Boolean(user?.roleNames?.includes('Admin'));
  const toast = useToast();
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, EditableFields>>({});
  const [countrySortDir, setCountrySortDir] = useState<'asc' | 'desc'>('asc');
  const [firstContactConfirm, setFirstContactConfirm] = useState<{
    farmId: string;
    farmCode: string;
    date: string;
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    apiJson<FarmRow[]>('/farms', { token })
      .then((rows) => {
        setFarms(rows);
        const initial: Record<string, EditableFields> = {};
        for (const f of rows) {
          initial[f.id] = editableFieldsFromFarm(f);
        }
        setEditing(initial);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load farms'))
      .finally(() => setLoading(false));
  }, [token]);

  const mergeFarmFromServer = useCallback((farmId: string, updated: FarmRow) => {
    setFarms((prev) => prev.map((farm) => (farm.id === farmId ? { ...farm, ...updated } : farm)));
    setEditing((prev) => ({
      ...prev,
      [farmId]: editableFieldsFromFarm(updated),
    }));
  }, []);

  const updateField = useCallback((id: string, field: keyof EditableFields, value: string) => {
    setEditing((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? {
          firstContactDate: null,
          lastVisitDate: null,
          visitCount: null,
          relationshipStatus: null,
        }),
        [field]:
          field === 'visitCount'
            ? value === ''
              ? null
              : Number(value)
            : field === 'relationshipStatus'
              ? value === ''
                ? null
                : value
              : value || null,
      },
    }));
  }, []);

  const persistFarmRelationship = useCallback(
    async (farmId: string, fields: EditableFields): Promise<boolean> => {
      if (!token || !isAdmin) return false;
      setSavingId(farmId);
      try {
        const updated = await apiJson<FarmRow>(`/farms/${farmId}`, {
          token,
          method: 'PATCH',
          body: JSON.stringify({
            firstContactDate: fields.firstContactDate,
            lastVisitDate: fields.lastVisitDate,
            visitCount: fields.visitCount,
            relationshipStatus: fields.relationshipStatus,
          }),
        });
        mergeFarmFromServer(farmId, updated);
        toast.success('Relationship updated');
        return true;
      } catch (err) {
        let msg = 'Could not update relationship';
        if (err instanceof Error) {
          try {
            const j = JSON.parse(err.message) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            msg = err.message || msg;
          }
        }
        toast.error(msg);
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [token, isAdmin, mergeFarmFromServer, toast]
  );

  const saveRow = async (farmId: string) => {
    const current = editing[farmId];
    if (!current) return;
    await persistFarmRelationship(farmId, current);
  };

  const confirmFirstContactWithFarm = async () => {
    if (!isAdmin || !firstContactConfirm || savingId) return;
    const { farmId, date } = firstContactConfirm;
    const current = editing[farmId];
    if (!current) return;
    const next: EditableFields = { ...current, firstContactDate: date };
    const ok = await persistFarmRelationship(farmId, next);
    if (ok) setFirstContactConfirm(null);
  };

  const cancelFirstContactConfirm = () => {
    setFirstContactConfirm(null);
  };

  const sortedFarms = useMemo(() => {
    return [...farms].sort((a, b) => {
      const cmp = (a.country ?? '').localeCompare(b.country ?? '', undefined, { sensitivity: 'base' });
      return countrySortDir === 'asc' ? cmp : -cmp;
    });
  }, [farms, countrySortDir]);

  const exportToExcel = useCallback(() => {
    if (sortedFarms.length === 0) {
      toast.info('No farms to export yet.');
      return;
    }
    try {
      const locale = getDocumentLocale();
      const rows: ExportRow[] = sortedFarms.map((f) => {
        const row = editing[f.id] ?? {
          firstContactDate: null,
          lastVisitDate: null,
          visitCount: null,
          relationshipStatus: null,
        };
        const fmt = (iso: string | null) =>
          iso
            ? new Date(`${iso.slice(0, 10)}T12:00:00.000Z`).toLocaleDateString(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC',
              })
            : '—';
        return {
          'Farm ID': f.code,
          'Farm name': f.farmName,
          'Contact name': f.farmerName,
          Country: f.country ?? '—',
          'First contact': fmt(row.firstContactDate),
          'Last visit': fmt(row.lastVisitDate),
          'Visit count': row.visitCount ?? '—',
          'Relationship status': (row.relationshipStatus ?? '').trim() || '—',
        };
      });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTableXlsx(`Relationship_Trust_${stamp}`, 'Relationship & Trust', rows);
      toast.success('Exported to Excel');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  }, [sortedFarms, editing, toast]);

  if (loading && farms.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Relationship & Trust</h1>
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
          <h1 className="page-title">Relationship & Trust</h1>
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
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Relationship & Trust
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
      {!isAdmin ? (
        <p
          className="table-empty"
          style={{ marginBottom: '1rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}
        >
          View only. Only administrators can edit relationship fields.
        </p>
      ) : null}
      <div className="card">
        <div className="card-body" />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Farm ID</th>
                <th>Farm name</th>
                <th>Contact name</th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setCountrySortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  title="Sort by country"
                >
                  Country {countrySortDir === 'asc' ? '↑' : '↓'}
                </th>
                <th>First contact</th>
                <th>Last visit</th>
                <th>Visit count</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {farms.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-empty">
                    No farms yet. Add farms first from the <strong>Farm Information</strong> page.
                  </td>
                </tr>
              ) : (
                sortedFarms.map((f) => {
                  const row = editing[f.id] ?? {
                    firstContactDate: null,
                    lastVisitDate: null,
                    visitCount: null,
                    relationshipStatus: null,
                  };
                  const firstLocked = isFirstContactLocked(f);
                  const pendingFirst =
                    firstContactConfirm?.farmId === f.id ? firstContactConfirm.date : null;
                  return (
                    <tr key={f.id}>
                      <td>
                        <strong>{f.code}</strong>
                      </td>
                      <td>{f.farmName}</td>
                      <td>{f.farmerName}</td>
                      <td>{f.country}</td>
                      <td>
                        <input
                          className="input"
                          type="date"
                          value={pendingFirst ?? row.firstContactDate ?? ''}
                          disabled={!isAdmin || firstLocked || savingId === f.id}
                          title={
                            !isAdmin
                              ? 'Only administrators can edit.'
                              : firstLocked
                                ? 'First contact date is set and cannot be changed.'
                                : undefined
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!isAdmin || firstLocked) return;
                            if (!v) {
                              updateField(f.id, 'firstContactDate', '');
                              return;
                            }
                            setFirstContactConfirm({
                              farmId: f.id,
                              farmCode: f.code,
                              date: v,
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          type="date"
                          value={row.lastVisitDate ?? ''}
                          disabled={!isAdmin || savingId === f.id}
                          onChange={(e) => updateField(f.id, 'lastVisitDate', e.target.value)}
                        />
                      </td>
                      <td style={{ width: 110 }}>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          step={1}
                          value={typeof row.visitCount === 'number' ? String(row.visitCount) : ''}
                          disabled={!isAdmin || savingId === f.id}
                          onChange={(e) => updateField(f.id, 'visitCount', e.target.value)}
                        />
                      </td>
                      <td
                        style={{
                          minWidth: 200,
                          maxWidth: 380,
                          verticalAlign: 'top',
                        }}
                      >
                        <textarea
                          className="input"
                          rows={4}
                          value={row.relationshipStatus ?? ''}
                          onChange={(e) => updateField(f.id, 'relationshipStatus', e.target.value)}
                          placeholder="Relationship notes and status…"
                          disabled={!isAdmin || savingId === f.id}
                          style={{
                            width: '100%',
                            minHeight: '5rem',
                            resize: 'vertical',
                            lineHeight: 1.45,
                          }}
                        />
                      </td>
                      <td style={{ width: 120, textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => void saveRow(f.id)}
                          disabled={!isAdmin || savingId === f.id}
                          title={!isAdmin ? 'Only administrators can save changes' : undefined}
                        >
                          {savingId === f.id ? 'Saving…' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={firstContactConfirm !== null}
        title="Confirm first contact with farm"
        message={
          firstContactConfirm ? (
            <p style={{ margin: 0 }}>
              Save <strong>{formatIsoDayForMessage(firstContactConfirm.date)}</strong> as the first contact date for
              farm <strong>{firstContactConfirm.farmCode}</strong>? This date will be saved and cannot be changed
              afterward.
            </p>
          ) : (
            ''
          )
        }
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={() => void confirmFirstContactWithFarm()}
        onCancel={cancelFirstContactConfirm}
      />
    </div>
  );
}
