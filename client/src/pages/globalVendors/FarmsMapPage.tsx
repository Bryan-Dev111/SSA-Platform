import { useCallback, useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, CircleMarker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../context/AuthContext';
import { apiJson } from '../../api/client';
import { LOGISTICS_SITE_TYPES } from './LogisticsPage';

type FarmMapPoint = {
  id: string;
  code: string;
  farmName: string;
  latitude: number;
  longitude: number;
  farmCategory: string | null;
};

type LogisticsMapPoint = {
  id: string;
  code: string;
  siteType: string;
  company: string;
  latitude: number;
  longitude: number;
};

type DisplayPoint = {
  id: string;
  latitude: number;
  longitude: number;
  legendLabel: string;
  title: string;
  subtitle?: string;
};

function logisticsDisplayCode(code: string): string {
  return code.startsWith('LOG-') ? `BUS-${code.slice(4)}` : code;
}

const FARM_MARKER_COLOR = { stroke: '#b91c1c', fill: '#ef4444' } as const;
const LOGISTICS_COLOR_BY_TYPE: Map<string, { stroke: string; fill: string }> = new Map(
  LOGISTICS_SITE_TYPES.map((t) => [t.value, { stroke: t.bg, fill: t.bg }] as const)
);

const WORLD_BOUNDS = L.latLngBounds([-85, -180], [85, 180]);

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

export function FarmsMapPage() {
  const { token } = useAuth();
  const [farms, setFarms] = useState<FarmMapPoint[]>([]);
  const [logistics, setLogistics] = useState<LogisticsMapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiJson<FarmMapPoint[]>('/farms/map', { token }),
      apiJson<LogisticsMapPoint[]>('/supply-logistics', { token }),
    ])
      .then(([farmRows, logisticsRows]) => {
        const cleanedFarms = farmRows.filter(
          (f) =>
            typeof f.latitude === 'number' &&
            Number.isFinite(f.latitude) &&
            typeof f.longitude === 'number' &&
            Number.isFinite(f.longitude)
        );
        const cleanedLogistics = logisticsRows.filter(
          (l) =>
            typeof l.latitude === 'number' &&
            Number.isFinite(l.latitude) &&
            typeof l.longitude === 'number' &&
            Number.isFinite(l.longitude)
        );
        setFarms(cleanedFarms);
        setLogistics(cleanedLogistics);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load farms map')
      )
      .finally(() => setLoading(false));
  }, [token]);

  const displayPoints = useMemo<DisplayPoint[]>(() => {
    const farmPoints: DisplayPoint[] = farms.map((f) => ({
      id: `farm-${f.id}`,
      latitude: f.latitude,
      longitude: f.longitude,
      legendLabel: 'Farm',
      title: `${f.code} · ${f.farmName}`,
      subtitle: f.farmCategory?.trim() || undefined,
    }));
    const logisticsPoints: DisplayPoint[] = logistics.map((l) => ({
      id: `logistics-${l.id}`,
      latitude: l.latitude,
      longitude: l.longitude,
      legendLabel: l.siteType,
      title: `${logisticsDisplayCode(l.code)} · ${l.company}`,
      subtitle: l.siteType,
    }));
    return [...farmPoints, ...logisticsPoints];
  }, [farms, logistics]);

  const points: [number, number][] = useMemo(
    () => displayPoints.map((p) => [p.latitude, p.longitude]),
    [displayPoints]
  );

  const mapCenter: [number, number] =
    points.length > 0
      ? [
          points.reduce((sum, [lat]) => sum + lat, 0) / points.length,
          points.reduce((sum, [, lon]) => sum + lon, 0) / points.length,
        ]
      : [20, 0];

  const legendItems = useMemo(
    () => [
      { label: 'Farm', ...FARM_MARKER_COLOR },
      ...LOGISTICS_SITE_TYPES.map((t) => ({
        label: t.label,
        stroke: t.bg,
        fill: t.bg,
      })),
    ],
    []
  );

  const colorForLegend = useCallback((legendLabel: string) => {
    if (legendLabel === 'Farm') return FARM_MARKER_COLOR;
    return LOGISTICS_COLOR_BY_TYPE.get(legendLabel) ?? FARM_MARKER_COLOR;
  }, []);

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Farms Map</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading farms map…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Farms Map</h1>
      </header>

      {error && <div className="alert-error">{error}</div>}

      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Map view</h2>
          <div
            className="suppliers-map-frame"
            style={{ border: '1px solid var(--color-border)', borderRadius: 10 }}
          >
            {displayPoints.length === 0 ? (
              <div
                style={{
                  height: 260,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem',
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                No map points with latitude/longitude yet. Add coordinates on farm records or logistics entries to see pins.
              </div>
            ) : (
              <MapContainer
                center={mapCenter}
                zoom={displayPoints.length > 0 ? 2 : 1}
                style={{
                  height: 460,
                  width: '100%',
                  minHeight: 460,
                  borderRadius: 10,
                }}
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
                <MapFitBounds points={points} />
                {displayPoints.map((p) => {
                  const pal = colorForLegend(p.legendLabel);
                  return (
                  <CircleMarker
                    key={p.id}
                    center={[p.latitude, p.longitude]}
                    pathOptions={{
                      color: pal.stroke,
                      weight: 2,
                      fillColor: pal.fill,
                      fillOpacity: 0.95,
                    }}
                    radius={10}
                  >
                    <Tooltip direction="top" opacity={1}>
                      <span>
                        {p.title}
                        {p.subtitle ? ` · ${p.subtitle}` : ''}
                      </span>
                    </Tooltip>
                  </CircleMarker>
                  );
                })}
              </MapContainer>
            )}
          </div>
          {displayPoints.length > 0 && (
            <div
              role="group"
              aria-label="Map legend"
              style={{
                marginTop: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--color-border)',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                  marginBottom: '0.65rem',
                }}
              >
                Legend
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.65rem 1.25rem',
                  alignItems: 'center',
                }}
              >
                {legendItems.map((item) => {
                  return (
                    <div
                      key={item.label}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          border: `2px solid ${item.stroke}`,
                          background: item.fill,
                          flexShrink: 0,
                          boxSizing: 'border-box',
                        }}
                      />
                      <span style={{ fontSize: 'var(--text-sm)' }}>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

