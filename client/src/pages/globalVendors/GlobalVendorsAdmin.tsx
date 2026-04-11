import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiJson } from '../../api/client';
import { AdminBuyersSuppliersPanel, AdminPermissionsPanel } from '../admin/AdminDay9Panels';

type Tab = 'users' | 'permissions' | 'roles';

interface GlobalSupplyStats {
  employees: number;
  commodityBuyers: number;
  farmerAccounts: number;
  registeredFarms: number;
}

export function GlobalVendorsAdmin() {
  const { token } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('users');
  const [stats, setStats] = useState<GlobalSupplyStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiJson<GlobalSupplyStats>('/users/global-supply-stats', { token });
      setStats(d);
      setStatsError(null);
    } catch (e) {
      setStats(null);
      setStatsError(e instanceof Error ? e.message : 'Failed to load stats');
    }
  }, [token]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Admin</h1>
        <p className="page-description" style={{ marginTop: '0.35rem' }}>
          Sentinel Global Supply — users and permissions.
        </p>
      </header>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1rem',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '0.75rem',
        }}
      >
        {(
          [
            ['users', 'Users'],
            ['permissions', 'Permissions'],
            ['roles', 'Roles'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Overview</h2>
              {statsError && (
                <div className="alert-error" role="alert" style={{ marginBottom: '0.75rem' }}>
                  {statsError}
                </div>
              )}
              {!stats && !statsError && token && <p className="table-empty">Loading…</p>}
              {stats && (
                <div
                  className="dashboard-metric-grid"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div className="card metric-card">
                    <div className="metric-card-label">Employees</div>
                    <div className="metric-card-value">{stats.employees}</div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                        marginTop: '0.35rem',
                      }}
                    >
                      Active users flagged as employees
                    </div>
                  </div>
                  <div className="card metric-card">
                    <div className="metric-card-label">Commodity buyers</div>
                    <div className="metric-card-value">{stats.commodityBuyers}</div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                        marginTop: '0.35rem',
                      }}
                    >
                      Accounts with role <strong>CommodityBuyer</strong>
                    </div>
                  </div>
                  <div className="card metric-card">
                    <div className="metric-card-label">Farmers</div>
                    <div className="metric-card-value">{stats.farmerAccounts}</div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                        marginTop: '0.35rem',
                      }}
                    >
                      Accounts with role <strong>Farmer</strong> ·{' '}
                      <strong>{stats.registeredFarms}</strong> registered farm profiles
                    </div>
                  </div>
                </div>
              )}
              <p style={{ marginBottom: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                Add roles such as <strong>CommodityBuyer</strong> and <strong>Farmer</strong> under main app{' '}
                <strong>Admin</strong> if they do not exist yet, then assign them to users.
              </p>
            </div>
          </div>
          <AdminBuyersSuppliersPanel
            token={token}
            toast={toast}
            showBuyerSupplierSections={false}
            globalSupplyUsersMode
          />
        </>
      )}

      {tab === 'permissions' && (
        <AdminPermissionsPanel token={token} toast={toast} scope="globalVendors" />
      )}

      {tab === 'roles' && (
        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Roles</h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 0 }}>
              Global Supply typically uses these role names (create them in main <strong>Admin → Permissions</strong>{' '}
              if needed):
            </p>
            <ul style={{ lineHeight: 1.6, marginBottom: 0 }}>
              <li>
                <strong>Admin</strong> — full access including this page
              </li>
              <li>
                <strong>CommodityBuyer</strong> — commodity buyer workflows
              </li>
              <li>
                <strong>Farmer</strong> — farmer-facing access
              </li>
              <li>
                <strong>Employee</strong> — internal employee role (counts toward Employees when combined with the
                employee flag on user records)
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
