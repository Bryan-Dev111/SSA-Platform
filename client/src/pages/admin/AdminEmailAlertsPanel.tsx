/**
 * Admin: Sourcing Director emails when a Global Supply PO opens or closes in their assigned country.
 */
import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../../api/client';

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

interface DirectorRow {
  id: string;
  email: string;
  name: string | null;
  assignedCountryNames: string[];
  emailEnabled: boolean;
}

interface SdPoEmailResponse {
  smtpConfigured: boolean;
  directors: DirectorRow[];
}

export function AdminEmailAlertsPanel({ token, toast }: { token: string | null; toast: ToastApi }) {
  const [data, setData] = useState<SdPoEmailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiJson<SdPoEmailResponse>('/users/sourcing-director-po-email-preferences', { token });
      setData(d);
      setError(null);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Failed to load email alert settings');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const setDirectorEnabled = (id: string, emailEnabled: boolean) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        directors: prev.directors.map((d) => (d.id === id ? { ...d, emailEnabled } : d)),
      };
    });
  };

  const save = async () => {
    if (!token || !data) return;
    setBusy(true);
    try {
      const preferences: Record<string, boolean> = {};
      for (const d of data.directors) {
        preferences[d.id] = d.emailEnabled;
      }
      await apiJson('/users/sourcing-director-po-email-preferences', {
        token,
        method: 'PUT',
        body: JSON.stringify({ preferences }),
      });
      toast.success('Email alert settings saved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>Email Alerts</h2>
        {error && (
          <div className="alert-error" role="alert" style={{ marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}
        <div style={{ marginBottom: '0.75rem' }}>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy || !data}>
            Save
          </button>
        </div>
        {!data && !error && token && <p>Loading…</p>}
        {data && data.directors.length === 0 && <p>No users with the Sourcing Director role.</p>}
        {data && data.directors.length > 0 && (
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Sourcing Director</th>
                  <th>Assigned countries</th>
                  <th style={{ minWidth: 160 }}>PO open/close emails</th>
                </tr>
              </thead>
              <tbody>
                {data.directors.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div>{d.email}</div>
                      {d.name && (
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{d.name}</div>
                      )}
                    </td>
                    <td>
                      {d.assignedCountryNames.length === 0 ? (
                        <span style={{ color: 'var(--color-text-muted)' }}>None — assign countries in Employees</span>
                      ) : (
                        d.assignedCountryNames.join(', ')
                      )}
                    </td>
                    <td>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={d.emailEnabled}
                          onChange={(e) => setDirectorEnabled(d.id, e.target.checked)}
                        />
                        <span>Enabled</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
