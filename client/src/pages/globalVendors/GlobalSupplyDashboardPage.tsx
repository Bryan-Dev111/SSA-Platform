import { useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { MetricCard } from '../../components/MetricCard';
import {
  ChartCard,
  ContinuousLineChart,
  VerticalBarChart,
  type BarChartRow,
  type TimePointRow,
} from '../../components/DashboardBarCharts';
import {
  computeClosedPurchaseOrderFinancials,
  filterGlobalVendorsExpenses,
  isPurchaseOrderClosed,
} from '../../utils/globalSupplyClosedPoMetrics';
import { getDocumentLocale } from '../../i18n/locale';

type CountryValueRow = { country: string; value: number };

type DashboardPayload = {
  revenueByCountry: CountryValueRow[];
  profitByCountry: CountryValueRow[];
  kgCountryCoffee: CountryValueRow[];
  kgCountryCocoa: CountryValueRow[];
  poCreationOverTimeOpen: TimePointRow[];
  sampleCountByCountry: CountryValueRow[];
};

type PurchaseOrderKpiRow = {
  id: string;
  status: string | null;
  quantityKg: number | null;
  pricePerKg: number | null;
  totalAmount: number | null;
};

type ExpenseKpiRow = {
  amount: number;
  project: string;
  purchaseOrderId?: string | null;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatKg(value: number): string {
  return `${value.toLocaleString(getDocumentLocale(), { maximumFractionDigits: 2 })} kg`;
}

function formatSampleCount(value: number, samplesUnit: string): string {
  return `${Math.round(value).toLocaleString()} ${samplesUnit}`;
}

function countryRowsToBar(rows: CountryValueRow[]): BarChartRow[] {
  return rows.map((r) => ({ label: r.country, value: r.value }));
}

export function GlobalSupplyDashboardPage() {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [poKpiLoading, setPoKpiLoading] = useState(true);
  const [poOrdersKpi, setPoOrdersKpi] = useState<PurchaseOrderKpiRow[]>([]);
  const [poExpensesKpi, setPoExpensesKpi] = useState<ExpenseKpiRow[]>([]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    apiJson<DashboardPayload>('/global-supply-dashboard', { token })
      .then((response) => setData(response))
      .catch((e) => {
        setError(e instanceof Error ? e.message : t('globalDash.loadFailed'));
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [token, t]);

  useEffect(() => {
    if (!token) {
      setPoOrdersKpi([]);
      setPoExpensesKpi([]);
      setPoKpiLoading(false);
      return;
    }
    setPoKpiLoading(true);
    Promise.all([
      apiJson<PurchaseOrderKpiRow[]>('/purchase-orders', { token }).catch(() => [] as PurchaseOrderKpiRow[]),
      apiJson<{ list: ExpenseKpiRow[] }>('/expenses', { token }).catch(() => ({ list: [] as ExpenseKpiRow[] })),
    ])
      .then(([orders, ex]) => {
        setPoOrdersKpi(orders);
        setPoExpensesKpi(ex.list);
      })
      .finally(() => setPoKpiLoading(false));
  }, [token]);

  const closedPoKpis = useMemo(
    () => computeClosedPurchaseOrderFinancials(poOrdersKpi, filterGlobalVendorsExpenses(poExpensesKpi)),
    [poOrdersKpi, poExpensesKpi]
  );

  const { totalPoCount, openPoCount } = useMemo(() => {
    let open = 0;
    for (const o of poOrdersKpi) {
      if (!isPurchaseOrderClosed(o.status)) open += 1;
    }
    return { totalPoCount: poOrdersKpi.length, openPoCount: open };
  }, [poOrdersKpi]);

  const topRevenue = useMemo(() => countryRowsToBar((data?.revenueByCountry ?? []).slice(0, 12)), [data]);
  const topProfit = useMemo(() => countryRowsToBar((data?.profitByCountry ?? []).slice(0, 12)), [data]);
  const coffeeKg = useMemo(() => countryRowsToBar((data?.kgCountryCoffee ?? []).slice(0, 12)), [data]);
  const cocoaKg = useMemo(() => countryRowsToBar((data?.kgCountryCocoa ?? []).slice(0, 12)), [data]);
  const sampleByCountry = useMemo(
    () => countryRowsToBar((data?.sampleCountByCountry ?? []).slice(0, 24)),
    [data]
  );
  const sampleFormatter = useMemo(
    () => (value: number) => formatSampleCount(value, t('globalDash.samplesUnit')),
    [t]
  );
  const openPoTrend = data?.poCreationOverTimeOpen ?? [];
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greeting.morning');
    if (hour < 18) return t('dashboard.greeting.afternoon');
    return t('dashboard.greeting.evening');
  }, [t]);
  const displayName = user?.name?.trim() || 'John T.';

  return (
    <div className="page page-dashboard">
      <header className="page-header">
        <h1 className="page-title">{t('nav.businessDashboard')}</h1>
        <p className="page-description" style={{ marginTop: '0.35rem' }}>
          {greeting}, {displayName}. {t('globalDash.intro')}
        </p>
      </header>

      {error ? <div className="alert-error">{error}</div> : null}
      {loading && !data ? (
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>{t('common.loading')}</p>
        </div>
      ) : null}

      <div
        className="dashboard-metric-grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          marginBottom: '1rem',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <MetricCard
          title={t('globalDash.metric.totalPOs')}
          value={poKpiLoading ? '—' : totalPoCount}
          subtitle={
            poKpiLoading
              ? undefined
              : t('globalDash.metric.openPOSubtitle', { open: openPoCount, total: totalPoCount })
          }
        />
        <MetricCard
          title={t('globalDash.metric.avgRevenuePo')}
          value={
            poKpiLoading || closedPoKpis.closedCount === 0
              ? '—'
              : formatMoney(closedPoKpis.averageRevenuePerClosedPo)
          }
        />
        <MetricCard
          title={t('globalDash.metric.avgProfitPo')}
          value={
            poKpiLoading || closedPoKpis.closedCount === 0
              ? '—'
              : formatMoney(closedPoKpis.averageProfitPerClosedPo)
          }
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '0.9rem',
          marginBottom: '0.9rem',
        }}
      >
        <ChartCard title={t('globalDash.chart.revenueByCountry')} allowContentOverflow>
          <VerticalBarChart rows={topRevenue} valueFormatter={formatMoney} slantedValueLabels />
        </ChartCard>

        <ChartCard title={t('globalDash.chart.profitByCountry')} allowContentOverflow>
          <VerticalBarChart rows={topProfit} valueFormatter={formatMoney} slantedValueLabels />
        </ChartCard>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '0.9rem',
          marginBottom: '0.9rem',
        }}
      >
        <ChartCard title={t('globalDash.chart.weightCoffee')} allowContentOverflow>
          <VerticalBarChart rows={coffeeKg} valueFormatter={formatKg} slantedValueLabels />
        </ChartCard>

        <ChartCard title={t('globalDash.chart.weightCocoa')} allowContentOverflow>
          <VerticalBarChart rows={cocoaKg} valueFormatter={formatKg} slantedValueLabels />
        </ChartCard>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '0.9rem',
        }}
      >
        <ChartCard title={t('globalDash.chart.sampleCount')} allowContentOverflow>
          <VerticalBarChart rows={sampleByCountry} valueFormatter={sampleFormatter} slantedValueLabels />
        </ChartCard>

        <ChartCard title={t('globalDash.chart.poCreation')} allowContentOverflow>
          <ContinuousLineChart
            rows={openPoTrend}
            ariaLabel={t('globalDash.chart.poCreationAria')}
            valueLabel={t('globalDash.chart.poCreationValue')}
          />
        </ChartCard>
      </div>
    </div>
  );
}
