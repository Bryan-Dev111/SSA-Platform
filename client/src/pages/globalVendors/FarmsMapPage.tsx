import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, CircleMarker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../context/AuthContext';
import { apiJson } from '../../api/client';

type FarmMapPoint = {
  id: string;
  code: string;
  farmName: string;
  latitude: number;
  longitude: number;
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    apiJson<FarmMapPoint[]>('/farms/map', { token })
      .then((rows) => {
        const cleaned = rows.filter(
          (f) =>
            typeof f.latitude === 'number' &&
            Number.isFinite(f.latitude) &&
            typeof f.longitude === 'number' &&
            Number.isFinite(f.longitude)
        );
        setFarms(cleaned);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load farms map')
      )
      .finally(() => setLoading(false));
  }, [token]);

  const points: [number, number][] = useMemo(
    () => farms.map((f) => [f.latitude, f.longitude]),
    [farms]
  );

  const mapCenter: [number, number] =
    farms.length > 0
      ? [
          farms.reduce((sum, f) => sum + f.latitude, 0) / farms.length,
          farms.reduce((sum, f) => sum + f.longitude, 0) / farms.length,
        ]
      : [20, 0];

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
            {farms.length === 0 ? (
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
                No farms with latitude/longitude yet. Add coordinates on the farmer
                records to see pins on this map.
              </div>
            ) : (
              <MapContainer
                center={mapCenter}
                zoom={farms.length > 0 ? 2 : 1}
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
                {farms.map((f) => (
                  <CircleMarker
                    key={f.id}
                    center={[f.latitude, f.longitude]}
                    pathOptions={{
                      color: '#b91c1c',
                      weight: 2,
                      fillColor: '#ef4444',
                      fillOpacity: 0.95,
                    }}
                    radius={10}
                  >
                    <Tooltip direction="top" opacity={1}>
                      <span>
                        {f.code} · {f.farmName}
                      </span>
                    </Tooltip>
                  </CircleMarker>
                ))}
              </MapContainer>
            )}
          </div>
          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: 0,
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            Pins show farms with explicit GPS coordinates. Color is fixed red to
            match the client&apos;s spec for Global Vendors.
          </p>
        </div>
      </div>
    </div>
  );
}

