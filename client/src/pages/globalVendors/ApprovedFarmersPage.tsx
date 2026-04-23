/**
 * Global Vendors — Approved Farms List (same data as Farm Information; columns per spec where fields exist).
 */
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!token) return;
    apiJson<FarmRow[]>('/farms', { token })
      .then(setFarms)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load farms'))
      .finally(() => setLoading(false));
  }, [token]);

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
                <th>Farm category</th>
                <th>Country</th>
                <th>Region</th>
                <th>Main crop</th>
                <th>Elevation (m)</th>
                <th>Production style</th>
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
                farms.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.code}</strong>
                    </td>
                    <td>{dash(f.farmCategory)}</td>
                    <td>{f.country}</td>
                    <td>{dash(f.region)}</td>
                    <td>{dash(f.mainCrop)}</td>
                    <td>{f.elevationMeters != null ? f.elevationMeters : '—'}</td>
                    <td>{dash(f.productionStyle)}</td>
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
