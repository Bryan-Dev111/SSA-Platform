/**
 * Global Vendors — Approved Farms List (same data as Farm Information; columns per spec where fields exist).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiJson } from '../../api/client';
import { SortableTh } from '../../components/SortableTh';
import { type SortDir, cmpNum, cmpStr, toggleSort } from '../../utils/tableSort';
import type { FarmRow } from './FarmersInformationPage';

function dash(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—';
  return String(v);
}

type ApprovedSortKey =
  | 'code'
  | 'country'
  | 'region'
  | 'elevation'
  | 'crops'
  | 'productionStyle'
  | 'farmCategory';

export function ApprovedFarmersPage() {
  const { token } = useAuth();
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: ApprovedSortKey | null; dir: SortDir }>({
    key: null,
    dir: 'asc',
  });

  useEffect(() => {
    if (!token) return;
    apiJson<FarmRow[]>('/farms', { token })
      .then(setFarms)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load farms'))
      .finally(() => setLoading(false));
  }, [token]);

  const sortedFarms = useMemo(() => {
    const rows = [...farms];
    const k = sort.key;
    if (!k) return rows;
    const dir = sort.dir;
    rows.sort((a, b) => {
      let c = 0;
      switch (k) {
        case 'code':
          c = cmpStr(a.code ?? '', b.code ?? '', dir);
          break;
        case 'country':
          c = cmpStr(a.country ?? '', b.country ?? '', dir);
          break;
        case 'region':
          c = cmpStr(a.region ?? '', b.region ?? '', dir);
          break;
        case 'elevation':
          c = cmpNum(a.elevationMeters ?? Number.NEGATIVE_INFINITY, b.elevationMeters ?? Number.NEGATIVE_INFINITY, dir);
          break;
        case 'crops': {
          const aCrop = [a.mainCrop?.trim(), a.secondaryCrop?.trim()].filter(Boolean).join(', ');
          const bCrop = [b.mainCrop?.trim(), b.secondaryCrop?.trim()].filter(Boolean).join(', ');
          c = cmpStr(aCrop, bCrop, dir);
          break;
        }
        case 'productionStyle':
          c = cmpStr(a.productionStyle ?? '', b.productionStyle ?? '', dir);
          break;
        case 'farmCategory':
          c = cmpStr(a.farmCategory ?? '', b.farmCategory ?? '', dir);
          break;
        default:
          break;
      }
      if (c !== 0) return c;
      return cmpStr(a.code, b.code, 'asc');
    });
    return rows;
  }, [farms, sort]);

  const onSortColumn = (columnKey: string) => {
    setSort((prev) => toggleSort(prev, columnKey as ApprovedSortKey));
  };

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Approved Farms List</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Approved Farms List</h1>
        </header>
        <div className="alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Approved Farms List</h1>
      </header>
      <div className="card">
        <div className="table-wrap">
          <table className="table table--prevent-shrink">
            <thead>
              <tr>
                <SortableTh
                  label="Farm ID"
                  columnKey="code"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Country"
                  columnKey="country"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Region"
                  columnKey="region"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Elevation"
                  columnKey="elevation"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Crops"
                  columnKey="crops"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Production Style"
                  columnKey="productionStyle"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Farm Category"
                  columnKey="farmCategory"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
              </tr>
            </thead>
            <tbody>
              {farms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No farms yet. Add farms from <strong>Farm Information</strong>.
                  </td>
                </tr>
              ) : (
                sortedFarms.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link
                        to={`/global-vendors/farm-profile?farmId=${encodeURIComponent(f.id)}`}
                        className="finding-code-link"
                        title="Open farm profile"
                      >
                        <strong>{f.code}</strong>
                      </Link>
                    </td>
                    <td>{f.country}</td>
                    <td>{dash(f.region)}</td>
                    <td>{f.elevationMeters != null ? f.elevationMeters : '—'}</td>
                    <td>
                      {f.mainCrop?.trim()
                        ? [f.mainCrop.trim(), f.secondaryCrop?.trim()].filter(Boolean).join(', ')
                        : '—'}
                    </td>
                    <td>{dash(f.productionStyle)}</td>
                    <td>{dash(f.farmCategory)}</td>
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
