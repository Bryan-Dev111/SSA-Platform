/**
 * Admin: per-user toggles for the four operational alert topics (in-app alerts; honors UserAlertPreference).
 */
import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

interface CategoryCol {
  key: string;
  label: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  roleNames: string[];
}

interface MatrixResponse {
  categories: CategoryCol[];
  users: UserRow[];
  matrix: Record<string, Record<string, boolean>>;
}

export function AdminAlertPreferencesPanel({ token, toast }: { token: string | null; toast: ToastApi }) {
  const { t } = useLanguage();
  const [data, setData] = useState<MatrixResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiJson<MatrixResponse>('/users/alert-preferences-matrix', { token });
      setData(d);
      setError(null);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : t('admin.alertPrefs.loadFailed'));
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (userId: string, categoryKey: string, checked: boolean) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        matrix: {
          ...prev.matrix,
          [userId]: {
            ...(prev.matrix[userId] ?? {}),
            [categoryKey]: checked,
          },
        },
      };
    });
  };

  const save = async () => {
    if (!token || !data) return;
    setBusy(true);
    try {
      await apiJson('/users/alert-preferences-matrix', {
        token,
        method: 'PUT',
        body: JSON.stringify({ matrix: data.matrix }),
      });
      toast.success(t('admin.alertPrefs.savedToast'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('admin.alertPrefs.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-body">
        {error && (
          <div className="alert-error" role="alert" style={{ marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}
        <div style={{ marginBottom: '0.75rem' }}>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy || !data}>
            {t('admin.alertPrefs.saveButton')}
          </button>
        </div>
        {!data && !error && token && <p>{t('common.loading')}</p>}
        {data && (
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('table.col.user')}</th>
                  <th>{t('table.col.roles')}</th>
                  {data.categories.map((c) => (
                    <th key={c.key} style={{ minWidth: 140 }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div>{u.name?.trim() || t('internal.scheduleAudit.dash')}</div>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{u.email}</div>
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)' }}>{u.roleNames.join(', ')}</td>
                    {data.categories.map((c) => (
                      <td key={`${u.id}-${c.key}`}>
                        <input
                          type="checkbox"
                          checked={Boolean(data.matrix[u.id]?.[c.key])}
                          onChange={(e) => toggle(u.id, c.key, e.target.checked)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.users.length === 0 && <p className="table-empty">{t('admin.alertPrefs.emptyUsers')}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
