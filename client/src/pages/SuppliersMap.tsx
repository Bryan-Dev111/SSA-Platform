import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { apiJson } from '../api/client';

interface SupplierRow {
  id: string;
  code: string;
  name: string;
  city: string | null;
  country: string | null;
}

interface RiskCurrentRow {
  supplier: { id: string };
  level: 'Low' | 'Medium' | 'High';
  score: number;
}

type RiskColor = 'red' | 'orange' | 'yellow' | 'green' | 'gray';
type GeoPoint = { lat: number; lon: number };

export function SuppliersMap() {
  const { token } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [riskBySupplierId, setRiskBySupplierId] = useState<Record<string, { level: string; score: number }>>({});
  const [geoBySupplierId, setGeoBySupplierId] = useState<Record<string, GeoPoint>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiJson<SupplierRow[]>('/suppliers', { token }),
      apiJson<RiskCurrentRow[]>('/risk-snapshots/current', { token }),
    ])
      .then(([suppliersRows, riskRows]) => {
        setSuppliers(suppliersRows);
        const nextRiskMap: Record<string, { level: string; score: number }> = {};
        for (const row of riskRows) {
          nextRiskMap[row.supplier.id] = { level: row.level, score: row.score };
        }
        setRiskBySupplierId(nextRiskMap);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load suppliers map'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const withLocationText = suppliers
      .filter((s) => Boolean(s.city || s.country))
      .map((s) => ({ id: s.id, q: [s.city, s.country].filter(Boolean).join(', ') }));
    if (withLocationText.length === 0) return;

    let active = true;
    (async () => {
      const next: Record<string, GeoPoint> = {};
      for (const row of withLocationText) {
        // eslint-disable-next-line no-await-in-loop
        const point = await geocodeLocation(row.q);
        if (point) next[row.id] = point;
      }
      if (active) setGeoBySupplierId(next);
    })();
    return () => {
      active = false;
    };
  }, [suppliers]);

  const mapPins = useMemo(() => {
    return suppliers.map((s) => {
      const risk = riskBySupplierId[s.id];
      const color = getRiskColor(risk?.level, risk?.score);
      const geo = geoBySupplierId[s.id];
      return { ...s, risk, color, geo };
    });
  }, [suppliers, riskBySupplierId, geoBySupplierId]);

  const colorCounts = useMemo(() => {
    return {
      red: mapPins.filter((p) => p.color === 'red').length,
      orange: mapPins.filter((p) => p.color === 'orange').length,
      yellow: mapPins.filter((p) => p.color === 'yellow').length,
      green: mapPins.filter((p) => p.color === 'green').length,
      gray: mapPins.filter((p) => p.color === 'gray').length,
    };
  }, [mapPins]);

  const markerPins = mapPins.filter((p) => Boolean(p.geo));
  const mapCenter: [number, number] =
    markerPins.length > 0
      ? [
          markerPins.reduce((sum, p) => sum + (p.geo?.lat ?? 0), 0) / markerPins.length,
          markerPins.reduce((sum, p) => sum + (p.geo?.lon ?? 0), 0) / markerPins.length,
        ]
      : [20, 0];

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Suppliers Map</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading suppliers map…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Suppliers Map</h1>
        <p className="page-description">
          Supplier locations with risk-colored pins for quick risk visibility in your access scope.
        </p>
      </header>

      {error && <div className="alert-error">{error}</div>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <Metric title="High (Red)" value={colorCounts.red} color="#ef4444" />
        <Metric title="Medium-High (Orange)" value={colorCounts.orange} color="#f97316" />
        <Metric title="Medium (Yellow)" value={colorCounts.yellow} color="#eab308" />
        <Metric title="Low (Green)" value={colorCounts.green} color="#22c55e" />
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Map view</h2>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
            <MapContainer center={mapCenter} zoom={markerPins.length > 0 ? 2 : 1} style={{ height: 460, width: '100%' }} scrollWheelZoom>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {markerPins.map((pin) => (
                <CircleMarker
                  key={pin.id}
                  center={[pin.geo!.lat, pin.geo!.lon]}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: riskColorHex(pin.color),
                    fillOpacity: 0.95,
                  }}
                  radius={8}
                >
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <strong>{pin.code} — {pin.name}</strong>
                      <div>{pin.city ?? 'N/A'}{pin.city && pin.country ? ', ' : ''}{pin.country ?? ''}</div>
                      <div>Risk: {pin.risk ? `${pin.risk.level} (${pin.risk.score})` : 'N/A'}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          <p style={{ marginTop: '0.75rem', marginBottom: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Real map tiles with supplier markers. Pins are color-coded by supplier risk: red/orange/yellow/green.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>City</th>
                <th>Country</th>
                <th>Risk level</th>
                <th>Risk score</th>
              </tr>
            </thead>
            <tbody>
              {mapPins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">No suppliers in scope.</td>
                </tr>
              ) : (
                mapPins.map((s) => (
                  <tr key={s.id}>
                    <td>{s.code} — {s.name}</td>
                    <td>{s.city ?? '—'}</td>
                    <td>{s.country ?? '—'}</td>
                    <td>{s.risk?.level ?? 'N/A'}</td>
                    <td>{s.risk?.score ?? 'N/A'}</td>
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

function Metric({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div className="card">
      <div className="card-body" style={{ padding: '0.9rem' }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{title}</div>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color }}>{value}</div>
      </div>
    </div>
  );
}

function getRiskColor(level?: string, score?: number): RiskColor {
  if (level === 'High') return typeof score === 'number' && score < 85 ? 'orange' : 'red';
  if (level === 'Medium') return 'yellow';
  if (level === 'Low') return 'green';
  return 'gray';
}

function riskColorHex(color: RiskColor): string {
  if (color === 'red') return '#ef4444';
  if (color === 'orange') return '#f97316';
  if (color === 'yellow') return '#eab308';
  if (color === 'green') return '#22c55e';
  return '#94a3b8';
}

async function geocodeLocation(query: string): Promise<GeoPoint | null> {
  if (!query.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!rows.length) return null;
    const lat = Number(rows[0].lat);
    const lon = Number(rows[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}
