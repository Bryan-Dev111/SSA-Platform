import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiJson } from '../api/client';

interface SupplierRow {
  id: string;
  code: string;
  name: string;
  city: string | null;
  country: string | null;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface RiskCurrentRow {
  supplier: { id: string };
  level: 'Low' | 'Medium' | 'High';
  score: number;
}

type RiskColor = 'red' | 'yellow' | 'green' | 'gray';
type GeoPoint = { lat: number; lon: number };

function supplierStatusLabel(status: string | undefined): string {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'inactive') return 'Inactive';
  return 'Active';
}

/**
 * Suppliers Map — pan limits: maxBounds + worldCopyJump off, TileLayer bounds (no noWrap: avoids OSM 400 on invalid x).
 * Map fills the card: full width × fixed height inside .suppliers-map-frame.
 */
const WORLD_BOUNDS = L.latLngBounds([-85, -180], [85, 180]);

export function SuppliersMap() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [riskBySupplierId, setRiskBySupplierId] = useState<Record<string, { level: string; score: number }>>({});
  const [geoBySupplierId, setGeoBySupplierId] = useState<Record<string, GeoPoint>>({});
  const [geoLoading, setGeoLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiJson<SupplierRow[]>('/suppliers', { token }),
      apiJson<RiskCurrentRow[]>('/risk-snapshots/map-current', { token }),
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
    if (!token) return;

    const next: Record<string, GeoPoint> = {};
    const toGeocode = suppliers
      .filter((s) => {
        const hasCoords =
          typeof s.latitude === 'number' &&
          Number.isFinite(s.latitude) &&
          typeof s.longitude === 'number' &&
          Number.isFinite(s.longitude);
        if (hasCoords) {
          next[s.id] = { lat: s.latitude as number, lon: s.longitude as number };
          return false;
        }
        return Boolean(s.city || s.country);
      })
      .map((s) => ({ id: s.id, q: [s.city, s.country].filter(Boolean).join(', ') }));

    if (toGeocode.length === 0) {
      setGeoBySupplierId(next);
      return;
    }

    let active = true;
    setGeoLoading(true);
    (async () => {
      try {
        const geocoded = await apiJson<Record<string, GeoPoint>>('/geocode/batch', {
          method: 'POST',
          token,
          body: JSON.stringify({ items: toGeocode }),
        });
        if (active) {
          const merged =
            geocoded && typeof geocoded === 'object'
              ? { ...next, ...geocoded }
              : { ...next };
          setGeoBySupplierId(merged);
        }
      } catch {
        if (active) setGeoBySupplierId(next);
      } finally {
        if (active) setGeoLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [suppliers, token]);

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
      yellow: mapPins.filter((p) => p.color === 'yellow').length,
      green: mapPins.filter((p) => p.color === 'green').length,
      gray: mapPins.filter((p) => p.color === 'gray').length,
    };
  }, [mapPins]);

  const markerPins = mapPins.filter((p) => Boolean(p.geo));
  const suppliersWithAddress = suppliers.some((s) => Boolean(s.city || s.country));
  const showGeoHint =
    !geoLoading && suppliersWithAddress && markerPins.length === 0 && suppliers.length > 0;
  const showNoAddressHint =
    !geoLoading && !suppliersWithAddress && suppliers.length > 0;

  const markerPositions = useMemo(
    () => markerPins.map((p) => [p.geo!.lat, p.geo!.lon] as [number, number]),
    [markerPins]
  );

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
          <h1 className="page-title">{t('nav.suppliersMap')}</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{t('nav.suppliersMap')}</h1>
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
        <Metric title={t('mapSuppliers.highRed')} value={colorCounts.red} color="#ef4444" />
        <Metric title={t('mapSuppliers.mediumYellow')} value={colorCounts.yellow} color="#eab308" />
        <Metric title={t('mapSuppliers.lowGreen')} value={colorCounts.green} color="#22c55e" />
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>{t('mapSuppliers.mapView')}</h2>
          <div className="suppliers-map-frame" style={{ border: '1px solid var(--color-border)', borderRadius: 10 }}>
            <MapContainer
              center={mapCenter}
              zoom={markerPins.length > 0 ? 2 : 1}
              style={{ height: 460, width: '100%', minHeight: 460, borderRadius: 10 }}
              scrollWheelZoom
              maxBounds={WORLD_BOUNDS}
              maxBoundsViscosity={1}
              worldCopyJump={false}
              inertia={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                bounds={WORLD_BOUNDS}
              />
              <MapLockSingleWorld />
              <MapFitBounds points={markerPositions} />
              {markerPins.map((pin) => (
                <CircleMarker
                  key={pin.id}
                  center={[pin.geo!.lat, pin.geo!.lon]}
                  pathOptions={{
                    color: '#1e293b',
                    weight: 2,
                    fillColor: riskColorHex(pin.color),
                    fillOpacity: 1,
                  }}
                  radius={11}
                >
                  <Tooltip direction="top" opacity={1} className="suppliers-map-tooltip">
                    <span>
                      {pin.code}
                      {pin.risk ? ` · ${pin.risk.level}` : ''}
                    </span>
                  </Tooltip>
                  <Popup className="suppliers-map-popup" maxWidth={280} minWidth={240} keepInView autoPan>
                    <div className="suppliers-map-callout">
                      <div className="suppliers-map-callout-tab">
                        <span
                          className="suppliers-map-callout-tab-dot"
                          style={{ background: riskColorHex(pin.color) }}
                          aria-hidden
                        />
                        <span>Supplier</span>
                        <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-text)' }}>{pin.code}</span>
                      </div>
                      <div className="suppliers-map-callout-body">
                        <h3 className="suppliers-map-callout-title">{pin.name}</h3>
                        <p className="suppliers-map-callout-row">
                          {pin.city || pin.country
                            ? [pin.city, pin.country].filter(Boolean).join(', ')
                            : 'Location not on file'}
                        </p>
                        <p className="suppliers-map-callout-row">
                          <strong>Status:</strong>{' '}
                          {supplierStatusLabel(pin.status)}
                        </p>
                        <p className="suppliers-map-callout-row">
                          <strong>Risk:</strong>{' '}
                          {pin.risk ? `${pin.risk.level} (score ${pin.risk.score})` : 'N/A'}
                        </p>
                        <Link
                          className="suppliers-map-callout-link"
                          to={`/supplier-profile?supplierId=${encodeURIComponent(pin.id)}`}
                        >
                          Open supplier profile →
                        </Link>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          {geoLoading && (
            <p style={{ marginTop: '0.75rem', marginBottom: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              Placing suppliers on the map…
            </p>
          )}
          {showGeoHint && (
            <p className="alert-error" style={{ marginTop: '0.75rem', fontSize: 'var(--text-sm)' }}>
              No map pins yet: geocoding did not return coordinates. Check city and country values, or try again later.
            </p>
          )}
          {showNoAddressHint && (
            <p style={{ marginTop: '0.75rem', marginBottom: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              Map pins need at least a city or country on each supplier record.
            </p>
          )}
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

function getRiskColor(level?: string, _score?: number): RiskColor {
  if (level === 'High') return 'red';
  if (level === 'Medium') return 'yellow';
  if (level === 'Low') return 'green';
  return 'gray';
}

function riskColorHex(color: RiskColor): string {
  if (color === 'red') return '#ef4444';
  if (color === 'yellow') return '#eab308';
  if (color === 'green') return '#22c55e';
  return '#94a3b8';
}

/** Hard-apply Leaflet options so the map does not jump to wrapped world copies or loosen bounds. */
function MapLockSingleWorld() {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(WORLD_BOUNDS);
    map.options.maxBounds = WORLD_BOUNDS;
    map.options.maxBoundsViscosity = 1;
    map.options.worldCopyJump = false;
    map.options.inertia = false;
  }, [map]);
  return null;
}

function MapFitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const boundsKey = useMemo(
    () => points.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join('|'),
    [points]
  );

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 6));
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [52, 52], maxZoom: 10 });
  }, [map, boundsKey, points]);

  return null;
}
