/**
 * Findings page: stats, chart, table, supplier filter.
 * "New finding" and opening a finding navigate to Findings Record page (no sidebar tab for Record).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { downloadTableXlsx, type ExportRow } from '../utils/exportExcel';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface Finding {
  id: string;
  code: string;
  supplierId: string;
  supplier: Supplier;
  audit: { id: string; code: string; auditDate: string } | null;
  shipment: { id: string; code: string | null; purchaseOrder: string | null } | null;
  status: string;
  severity: string;
  summary: string;
  discrepancy: string;
  defectCode: string | null;
  createdAt: string;
  updatedAt: string;
  correctiveActions?: { id: string; code: string; status: string }[];
}

function formatFindingCreatedAt(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

interface FindingsResponse {
  list: Finding[];
  stats?: {
    totalAll?: number;
    openAll?: number;
    criticalMajor?: number;
    totalCriticalMajor?: number;
    openCriticalMajor?: number;
  };
  defectCodeCounts: { code: string; count: number }[];
}

export function Findings() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierFilter = searchParams.get('supplierId') ?? '';
  const [data, setData] = useState<FindingsResponse | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const roleNames = user?.roleNames ?? [];
  const canCreateFinding = roleNames.some((r) => ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor'].includes(r));
  /** Admin, QE, Buyer can create CARs (matches server POST /cars). */
  const canCreateCar = roleNames.some((r) => ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer'].includes(r));
  const isAdmin = roleNames.includes('Admin');

  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [summaryModal, setSummaryModal] = useState<{ code: string; summary: string } | null>(null);
  const [sortBy, setSortBy] = useState<
    'code' | 'supplier' | 'createdAt' | 'audit' | 'severity' | 'status' | 'summary' | 'defectCode'
  >('code');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const list = data?.list ?? [];
  const statsFromApi = data?.stats;
  const stats = {
    totalAll:
      statsFromApi?.totalAll ??
      list.length,
    openAll:
      statsFromApi?.openAll ??
      list.filter((f) => f.status !== 'Closed').length,
    criticalMajor:
      statsFromApi?.criticalMajor ??
      statsFromApi?.totalCriticalMajor ??
      list.filter((f) => f.severity === 'Critical' || f.severity === 'Major').length,
    openCriticalMajor:
      statsFromApi?.openCriticalMajor ??
      list.filter(
        (f) => (f.severity === 'Critical' || f.severity === 'Major') && f.status !== 'Closed'
      ).length,
  };
  const defectCodeCounts = data?.defectCodeCounts ?? [];
  const topDefectCodes = defectCodeCounts.slice(0, 10);
  const maxDefectCount = Math.max(1, ...defectCodeCounts.map((d) => d.count));
  const [activeDefectCode, setActiveDefectCode] = useState<string | null>(null);
  const auditFindingsCount = list.filter((f) => !!f.audit).length;
  const shipmentFindingsCount = list.filter((f) => !f.audit && !!f.shipment).length;
  const noneFindingsCount = Math.max(0, list.length - auditFindingsCount - shipmentFindingsCount);
  const sourceDonut = useMemo(() => {
    const slices = [
      { key: 'audit', count: auditFindingsCount, color: '#2563eb' },
      { key: 'shipment', count: shipmentFindingsCount, color: '#8b5cf6' },
      { key: 'none', count: noneFindingsCount, color: '#6b7280' },
    ];
    const total = slices.reduce((sum, s) => sum + s.count, 0);
    const nonZero = slices.filter((s) => s.count > 0);
    const size = 160;
    const cx = 80;
    const cy = 80;
    const radius = 52;
    const strokeWidth = 30;
    const separatorWidth = nonZero.length > 1 ? 2 : 0;
    const innerRadius = radius - strokeWidth / 2;
    const outerRadius = radius + strokeWidth / 2;
    const toPoint = (angleDeg: number, r = radius) => {
      const rad = ((angleDeg - 90) * Math.PI) / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };
    if (total === 0) {
      return { size, strokeWidth, cx, cy, radius, separatorWidth, segments: [] as Array<{ d: string; color: string }>, separators: [] as Array<{ x1: number; y1: number; x2: number; y2: number }> };
    }
    if (nonZero.length === 1) {
      return { size, strokeWidth, cx, cy, radius, separatorWidth, segments: [{ d: '', color: nonZero[0].color }], separators: [] as Array<{ x1: number; y1: number; x2: number; y2: number }> };
    }
    let cursor = 0;
    const segments = nonZero.map((slice) => {
      const arcDeg = (slice.count / total) * 360;
      const start = cursor;
      const end = cursor + arcDeg;
      cursor += arcDeg;
      const p0 = toPoint(start);
      const p1 = toPoint(end);
      const largeArcFlag = arcDeg > 180 ? 1 : 0;
      return { d: `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${p1.x} ${p1.y}`, color: slice.color };
    });
    const separatorAngles = nonZero
      .slice(0, -1)
      .reduce<number[]>((angles, slice, idx) => {
        const prev = idx === 0 ? 0 : angles[idx - 1];
        angles.push(prev + (slice.count / total) * 360);
        return angles;
      }, []);
    separatorAngles.unshift(0);
    const separators = separatorAngles.map((angle) => {
      const inner = toPoint(angle, innerRadius);
      const outer = toPoint(angle, outerRadius);
      return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
    });
    return { size, strokeWidth, cx, cy, radius, separatorWidth, segments, separators };
  }, [auditFindingsCount, shipmentFindingsCount]);

  const fetchData = () => {
    if (!token) return;
    const q = supplierFilter ? `?supplierId=${encodeURIComponent(supplierFilter)}` : '';
    Promise.all([
      apiJson<FindingsResponse>(`/findings${q}`, { token }),
      apiJson<Supplier[]>('/suppliers', { token }),
    ])
      .then(([d, s]) => {
        setData(d);
        setSuppliers(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    const isRefreshingList = refreshKey > 0;
    if (!isRefreshingList) setLoading(true);
    fetchData();
  }, [token, supplierFilter, refreshKey]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(list.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [list.length, pageSize, page]);

  const severityRank: Record<string, number> = { Critical: 3, Major: 2, Minor: 1 };
  const statusRank: Record<string, number> = { New: 1, DRAFT: 2, WaitingDisposition: 3, WaitingApproval: 4, Closed: 5 };
  const sortedList = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const getValue = (f: Finding): string | number => {
      switch (sortBy) {
        case 'code': return f.code;
        case 'supplier': return `${f.supplier.code} ${f.supplier.name}`;
        case 'createdAt':
          return f.createdAt ? new Date(f.createdAt).getTime() : 0;
        case 'audit': return f.audit?.code ?? '';
        case 'severity': return severityRank[f.severity] ?? 0;
        case 'status': return statusRank[f.status] ?? 999;
        case 'summary': return f.summary;
        case 'defectCode': return f.defectCode ?? '';
      }
    };
    return [...list].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [list, sortBy, sortDir]);
  const onSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('asc');
    }
    setPage(1);
  };
  const sortIndicator = (key: typeof sortBy) => (sortBy !== key ? '▲▼' : sortDir === 'asc' ? '↑' : '↓');

  const totalCount = sortedList.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageSafe = Math.min(page, totalPages) || 1;
  const paginatedList = sortedList.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const handleExportFindingsTable = () => {
    try {
      const rows: ExportRow[] = sortedList.map((f) => ({
        Code: f.code,
        Supplier: `${f.supplier.code}: ${f.supplier.name}`,
        Audit: f.audit?.code ?? 'None',
        Shipment: f.shipment?.code?.trim() || f.shipment?.id || '—',
        Severity: f.severity,
        Status: f.status,
        Summary: f.summary,
        'Defect Code': f.defectCode?.trim() ? f.defectCode : '—',
        CARs: (f.correctiveActions ?? []).map((c) => `${c.code} (${c.status})`).join(', ') || '—',
        'Date Created': formatFindingCreatedAt(f.createdAt),
      }));
      if (rows.length === 0) return;
      const supplierSuffix =
        suppliers.find((s) => s.id === supplierFilter)?.code?.replace(/[^A-Za-z0-9_-]/g, '_') ?? 'All';
      downloadTableXlsx(`Findings_${supplierSuffix}`, 'Findings', rows);
      toast.success('Exported to Excel');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  };

  const handleDelete = async (findingId: string) => {
    if (!token || !isAdmin) return;
    setDeleteConfirmId(null);
    setDeletingId(findingId);
    try {
      await apiJson(`/findings/${findingId}`, { token, method: 'DELETE' });
      setRefreshKey((k) => k + 1);
      toast.warning('Finding deleted');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  /** Maps API status to a slug for status-badge CSS (readable, color-coded). */
  const getStatusBadgeSlug = (status: string) => {
    const s = status.replace(/\s+/g, '-').toLowerCase();
    if (s === 'new' || s === 'draft') return 'new';
    if (s === 'waitingdisposition') return 'waiting-disposition';
    if (s === 'waitingapproval') return 'waiting-approval';
    if (s === 'closed') return 'closed';
    return s || 'unknown';
  };

  if (loading && data === null) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Findings</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading findings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Findings</h1>
      </header>

      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        {canCreateFinding && (
          <Link to="/findings-record" className="btn btn-primary">
            FINDING RECORDS
          </Link>
        )}
        <label>
          <span style={{ marginRight: 8, fontSize: 'var(--text-sm)' }}>Supplier filter:</span>
          <select
            className="input"
            value={supplierFilter}
            onChange={(e) => {
              const v = e.target.value;
              if (v) setSearchParams({ supplierId: v });
              else setSearchParams({});
            }}
            style={{ width: 'auto', minWidth: 180 }}
          >
            <option value="">All</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.code}: {s.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 260px))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Total Findings</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stats.totalAll}</div>
          <div style={{ marginTop: 6, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', lineHeight: 1.4 }}>
            {stats.criticalMajor} Critical/Major
          </div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Open Findings</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stats.openAll}</div>
          <div style={{ marginTop: 6, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', lineHeight: 1.4 }}>
            {stats.openCriticalMajor} Critical/Major
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 30%) minmax(0, 70%)',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: 'var(--text-lg)' }}>Audit vs Shipment Findings</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <svg
                aria-label="Audit versus shipment findings donut chart"
                width={sourceDonut.size}
                height={sourceDonut.size}
                viewBox={`0 0 ${sourceDonut.size} ${sourceDonut.size}`}
                style={{ flex: '0 0 auto', display: 'block' }}
              >
                {sourceDonut.segments.length === 0 ? (
                  <circle cx={sourceDonut.cx} cy={sourceDonut.cy} r={sourceDonut.radius} fill="none" stroke="#e5e7eb" strokeWidth={sourceDonut.strokeWidth} />
                ) : sourceDonut.segments.length === 1 ? (
                  <circle cx={sourceDonut.cx} cy={sourceDonut.cy} r={sourceDonut.radius} fill="none" stroke={sourceDonut.segments[0].color} strokeWidth={sourceDonut.strokeWidth} />
                ) : (
                  sourceDonut.segments.map((segment) => (
                    <path key={`${segment.color}-${segment.d}`} d={segment.d} fill="none" stroke={segment.color} strokeWidth={sourceDonut.strokeWidth} strokeLinecap="butt" />
                  ))
                )}
                {sourceDonut.separators.map((separator, idx) => (
                  <line
                    key={`source-sep-${idx}`}
                    x1={separator.x1}
                    y1={separator.y1}
                    x2={separator.x2}
                    y2={separator.y2}
                    stroke="var(--color-surface)"
                    strokeWidth={sourceDonut.separatorWidth}
                    strokeLinecap="butt"
                  />
                ))}
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 180 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', fontSize: 'var(--text-sm)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
                    Audit Findings
                  </span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{auditFindingsCount}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', fontSize: 'var(--text-sm)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }} />
                    Shipment Findings
                  </span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{shipmentFindingsCount}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', fontSize: 'var(--text-sm)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#6b7280', display: 'inline-block' }} />
                    None
                  </span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{noneFindingsCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: 'var(--text-lg)' }}>Top Defect Codes</h2>
            <div
              style={{
                marginBottom: '0.5rem',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-muted)',
                minHeight: '1.1rem',
              }}
            >
              {activeDefectCode ? `Selected code: ${activeDefectCode}` : 'Hover or click a code label to read the full value.'}
            </div>
            {topDefectCodes.length === 0 ? (
              <p className="table-empty">No defect-code data.</p>
            ) : (
              <div
                aria-label="Top defect codes bar chart"
                style={{
                  minHeight: 210,
                  borderLeft: '1px solid var(--color-border)',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'grid',
                  gridTemplateColumns: `repeat(${topDefectCodes.length}, minmax(0, 1fr))`,
                  alignItems: 'flex-end',
                  gap: '0.75rem',
                  padding: '0.5rem 0.5rem 0 0.5rem',
                  background:
                    'linear-gradient(to top, transparent 24%, rgba(148,163,184,0.12) 25%, transparent 26%, transparent 49%, rgba(148,163,184,0.12) 50%, transparent 51%, transparent 74%, rgba(148,163,184,0.12) 75%, transparent 76%)',
                }}
              >
                {topDefectCodes.map(({ code, count }) => (
                  <div key={code} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1 }}>{count}</span>
                    <div
                      style={{
                        width: '100%',
                        height: `${Math.max(8, (count / maxDefectCount) * 140)}px`,
                        background: '#4f46e5',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.2s ease',
                      }}
                      title={`${code}: ${count}`}
                      onClick={() => setActiveDefectCode(code)}
                    />
                    <button
                      type="button"
                      onClick={() => setActiveDefectCode(code)}
                      title={code}
                      aria-label={`Defect code ${code}`}
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        textDecoration: activeDefectCode === code ? 'underline' : 'none',
                      }}
                    >
                      {code}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '1rem',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Findings Table</h2>
          <button type="button" className="btn btn-ghost" onClick={handleExportFindingsTable} disabled={sortedList.length === 0}>
            Export to Excel
          </button>
        </div>
        <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ cursor: 'pointer' }} onClick={() => onSort('code')}>Code {sortIndicator('code')}</th>
                      <th style={{ cursor: 'pointer' }} onClick={() => onSort('supplier')}>Supplier {sortIndicator('supplier')}</th>
                      <th style={{ cursor: 'pointer' }} onClick={() => onSort('audit')}>Audit {sortIndicator('audit')}</th>
                      <th>Shipment</th>
                      <th style={{ cursor: 'pointer' }} onClick={() => onSort('severity')}>Severity {sortIndicator('severity')}</th>
                      <th style={{ cursor: 'pointer' }} onClick={() => onSort('status')}>Status {sortIndicator('status')}</th>
                      <th style={{ cursor: 'pointer' }} onClick={() => onSort('summary')}>Summary {sortIndicator('summary')}</th>
                      <th style={{ cursor: 'pointer' }} onClick={() => onSort('defectCode')}>Defect Code {sortIndicator('defectCode')}</th>
                      <th>CAR</th>
                      <th style={{ cursor: 'pointer' }} onClick={() => onSort('createdAt')}>Date created {sortIndicator('createdAt')}</th>
                      {isAdmin && <th>Delete</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {list.length === 0 ? (
                      <tr>
                        <td colSpan={10 + (isAdmin ? 1 : 0)} className="table-empty">
                          No findings in scope (or none past New yet).
                        </td>
                      </tr>
                    ) : (
                      paginatedList.map((f) => (
                        <tr key={f.id} className={`finding-row finding-row--${getStatusBadgeSlug(f.status)}`}>
                          <td>
                            <Link
                              to={`/findings-record?id=${encodeURIComponent(f.id)}`}
                              className="finding-code-link"
                            >
                              {f.code}
                            </Link>
                          </td>
                          <td>{f.supplier.code}: {f.supplier.name}</td>
                          <td>{f.audit?.code ?? '—'}</td>
                          <td>
                            {f.shipment ? (
                              <Link
                                to={`/shipments?supplierId=${encodeURIComponent(f.supplierId)}`}
                                className="finding-code-link"
                                title={`Shipment ${f.shipment.code?.trim() || f.shipment.id}`}
                              >
                                {f.shipment.code?.trim() || f.shipment.id}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>{f.severity}</td>
                          <td>
                            <span className={`findings-status-badge findings-status-badge--${getStatusBadgeSlug(f.status)}`}>
                              {f.status}
                            </span>
                          </td>
                          <td style={{ maxWidth: 300, whiteSpace: 'normal', verticalAlign: 'top' }}>
                            {f.summary.length > 120 ? (
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => setSummaryModal({ code: f.code, summary: f.summary })}
                                style={{
                                  padding: 0,
                                  textAlign: 'left',
                                  lineHeight: 1.35,
                                  color: 'inherit',
                                  width: '100%',
                                  overflow: 'hidden',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                }}
                                title="Click to view full summary"
                              >
                                {f.summary}
                              </button>
                            ) : (
                              <div style={{ lineHeight: 1.35 }}>{f.summary}</div>
                            )}
                          </td>
                          <td>{f.defectCode?.trim() ? f.defectCode : '—'}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                              {(f.correctiveActions ?? []).length === 0 ? (
                                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>—</span>
                              ) : (
                                (f.correctiveActions ?? []).map((c) => (
                                  <Link
                                    key={c.id}
                                    to={`/car-record?id=${encodeURIComponent(c.id)}`}
                                    className="finding-code-link"
                                    style={{ fontSize: 'var(--text-sm)' }}
                                  >
                                    {c.code}
                                    <span style={{ color: 'var(--color-text-muted)', marginLeft: 4 }}>({c.status})</span>
                                  </Link>
                                ))
                              )}
                              {canCreateCar && (
                                <Link
                                  to={`/car-record?findingId=${encodeURIComponent(f.id)}`}
                                  className="btn btn-ghost"
                                  style={{ fontSize: 'var(--text-sm)', padding: '0.2rem 0.5rem' }}
                                >
                                  + New CAR
                                </Link>
                              )}
                            </div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 'var(--text-sm)' }} title={f.createdAt}>
                            {formatFindingCreatedAt(f.createdAt)}
                          </td>
                          {isAdmin && (
                            <td>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}
                                onClick={() => setDeleteConfirmId(f.id)}
                                disabled={deletingId !== null}
                                title="Delete finding (Admin only)"
                              >
                                {deletingId === f.id ? 'Deleting…' : 'Delete'}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
        </div>
        {list.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', padding: '1rem', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, totalCount)} of {totalCount}
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)' }}>
              Rows per page:
              <select
                className="input"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{ width: 'auto' }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={pageSafe <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span style={{ alignSelf: 'center', fontSize: 'var(--text-sm)' }}>
                Page {pageSafe} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={pageSafe >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete finding"
        message="Delete this finding? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />

      {summaryModal && (
        <div
          className="confirm-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="finding-summary-title"
          onClick={() => setSummaryModal(null)}
        >
          <div className="confirm-dialog confirm-dialog--wide" onClick={(e) => e.stopPropagation()}>
            <h3 id="finding-summary-title" className="confirm-dialog-title">
              Finding Summary - {summaryModal.code}
            </h3>
            <p style={{ marginBottom: '1rem', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{summaryModal.summary}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={() => setSummaryModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
