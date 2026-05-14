import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { apiJson } from '../../api/client';
import { MetricCard } from '../../components/MetricCard';
import { AdminBuyersSuppliersPanel, AdminPermissionsPanel } from '../admin/AdminDay9Panels';
import { AdminEmailAlertsPanel } from '../admin/AdminEmailAlertsPanel';
import { GlobalSupplyMasterDataPanel } from './GlobalSupplyMasterDataPanel';
import { GlobalSupplyBuyersPanel } from './GlobalSupplyBuyersPanel';

type Tab =
  | 'users'
  | 'buyers'
  | 'permissions'
  | 'crops'
  | 'countries'
  | 'expenseTypes'
  | 'emailAlerts';

interface GlobalSupplyStats {
  employees: number;
  commodityBuyers: number;
  farmerAccounts: number;
  registeredFarms: number;
}

export function GlobalVendorsAdmin() {
  const { token } = useAuth();
  const { t } = useLanguage();
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
      setStatsError(e instanceof Error ? e.message : t('admin.statsLoadFailed'));
    }
  }, [token, t]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{t('admin.title')}</h1>
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
            ['users', t('gvAdmin.tab.users')],
            ['buyers', t('gvAdmin.tab.buyers')],
            ['permissions', t('gvAdmin.tab.permissions')],
            ['crops', t('gvAdmin.tab.crops')],
            ['countries', t('gvAdmin.tab.countries')],
            ['expenseTypes', t('gvAdmin.tab.expenseTypes')],
            ['emailAlerts', t('gvAdmin.tab.emailAlerts')],
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
              <h2 style={{ marginTop: 0 }}>{t('gvAdmin.overview.title')}</h2>
              {statsError && (
                <div className="alert-error" role="alert" style={{ marginBottom: '0.75rem' }}>
                  {statsError}
                </div>
              )}
              {!stats && !statsError && token && <p className="table-empty">{t('common.loading')}</p>}
              {stats && (
                <div
                  className="dashboard-metric-grid global-supply-admin-overview-grid"
                  style={{ marginBottom: '0.75rem' }}
                >
                  <MetricCard title={t('gvAdmin.overview.metric.employees')} value={stats.employees} />
                  <MetricCard title={t('gvAdmin.overview.metric.commodityBuyers')} value={stats.commodityBuyers} />
                  <MetricCard title={t('gvAdmin.overview.metric.farmers')} value={stats.farmerAccounts} />
                </div>
              )}
            </div>
          </div>
          <AdminBuyersSuppliersPanel
            token={token}
            toast={toast}
            showBuyerSupplierSections={false}
            globalSupplyUsersMode
            usersTableTitle={t('gvAdmin.tab.users')}
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
          entity="crops"
          endpoint="/global-supply-options/crops"
        />
      )}

      {tab === 'countries' && (
        <GlobalSupplyMasterDataPanel
          token={token}
          toast={toast}
          entity="countries"
          endpoint="/global-supply-options/countries"
        />
      )}

      {tab === 'expenseTypes' && (
        <GlobalSupplyMasterDataPanel
          token={token}
          toast={toast}
          entity="expenseTypes"
          endpoint="/global-supply-options/expense-types"
        />
      )}

      {tab === 'emailAlerts' && <AdminEmailAlertsPanel token={token} toast={toast} />}
    </div>
  );
}
