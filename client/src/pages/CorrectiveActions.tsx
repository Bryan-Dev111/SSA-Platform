/**
 * Corrective Actions page: stats (Open, Overdue, Waiting Approval, AVG Closure Time),
 * table of CARs, supplier filter. Click CAR code → CAR Record.
 * Pagination, Admin-only delete, status-based row colors.
 * CAR age distribution counts only open CARs (excludes Closed), matching stats.open.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TableWithTopScroll } from '../components/TableWithTopScroll';
import { downloadTableXlsx, type ExportRow } from '../utils/exportExcel';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface CAR {
  id: string;
  code: string;
  supplierId: string;
  supplier: Supplier;
  audit: { id: string; code: string; auditDate: string };
  finding: { id: string; code: string } | null;
  status: string;
  severity: string;
  summary: string;
  defectCode?: string | null;
  rootCauseCode?: string | null;
  carOwner: string | null;
  targetCompletionDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CARsResponse {
  list: CAR[];
  stats: { open: number; overdue: number; waitingApproval: number; avgClosureDays: number };
  defectCodeCounts: { code: string; count: number }[];
  rootCauseCodeCounts: { code: string; count: number }[];
  severityCounts: { severity: string; count: number }[];
}

/** Map API / display status to i18n key suffix under correctiveActions.status.* */
function carStatusToI18nKey(status: string): string | null {
  const s = status.trim().toLowerCase();
  if (s === 'waitingapproval' || s === 'waiting approval') return 'WaitingApproval';
  if (s === 'followup' || s === 'follow up') return 'FollowUp';
  if (s === 'rcca') return 'RCCA';
  if (s === 'closed') return 'Closed';
  if (s === 'draft') return 'DRAFT';
  return null;
}

/** English fallback label for unknown CAR statuses (used when no i18n key). */
function formatCarStatusLabel(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === 'waitingapproval' || s === 'waiting approval') return 'Waiting Approval';
  if (s === 'followup' || s === 'follow up') return 'FollowUp';
  if (s === 'rcca') return 'RCCA';
  if (s === 'closed') return 'Closed';
  if (s === 'draft') return 'Draft';
  return status;
}

export function CorrectiveActions() {
  const { token, user } = useAuth();
  const { t, locale } = useLanguage();
  const toast = useToast();
  const trCarStatus = (status: string) => {
    const k = carStatusToI18nKey(status);
    return k ? t(`correctiveActions.status.${k}`) : formatCarStatusLabel(status);
  };
  const trSeverity = (severity: string) => t(`findings.severity.${severity}`, severity);
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierFilter = searchParams.get('supplierId') ?? '';
  const [data, setData] = useState<CARsResponse | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roleNames = user?.roleNames ?? [];
  const canCreateCAR = roleNames.some((r) => ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer'].includes(r));
  const isAdmin = roleNames.includes('Admin');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<
    'code' | 'supplier' | 'audit' | 'finding' | 'severity' | 'status' | 'owner' | 'created' | 'updated'
  >('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [summaryModal, setSummaryModal] = useState<{ code: string; summary: string } | null>(null);

  const list = data?.list ?? [];
  const stats = data?.stats ?? { open: 0, overdue: 0, waitingApproval: 0, avgClosureDays: 0 };
  const defectCodeCounts = useMemo(
    () => [...(data?.defectCodeCounts ?? [])].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    [data?.defectCodeCounts]
  );
  const maxDefectCount = Math.max(1, ...defectCodeCounts.map((d) => d.count));
  const defectTotal = defectCodeCounts.reduce((sum, d) => sum + d.count, 0);
  const defectPareto = defectCodeCounts.map((row, idx) => {
    const cumulative = defectCodeCounts.slice(0, idx + 1).reduce((sum, d) => sum + d.count, 0);
    return { ...row, cumulativePercent: defectTotal > 0 ? Math.round((cumulative / defectTotal) * 100) : 0 };
  });
  const rootCauseCodeCounts = useMemo(
    () => [...(data?.rootCauseCodeCounts ?? [])].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    [data?.rootCauseCodeCounts]
  );
  const maxRootCauseCount = Math.max(1, ...rootCauseCodeCounts.map((d) => d.count));
  const rootCauseTotal = rootCauseCodeCounts.reduce((sum, d) => sum + d.count, 0);
  const rootCausePareto = rootCauseCodeCounts.map((row, idx) => {
    const cumulative = rootCauseCodeCounts.slice(0, idx + 1).reduce((sum, d) => sum + d.count, 0);
    return { ...row, cumulativePercent: rootCauseTotal > 0 ? Math.round((cumulative / rootCauseTotal) * 100) : 0 };
  });
  const severityCounts = data?.severityCounts ?? [
    { severity: 'Critical', count: 0 },
    { severity: 'Major', count: 0 },
    { severity: 'Minor', count: 0 },
  ];
  const maxSeverityCount = Math.max(1, ...severityCounts.map((s) => s.count));
  const statusLabels = ['RCCA', 'WaitingApproval', 'FollowUp'] as const;
  const statusColorMap: Record<(typeof statusLabels)[number], string> = {
    RCCA: '#f59e0b',
    WaitingApproval: '#ef4444',
    FollowUp: '#8b5cf6',
  };
  const statusCounts = statusLabels.map((status) => ({
    status,
    count: list.filter((c) => c.status === status).length,
    color: statusColorMap[status],
  }));
  const statusDonut = useMemo(() => {
    const total = statusCounts.reduce((sum, s) => sum + s.count, 0);
    const nonZero = statusCounts.filter((s) => s.count > 0);
    const size = 140;
    const cx = 70;
    const cy = 70;
    const radius = 46;
    const strokeWidth = 30;
    const separatorWidth = nonZero.length > 1 ? 2 : 0;
    const innerRadius = radius - strokeWidth / 2;
    const outerRadius = radius + strokeWidth / 2;

    if (total === 0) {
      return {
        size,
        strokeWidth,
        cx,
        cy,
        radius,
        separatorWidth,
        segments: [] as Array<{ d: string; color: string }>,
        separators: [] as Array<{ x1: number; y1: number; x2: number; y2: number }>,
      };
    }

    if (nonZero.length === 1) {
      return {
        size,
        strokeWidth,
        cx,
        cy,
        radius,
        separatorWidth,
        segments: [{ d: '', color: nonZero[0].color }],
        separators: [],
      };
    }

    const toPoint = (angleDeg: number, r = radius) => {
      const rad = ((angleDeg - 90) * Math.PI) / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };

    let cursor = 0;
    const segments = nonZero
      .map((slice) => {
        const arcDeg = (slice.count / total) * 360;
        const start = cursor;
        const end = cursor + arcDeg;
        cursor += arcDeg;
        const p0 = toPoint(start);
        const p1 = toPoint(end);
        const largeArcFlag = arcDeg > 180 ? 1 : 0;
        return { d: `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${p1.x} ${p1.y}`, color: slice.color };
      })
      .filter((s) => s.d);

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
  }, [statusCounts]);

  const ageBucketDefs = useMemo(
    () =>
      [
        { label: t('correctiveActions.age0_30'), min: 0, max: 30 },
        { label: t('correctiveActions.age31_60'), min: 31, max: 60 },
        { label: t('correctiveActions.age61_90'), min: 61, max: 90 },
        { label: t('correctiveActions.age90Plus'), min: 91, max: Number.POSITIVE_INFINITY },
      ] as const,
    [t]
  );
  const nowMs = Date.now();
  const openCarsForAge = useMemo(() => list.filter((c) => c.status !== 'Closed'), [list]);
  const ageBuckets = useMemo(
    () =>
      ageBucketDefs.map((bucket) => ({
        label: bucket.label,
        count: openCarsForAge.filter((c) => {
          const createdMs = new Date(c.createdAt).getTime();
          if (Number.isNaN(createdMs)) return false;
          const ageDays = Math.floor((nowMs - createdMs) / (1000 * 60 * 60 * 24));
          return ageDays >= bucket.min && ageDays <= bucket.max;
        }).length,
      })),
    [ageBucketDefs, openCarsForAge, nowMs]
  );
  const maxAgeBucketCount = Math.max(1, ...ageBuckets.map((b) => b.count));

  /** Open CAR count at sample times: created by end of window, not yet closed (Closed uses updatedAt as close proxy). */
  const openCarsTimeSeries = useMemo(() => {
    if (list.length === 0) return [];
    const parse = (s: string) => new Date(s).getTime();
    const now = Date.now();
    const dayMs = 86_400_000;
    const minCreated = Math.min(...list.map((c) => parse(c.createdAt)));
    if (!Number.isFinite(minCreated)) return [];
    const rangeStartMs = Math.max(minCreated, now - 365 * dayMs);
    const totalSpan = Math.max(dayMs, now - rangeStartMs);
    const maxBuckets = 100;
    const stepMs = Math.max(dayMs, Math.ceil(totalSpan / maxBuckets));
    const bucketEnds: number[] = [];
    let bucketEnd = rangeStartMs + stepMs;
    while (bucketEnd < now) {
      bucketEnds.push(bucketEnd);
      bucketEnd += stepMs;
    }
    bucketEnds.push(now);
    return bucketEnds.map((end) => {
      const count = list.filter((c) => {
        const created = parse(c.createdAt);
        if (created > end) return false;
        if (c.status !== 'Closed') return true;
        return parse(c.updatedAt) > end;
      }).length;
      const d = new Date(end);
      return {
        t: end,
        count,
        label: d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    });
  }, [list, locale]);

  const analyticsRow1Cols = Math.max(
    1,
    (defectCodeCounts.length > 0 ? 1 : 0) + (rootCauseCodeCounts.length > 0 ? 1 : 0) + (list.length > 0 ? 1 : 0)
  );

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(list.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [list.length, pageSize, page]);

  const severityRank: Record<string, number> = { Critical: 3, Major: 2, Minor: 1 };
  const statusRank: Record<string, number> = { RCCA: 1, WaitingApproval: 2, FollowUp: 3, Closed: 4, DRAFT: 0 };
  const sortedList = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const getValue = (c: CAR): string | number => {
      switch (sortBy) {
        case 'code': return c.code;
        case 'supplier': return `${c.supplier.code} ${c.supplier.name}`;
        case 'audit': return c.audit.code;
        case 'finding': return c.finding?.code ?? '';
        case 'severity': return severityRank[c.severity] ?? 0;
        case 'status': return statusRank[c.status] ?? 999;
        case 'owner': return c.carOwner ?? '';
        case 'created': return new Date(c.createdAt).getTime();
        case 'updated': return new Date(c.updatedAt).getTime();
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

  const handleExportCarsTable = () => {
    try {
      const rows: ExportRow[] = sortedList.map((c) => ({
        [t('findings.col.code')]: c.code,
        [t('findings.col.supplier')]: `${c.supplier.code}: ${c.supplier.name}`,
        [t('findings.col.audit')]: c.audit.code,
        [t('correctiveActions.col.finding')]: c.finding?.code ?? t('findings.exportColNone'),
        [t('correctiveActions.col.defectCode')]: c.defectCode?.trim() ? c.defectCode : '—',
        [t('correctiveActions.col.rootCauseCode')]: c.rootCauseCode?.trim() ? c.rootCauseCode : '—',
        [t('findings.col.severity')]: trSeverity(c.severity),
        [t('findings.col.status')]: trCarStatus(c.status),
        [t('findings.col.summary')]: c.summary,
        [t('correctiveActions.col.owner')]: c.carOwner?.trim() ? c.carOwner : '—',
        [t('correctiveActions.col.targetCompletion')]: c.targetCompletionDate
          ? new Date(c.targetCompletionDate).toLocaleDateString(locale, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '—',
        [t('correctiveActions.col.created')]: new Date(c.createdAt).toLocaleDateString(locale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        [t('correctiveActions.col.updated')]: new Date(c.updatedAt).toLocaleDateString(locale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      }));
      if (rows.length === 0) return;
      const supplierSuffix =
        suppliers.find((s) => s.id === supplierFilter)?.code?.replace(/[^A-Za-z0-9_-]/g, '_') ?? 'All';
      downloadTableXlsx(`Corrective_Actions_${supplierSuffix}`, t('correctiveActions.exportSheet'), rows);
      toast.success(t('correctiveActions.exportDone'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('correctiveActions.exportFailed'));
    }
  };

  const fetchData = () => {
    if (!token) return;
    const q = supplierFilter ? `?supplierId=${encodeURIComponent(supplierFilter)}` : '';
    Promise.all([
      apiJson<CARsResponse>(`/cars${q}`, { token }),
      apiJson<Supplier[]>('/suppliers', { token }),
    ])
      .then(([d, s]) => {
        setData(d);
        setSuppliers(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('correctiveActions.loadFailed')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchData();
  }, [token, supplierFilter, t]);

  const handleDelete = async (carId: string) => {
    if (!token || !isAdmin) return;
    setDeleteConfirmId(null);
    setDeletingId(carId);
    try {
      await apiJson(`/cars/${carId}`, { token, method: 'DELETE' });
      fetchData();
      toast.success(t('correctiveActions.carDeleted'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('correctiveActions.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && data === null) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">{t('nav.correctiveActions')}</h1>
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
        <h1 className="page-title">{t('nav.correctiveActions')}</h1>
      </header>

      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      <div
        style={{
          marginBottom: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          rowGap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          {canCreateCAR && (
            <Link to="/car-record" className="btn btn-primary">
              {t('correctiveActions.carRecords')}
            </Link>
          )}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 220px', justifyContent: 'flex-end', minWidth: 0 }}>
          <span style={{ fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>{t('filters.filterBySupplier')}</span>
          <select
            className="input"
            value={supplierFilter}
            onChange={(e) => {
              const v = e.target.value;
              if (v) setSearchParams({ supplierId: v });
              else setSearchParams({});
            }}
            style={{ width: 'auto', minWidth: 160, maxWidth: 320, flex: '1 1 auto' }}
          >
            <option value="">{t('filters.all')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.code}: {s.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{t('correctiveActions.totalCars')}</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{list.length}</div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{t('correctiveActions.openCars')}</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stats.open}</div>
          <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', lineHeight: 1.35 }}>
            {t('correctiveActions.openCarsSubtitle', { overdue: stats.overdue, waiting: stats.waitingApproval })}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{t('correctiveActions.avgClosure')}</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{stats.avgClosureDays}</div>
        </div>
      </div>

      {(defectCodeCounts.length > 0 || rootCauseCodeCounts.length > 0 || list.length > 0) && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            marginBottom: '1.25rem',
            width: '100%',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${analyticsRow1Cols}, minmax(0, 1fr))`,
              gap: '0.75rem',
              alignItems: 'stretch',
            }}
          >
          {defectCodeCounts.length > 0 && (
            <div className="card" style={{ minWidth: 0 }}>
              <div className="card-body">
                <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--text-lg)' }}>{t('correctiveActions.defectPareto')}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {defectPareto.map(({ code, count, cumulativePercent }) => (
                    <div key={code}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4, gap: '0.5rem' }}>
                        <span>{code}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{count} ({t('correctiveActions.cumulative', { pct: cumulativePercent })})</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--color-border-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${(count / maxDefectCount) * 100}%`,
                            height: '100%',
                            background: '#4f46e5',
                            borderRadius: 4,
                            minWidth: count > 0 ? 4 : 0,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {rootCauseCodeCounts.length > 0 && (
            <div className="card" style={{ minWidth: 0 }}>
              <div className="card-body">
                <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--text-lg)' }}>{t('correctiveActions.rootCausePareto')}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {rootCausePareto.map(({ code, count, cumulativePercent }) => (
                    <div key={code}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4, gap: '0.5rem' }}>
                        <span>{code}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{count} ({t('correctiveActions.cumulative', { pct: cumulativePercent })})</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--color-border-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${(count / maxRootCauseCount) * 100}%`,
                            height: '100%',
                            background: '#2563eb',
                            borderRadius: 4,
                            minWidth: count > 0 ? 4 : 0,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {list.length > 0 && (
            <div className="card" style={{ minWidth: 0 }}>
              <div className="card-body">
                <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--text-lg)' }}>{t('correctiveActions.carsBySeverity')}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {severityCounts.map(({ severity, count }) => (
                    <div key={severity}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4 }}>
                        <span>{trSeverity(severity)}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{count}</span>
                      </div>
                      <div
                        style={{
                          height: 8,
                          background: 'var(--color-border-subtle)',
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${(count / maxSeverityCount) * 100}%`,
                            height: '100%',
                            background:
                              severity === 'Critical'
                                ? '#dc2626'
                                : severity === 'Major'
                                  ? '#ea580c'
                                  : '#ca8a04',
                            borderRadius: 4,
                            minWidth: count > 0 ? 4 : 0,
                            transition: 'width 0.2s ease',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          </div>
          {list.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '0.75rem',
                alignItems: 'stretch',
              }}
            >
            <div className="card" style={{ minWidth: 0 }}>
              <div className="card-body">
                <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--text-lg)' }}>{t('correctiveActions.carsByStatus')}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <svg
                    aria-label={t('correctiveActions.statusDonutAria')}
                    width={statusDonut.size}
                    height={statusDonut.size}
                    viewBox={`0 0 ${statusDonut.size} ${statusDonut.size}`}
                    style={{ flex: '0 0 auto', display: 'block' }}
                  >
                    {statusDonut.segments.length === 0 ? (
                      <circle
                        cx={statusDonut.cx}
                        cy={statusDonut.cy}
                        r={statusDonut.radius}
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth={statusDonut.strokeWidth}
                      />
                    ) : statusDonut.segments.length === 1 ? (
                      <circle
                        cx={statusDonut.cx}
                        cy={statusDonut.cy}
                        r={statusDonut.radius}
                        fill="none"
                        stroke={statusDonut.segments[0].color}
                        strokeWidth={statusDonut.strokeWidth}
                      />
                    ) : (
                      statusDonut.segments.map((segment) => (
                        <path
                          key={`${segment.color}-${segment.d}`}
                          d={segment.d}
                          fill="none"
                          stroke={segment.color}
                          strokeWidth={statusDonut.strokeWidth}
                          strokeLinecap="butt"
                        />
                      ))
                    )}
                    {statusDonut.separators.map((separator, idx) => (
                      <line
                        key={`sep-${idx}`}
                        x1={separator.x1}
                        y1={separator.y1}
                        x2={separator.x2}
                        y2={separator.y2}
                        stroke="var(--color-surface)"
                        strokeWidth={statusDonut.separatorWidth}
                        strokeLinecap="butt"
                      />
                    ))}
                  </svg>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 160 }}>
                    {statusCounts.map((s) => (
                      <div key={s.status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', fontSize: 'var(--text-sm)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                          {trCarStatus(s.status)}
                        </span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="card" style={{ minWidth: 0 }}>
              <div className="card-body">
                <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--text-lg)' }}>{t('correctiveActions.ageDistribution')}</h2>
                <div
                  aria-label={t('correctiveActions.ageChartAria')}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr',
                    gap: '0.75rem',
                    alignItems: 'stretch',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-muted)',
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                    }}
                  >
                    {t('correctiveActions.ageAxisLabel')}
                  </div>
                  <div>
                    <div
                      style={{
                        height: 180,
                        borderLeft: '1px solid var(--color-border)',
                        borderBottom: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-around',
                        gap: '0.75rem',
                        padding: '0.5rem 0.5rem 0 0.5rem',
                        background:
                          'linear-gradient(to top, transparent 24%, rgba(148,163,184,0.12) 25%, transparent 26%, transparent 49%, rgba(148,163,184,0.12) 50%, transparent 51%, transparent 74%, rgba(148,163,184,0.12) 75%, transparent 76%)',
                      }}
                    >
                      {ageBuckets.map((bucket) => (
                        <div key={bucket.label} style={{ width: '22%', maxWidth: 80, minWidth: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1 }}>
                            {bucket.count}
                          </span>
                          <div
                            style={{
                              width: '100%',
                              height: `${Math.max(8, (bucket.count / maxAgeBucketCount) * 125)}px`,
                              background: '#4f46e5',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.2s ease',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', gap: '0.75rem', padding: '0.35rem 0.5rem 0 0.5rem' }}>
                      {ageBuckets.map((bucket) => (
                        <span key={`${bucket.label}-axis`} style={{ width: '22%', maxWidth: 80, minWidth: 44, textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          {bucket.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}
          {list.length > 0 && (
            <div className="card" style={{ minWidth: 0 }}>
              <div className="card-body">
                <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--text-lg)' }}>{t('correctiveActions.openOverTime')}</h2>
                <OpenCarsOverTimeChart points={openCarsTimeSeries} />
              </div>
            </div>
          )}
        </div>
      )}

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
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>{t('correctiveActions.tableTitle')}</h2>
          <button type="button" className="btn btn-ghost" onClick={handleExportCarsTable} disabled={sortedList.length === 0}>
            {t('correctiveActions.exportExcel')}
          </button>
        </div>
        <TableWithTopScroll ariaLabel={t('correctiveActions.tableAria')}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('code')}>{t('findings.col.code')} {sortIndicator('code')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('supplier')}>{t('findings.col.supplier')} {sortIndicator('supplier')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('audit')}>{t('findings.col.audit')} {sortIndicator('audit')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('finding')}>{t('correctiveActions.col.finding')} {sortIndicator('finding')}</th>
                <th>{t('correctiveActions.col.defectCode')}</th>
                <th>{t('correctiveActions.col.rootCauseCode')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('severity')}>{t('findings.col.severity')} {sortIndicator('severity')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('status')}>{t('findings.col.status')} {sortIndicator('status')}</th>
                <th>{t('findings.col.summary')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('owner')}>{t('correctiveActions.col.owner')} {sortIndicator('owner')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('created')}>{t('correctiveActions.col.created')} {sortIndicator('created')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => onSort('updated')}>{t('correctiveActions.col.updated')} {sortIndicator('updated')}</th>
                {isAdmin && <th>{t('correctiveActions.col.delete')}</th>}
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={12 + (isAdmin ? 1 : 0)} className="table-empty">
                    {t('correctiveActions.empty')}
                  </td>
                </tr>
              ) : (
                paginatedList.map((c) => (
                  <tr key={c.id} className={`car-row car-row--${getCarStatusSlug(c.status)}`}>
                    <td>
                      <Link to={`/car-record?id=${encodeURIComponent(c.id)}`} className="finding-code-link">
                        {c.code}
                      </Link>
                    </td>
                    <td>{c.supplier.code}: {c.supplier.name}</td>
                    <td>
                      <Link
                        to={`/audit-record?id=${encodeURIComponent(c.audit.id)}`}
                        className="finding-code-link"
                      >
                        {c.audit.code}
                      </Link>
                    </td>
                    <td>
                      {c.finding ? (
                        <Link
                          to={`/findings-record?findingId=${encodeURIComponent(c.finding.code)}`}
                          className="finding-code-link"
                          style={{ fontSize: 'var(--text-sm)' }}
                        >
                          {c.finding.code}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{t('correctiveActions.noneFinding')}</span>
                      )}
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>{c.defectCode?.trim() ? c.defectCode : '—'}</td>
                    <td style={{ fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>{c.rootCauseCode?.trim() ? c.rootCauseCode : '—'}</td>
                    <td>{trSeverity(c.severity)}</td>
                    <td>
                      <span
                        className={`finding-status-badge car-table-status-badge car-table-status-badge--${getCarStatusSlug(c.status)}`}
                      >
                        {trCarStatus(c.status)}
                      </span>
                    </td>
                    <td style={{ maxWidth: 300, whiteSpace: 'normal', verticalAlign: 'top' }}>
                      {c.summary.length > 120 ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setSummaryModal({ code: c.code, summary: c.summary })}
                          style={{
                            padding: 0,
                            textAlign: 'left',
                            lineHeight: 1.35,
                            color: 'inherit',
                            width: '100%',
                            overflow: 'hidden',
                            maxHeight: '2.7em',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                          title={t('findings.clickFullSummary')}
                        >
                          {c.summary}
                        </button>
                      ) : (
                        <div style={{ lineHeight: 1.35 }}>{c.summary}</div>
                      )}
                    </td>
                    <td>{c.carOwner?.trim() ? c.carOwner : '—'}</td>
                    <td>
                      {new Date(c.createdAt).toLocaleDateString(locale, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td>
                      {new Date(c.updatedAt).toLocaleDateString(locale, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}
                          onClick={() => setDeleteConfirmId(c.id)}
                          disabled={deletingId !== null}
                          title={t('correctiveActions.deleteRowTitle')}
                        >
                          {deletingId === c.id ? t('correctiveActions.deleting') : t('correctiveActions.col.delete')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWithTopScroll>
        {list.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', padding: '1rem', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              {t('table.paginationRange', {
                start: (pageSafe - 1) * pageSize + 1,
                end: Math.min(pageSafe * pageSize, totalCount),
                total: totalCount,
              })}
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)' }}>
              {t('table.rowsPerPage')}
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
                {t('table.previous')}
              </button>
              <span style={{ alignSelf: 'center', fontSize: 'var(--text-sm)' }}>
                {t('table.pageOf', { page: pageSafe, pages: totalPages })}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={pageSafe >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t('table.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirmId !== null}
        title={t('correctiveActions.deleteTitle')}
        message={t('correctiveActions.deleteMessage')}
        confirmLabel={t('correctiveActions.col.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />

      {summaryModal && (
        <div
          className="confirm-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="car-summary-title"
          onClick={() => setSummaryModal(null)}
        >
          <div className="confirm-dialog confirm-dialog--wide" onClick={(e) => e.stopPropagation()}>
            <h3 id="car-summary-title" className="confirm-dialog-title">
              {t('correctiveActions.summaryModalTitle', { code: summaryModal.code })}
            </h3>
            <p style={{ marginBottom: '1rem', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{summaryModal.summary}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={() => setSummaryModal(null)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type OpenCarTimePoint = { t: number; count: number; label: string };

/** Red line + shaded area under: count of CARs still open at each sample (Closed ≈ last updated). */
function OpenCarsOverTimeChart({ points }: { points: OpenCarTimePoint[] }) {
  const { t } = useLanguage();
  const width = 920;
  const height = 220;
  const padL = 44;
  const padR = 14;
  const padT = 14;
  const padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  if (points.length === 0) {
    return <p className="table-empty" style={{ margin: 0 }}>{t('correctiveActions.chartEmpty')}</p>;
  }

  const maxY = Math.max(4, Math.ceil(Math.max(...points.map((p) => p.count)) * 1.08));
  const n = points.length;
  const xAt = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - (v / maxY) * plotH;
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(p.count).toFixed(2)}`).join(' ');
  const baseY = (padT + plotH).toFixed(2);
  const areaPath = `${linePath} L ${xAt(n - 1).toFixed(2)} ${baseY} L ${xAt(0).toFixed(2)} ${baseY} Z`;
  const stroke = '#dc2626';
  const fill = 'rgba(220, 38, 38, 0.22)';

  const labelIdx = [...new Set([0, Math.floor((n - 1) / 2), n - 1])].sort((a, b) => a - b);

  return (
    <div>
      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', minWidth: 280, maxWidth: '100%', height: 'auto', display: 'block' }}
          aria-label={t('correctiveActions.openOverTimeChartAria')}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => {
            const y = padT + plotH * f;
            const val = Math.round(maxY * (1 - f));
            return (
              <g key={`grid-${idx}`}>
                <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="var(--color-border-subtle, #e5e7eb)" strokeWidth="1" />
                <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="var(--color-text-muted, #6b7280)">
                  {val}
                </text>
              </g>
            );
          })}
          <line x1={padL} y1={padT + plotH} x2={width - padR} y2={padT + plotH} stroke="#9ca3af" strokeWidth="1" />
          <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#9ca3af" strokeWidth="1" />
          <path d={areaPath} fill={fill} stroke="none" />
          <path
            d={linePath}
            fill="none"
            stroke={stroke}
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {labelIdx.map((i) => (
            <text key={i} x={xAt(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--color-text-muted, #6b7280)">
              {points[i].label}
            </text>
          ))}
        </svg>
      </div>
      <p style={{ margin: '0.35rem 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
        {t('correctiveActions.chartFootnote')}
      </p>
    </div>
  );
}

function getCarStatusSlug(status: string): string {
  const s = status.replace(/\s+/g, '-').toLowerCase();
  if (s === 'draft') return 'draft';
  if (s === 'rcca') return 'waiting-disposition';
  if (s === 'waitingapproval') return 'waiting-approval';
  if (s === 'followup') return 'follow-up';
  if (s === 'closed') return 'closed';
  return s || 'unknown';
}
