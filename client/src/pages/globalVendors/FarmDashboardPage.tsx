/**
 * Global Vendors — Farm Dashboard: KPI snapshot over the farm register and quick links.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiJson } from '../../api/client';
import { MetricCard } from '../../components/MetricCard';
import type { FarmRow } from './FarmersInformationPage';

function formatHa(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ha`;
}

export function FarmDashboardPage() {
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

  const stats = useMemo(() => {
    const total = farms.length;
    const byCountry = new Map<string, number>();
    let totalHa = 0;
    let geocoded = 0;
    let samplesOk = 0;
    for (const f of farms) {
      const c = (f.country ?? '').trim() || '—';
      byCountry.set(c, (byCountry.get(c) ?? 0) + 1);
      if (f.latitude != null && f.longitude != null) geocoded += 1;
      if (f.samplesOk === true) samplesOk += 1;
      const ha = f.totalFarmSizeHa;
      if (typeof ha === 'number' && Number.isFinite(ha) && ha > 0) totalHa += ha;
    }
    const topCountries = [...byCountry.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const countryCount = byCountry.size;
    return { total, topCountries, countryCount, totalHa, geocoded, samplesOk };
  }, [farms]);

  const quickLinks: { to: string; label: string; hint: string }[] = [
    { to: '/global-vendors/farmers', label: 'Farm Information', hint: 'Full register, add farms, export' },
    { to: '/global-vendors/farm-profile', label: 'Farm profile', hint: 'Photos, processing, narrative' },
    { to: '/global-vendors/map', label: 'Farms map', hint: 'Geocoded locations' },
    { to: '/global-vendors/approved', label: 'Approved farms list', hint: 'Approved view' },
    { to: '/global-vendors/relationship', label: 'Relationship & trust', hint: 'Visits and relationship status' },
    { to: '/global-vendors/dashboard', label: 'Business dashboard', hint: 'PO, revenue, and samples KPIs' },
  ];

  if (loading) {
    return (
      <div className="page page-dashboard">
        <header className="page-header">
          <h1 className="page-title">Farm Dashboard</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading farm dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page page-dashboard">
        <header className="page-header">
          <h1 className="page-title">Farm Dashboard</h1>
        </header>
        <div className="alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="page page-dashboard">
      <header className="page-header">
        <h1 className="page-title">Farm Dashboard</h1>
        <p className="page-description" style={{ marginTop: '0.35rem' }}>
          Snapshot of your farm network: counts, geography, and area. Use the links below for detail pages.
        </p>
      </header>

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
        <MetricCard title="Farms in register" value={stats.total} subtitle="All farm records" />
        <MetricCard
          title="Countries represented"
          value={stats.countryCount}
          subtitle="Distinct country values on farms"
        />
        <MetricCard
          title="Geocoded farms"
          value={stats.geocoded}
          subtitle="Farms with latitude and longitude"
        />
        <MetricCard
          title="Recorded farm area"
          value={formatHa(stats.totalHa)}
          subtitle="Sum of total farm size (ha) where provided"
        />
        <MetricCard
          title="Samples marked OK"
          value={stats.samplesOk}
          subtitle="Farms with samples OK = yes"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '0.9rem',
          marginBottom: '0.9rem',
        }}
      >
        <div className="card dashboard-section-card">
          <div className="card-body">
            <h2 className="dashboard-section-heading" style={{ marginBottom: 12 }}>
              Farms by country
            </h2>
            {stats.topCountries.length === 0 ? (
              <p className="table-empty">No farms yet.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                {stats.topCountries.map(([country, count]) => (
                  <li key={country}>
                    <strong>{country}</strong>
                    <span style={{ color: 'var(--color-text-muted)' }}> — {count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card dashboard-section-card">
          <div className="card-body">
            <h2 className="dashboard-section-heading" style={{ marginBottom: 12 }}>
              Quick links
            </h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
              {quickLinks.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="link" style={{ fontWeight: 600 }}>
                    {item.label}
                  </Link>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {item.hint}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
