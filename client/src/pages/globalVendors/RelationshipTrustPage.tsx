import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiJson } from '../../api/client';
import type { FarmRow } from './FarmersInformationPage';

type EditableFields = {
  firstContactDate: string | null;
  lastVisitDate: string | null;
  visitCount: number | null;
  relationshipStatus: string | null;
};

export function RelationshipTrustPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, EditableFields>>({});
  const [countrySortDir, setCountrySortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    apiJson<FarmRow[]>('/farms', { token })
      .then((rows) => {
        setFarms(rows);
        const initial: Record<string, EditableFields> = {};
        for (const f of rows) {
          initial[f.id] = {
            firstContactDate: (f as any).firstContactDate
              ? String((f as any).firstContactDate).slice(0, 10)
              : null,
            lastVisitDate: (f as any).lastVisitDate
              ? String((f as any).lastVisitDate).slice(0, 10)
              : null,
            visitCount:
              typeof (f as any).visitCount === 'number'
                ? (f as any).visitCount
                : null,
            relationshipStatus:
              typeof (f as any).relationshipStatus === 'string'
                ? (f as any).relationshipStatus
                : null,
          };
        }
        setEditing(initial);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load farms')
      )
      .finally(() => setLoading(false));
  }, [token]);

  const updateField = (
    id: string,
    field: keyof EditableFields,
    value: string
  ) => {
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
            ? (value === '' ? null : Number(value))
            : field === 'relationshipStatus'
              ? (value === '' ? null : value)
              : value || null,
      },
    }));
  };

  const saveRow = async (farmId: string) => {
    if (!token) return;
    const current = editing[farmId];
    if (!current) return;
    setSavingId(farmId);
    try {
      await apiJson<FarmRow>(`/farms/${farmId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          firstContactDate: current.firstContactDate,
          lastVisitDate: current.lastVisitDate,
          visitCount: current.visitCount,
          relationshipStatus: current.relationshipStatus,
        }),
      });
      toast.success('Relationship updated');
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
    } finally {
      setSavingId(null);
    }
  };

  const sortedFarms = useMemo(() => {
    return [...farms].sort((a, b) => {
      const cmp = (a.country ?? '').localeCompare(b.country ?? '', undefined, { sensitivity: 'base' });
      return countrySortDir === 'asc' ? cmp : -cmp;
    });
  }, [farms, countrySortDir]);

  if (loading && farms.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Relationship &amp; Trust</h1>
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
          <h1 className="page-title">Relationship &amp; Trust</h1>
        </header>
        <div className="alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Relationship &amp; Trust</h1>
      </header>
      <div className="card">
        <div className="card-body">
        </div>
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
                    No farms yet. Add farms first from the{' '}
                    <strong>Farm Information</strong> page.
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
                          value={row.firstContactDate ?? ''}
                          onChange={(e) =>
                            updateField(
                              f.id,
                              'firstContactDate',
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          type="date"
                          value={row.lastVisitDate ?? ''}
                          onChange={(e) =>
                            updateField(f.id, 'lastVisitDate', e.target.value)
                          }
                        />
                      </td>
                      <td style={{ width: 110 }}>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          step={1}
                          value={
                            typeof row.visitCount === 'number'
                              ? String(row.visitCount)
                              : ''
                          }
                          onChange={(e) =>
                            updateField(f.id, 'visitCount', e.target.value)
                          }
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
                          onChange={(e) =>
                            updateField(
                              f.id,
                              'relationshipStatus',
                              e.target.value
                            )
                          }
                          placeholder="Relationship notes and status…"
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
                          disabled={savingId === f.id}
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
    </div>
  );
}

