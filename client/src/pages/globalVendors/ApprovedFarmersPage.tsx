/**
 * Global Vendors — Approved Farms List (same data as Farm Information; columns per spec where fields exist).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiJson } from '../../api/client';
import type { FarmRow } from './FarmersInformationPage';

function dash(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—';
  return String(v);
}

export function ApprovedFarmersPage() {
  const { token } = useAuth();
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countrySortDir, setCountrySortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!token) return;
    apiJson<FarmRow[]>('/farms', { token })
      .then(setFarms)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load farms'))
      .finally(() => setLoading(false));
  }, [token]);

  const sortedFarms = useMemo(() => {
    return [...farms].sort((a, b) => {
      const cmp = (a.country ?? '').localeCompare(b.country ?? '', undefined, { sensitivity: 'base' });
      return countrySortDir === 'asc' ? cmp : -cmp;
    });
  }, [farms, countrySortDir]);

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Approved Farms List</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Approved Farms List</h1>
        </header>
        <div className="alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Approved Farms List</h1>
      </header>
      <div className="card">
        <div className="table-wrap">
          <table className="table table--prevent-shrink">
            <thead>
              <tr>
                <th>Farm ID</th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setCountrySortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  title="Sort by country"
                >
                  Country {countrySortDir === 'asc' ? '↑' : '↓'}
                </th>
                <th>Region</th>
                <th>Elevation</th>
                <th>Crops</th>
                <th>Production Style</th>
                <th>Farm Category</th>
              </tr>
            </thead>
            <tbody>
              {farms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No farms yet. Add farms from <strong>Farm Information</strong>.
                  </td>
                </tr>
              ) : (
                sortedFarms.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link
                        to={`/global-vendors/farm-profile?farmId=${encodeURIComponent(f.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="finding-code-link"
                        title="Open farm profile (new tab)"
                      >
                        <strong>{f.code}</strong>
                      </Link>
                    </td>
                    <td>{f.country}</td>
                    <td>{dash(f.region)}</td>
                    <td>{f.elevationMeters != null ? f.elevationMeters : '—'}</td>
                    <td>
                      {f.mainCrop?.trim()
                        ? [f.mainCrop.trim(), f.secondaryCrop?.trim()].filter(Boolean).join(', ')
                        : '—'}
                    </td>
                    <td>{dash(f.productionStyle)}</td>
                    <td>{dash(f.farmCategory)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
