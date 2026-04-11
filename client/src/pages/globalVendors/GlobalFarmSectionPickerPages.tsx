/**
 * Global Vendors — menu entry points for farm profile and processing (per-farm URLs under /farmers/:id/...).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiJson } from '../../api/client';
import type { FarmRow } from './FarmersInformationPage';

function GlobalFarmSectionPickerPage({ mode }: { mode: 'profile' | 'processing' }) {
  const { token } = useAuth();
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiJson<FarmRow[]>('/farms', { token })
      .then((rows) => {
        if (!cancelled) setFarms(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load farms');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const title = mode === 'profile' ? 'Farm profile' : 'Processing & quality';
  const segment = mode === 'profile' ? 'profile' : 'processing';
  const lead =
    mode === 'profile'
      ? 'Choose a farm to open its profile page.'
      : 'Choose a farm to open its processing & quality page.';

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-description" style={{ marginTop: '0.35rem' }}>
          {lead}{' '}
          <Link to="/global-vendors/farmers" className="finding-code-link">
            Farmer Information
          </Link>
          .
        </p>
      </header>

      <div className="card">
        <div className="card-body">
          {loading ? (
            <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Loading farms…</p>
          ) : error ? (
            <div className="alert-error">{error}</div>
          ) : farms.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>No farms yet. Add one from Farmer Information.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Farm ID</th>
                    <th>Farm name</th>
                    <th>Farmer name</th>
                    <th style={{ width: 160 }}>Open</th>
                  </tr>
                </thead>
                <tbody>
                  {farms.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <strong>{f.code}</strong>
                      </td>
                      <td>{f.farmName}</td>
                      <td>{f.farmerName}</td>
                      <td>
                        <Link className="btn btn-sm" to={`/global-vendors/farmers/${f.id}/${segment}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function GlobalFarmProfilePickerPage() {
  return <GlobalFarmSectionPickerPage mode="profile" />;
}

export function GlobalFarmProcessingPickerPage() {
  return <GlobalFarmSectionPickerPage mode="processing" />;
}
