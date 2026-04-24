import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiJson } from '../../api/client';
import { AdminBuyersSuppliersPanel, AdminPermissionsPanel } from '../admin/AdminDay9Panels';
import { GlobalSupplyMasterDataPanel } from './GlobalSupplyMasterDataPanel';
import { GlobalSupplyBuyersPanel } from './GlobalSupplyBuyersPanel';

type Tab = 'users' | 'buyers' | 'permissions' | 'crops' | 'countries';

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
            ['buyers', 'Buyers'],
            ['permissions', 'Permissions'],
            ['crops', 'Crops'],
            ['countries', 'Countries'],
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
                  </div>
                  <div className="card metric-card">
                    <div className="metric-card-label">Commodity buyers</div>
                    <div className="metric-card-value">{stats.commodityBuyers}</div>
                  </div>
                  <div className="card metric-card">
                    <div className="metric-card-label">Farmers</div>
                    <div className="metric-card-value">{stats.farmerAccounts}</div>
                  </div>
                </div>
              )}
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

      {tab === 'buyers' && <GlobalSupplyBuyersPanel token={token} toast={toast} />}

      {tab === 'crops' && (
        <GlobalSupplyMasterDataPanel
          token={token}
          toast={toast}
          title="Crops"
          noun="Crop"
          endpoint="/global-supply-options/crops"
        />
      )}

      {tab === 'countries' && (
        <GlobalSupplyMasterDataPanel
          token={token}
          toast={toast}
          title="Countries"
          noun="Country"
          endpoint="/global-supply-options/countries"
        />
      )}
    </div>
  );
}
