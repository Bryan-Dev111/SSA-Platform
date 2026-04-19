/**
 * Calendar view for Internal Management: audits (codes), shipments (SHIP codes),
 * and planned shipment schedule rows on their scheduled dates.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJson } from '../api/client';

interface AuditCalendarRow {
  id: string;
  code: string;
  auditDate: string;
}

interface ShipmentCalendarRow {
  id: string;
  code: string | null;
  inspectionDate: string | null;
  createdAt: string;
}

interface ScheduleCalendarRow {
  id: string;
  purchaseOrder: string | null;
  scheduledDate: string | null;
}

type CalendarItem =
  | { kind: 'audit'; id: string; label: string; dateKey: string }
  | { kind: 'shipment'; id: string; label: string; dateKey: string }
  | { kind: 'schedule'; id: string; label: string; dateKey: string };

function isoDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = iso.trim();
  if (t.length >= 10) return t.slice(0, 10);
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildMonthWeeks(year: number, monthIndex: number): (number | null)[][] {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function padDateKey(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function useInternalManagementCalendarItems(token: string | null): {
  items: CalendarItem[];
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      apiJson<AuditCalendarRow[]>('/audits', { token }),
      apiJson<ShipmentCalendarRow[]>('/shipments', { token }),
      apiJson<ScheduleCalendarRow[]>('/shipment-schedule', { token }),
    ])
      .then(([auditList, shipmentList, scheduleList]) => {
        const next: CalendarItem[] = [];
        for (const a of auditList) {
          const dk = isoDateKey(a.auditDate);
          if (dk) next.push({ kind: 'audit', id: a.id, label: a.code, dateKey: dk });
        }
        for (const s of shipmentList) {
          const dk =
            isoDateKey(s.inspectionDate) ?? isoDateKey(s.createdAt);
          if (!dk) continue;
          const label = (s.code && s.code.trim()) || s.id;
          next.push({ kind: 'shipment', id: s.id, label, dateKey: dk });
        }
        for (const r of scheduleList) {
          const dk = isoDateKey(r.scheduledDate);
          if (!dk) continue;
          const po = r.purchaseOrder?.trim();
          const label = po ? `Sch: ${po}` : `Sch: ${r.id.slice(0, 8)}…`;
          next.push({ kind: 'schedule', id: r.id, label, dateKey: dk });
        }
        next.sort((a, b) => {
          const c = a.dateKey.localeCompare(b.dateKey);
          if (c !== 0) return c;
          return a.label.localeCompare(b.label);
        });
        setItems(next);
      })
      .catch(() => {
        setError('Could not load calendar data');
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load };
}

export function InternalManagementCalendarView({ token }: { token: string | null }) {
  const { items, loading, error, reload } = useInternalManagementCalendarItems(token);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const weeks = useMemo(() => buildMonthWeeks(year, monthIndex), [year, monthIndex]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    const prefix = padDateKey(year, monthIndex, 1).slice(0, 7);
    for (const it of items) {
      if (!it.dateKey.startsWith(prefix)) continue;
      const list = m.get(it.dateKey) ?? [];
      list.push(it);
      m.set(it.dateKey, list);
    }
    return m;
  }, [items, year, monthIndex]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };
  const goToday = () => {
    const n = new Date();
    setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
  };

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="card-body">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: '1rem',
          }}
        >
          <h2 style={{ margin: 0 }}>Calendar</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={prevMonth} aria-label="Previous month">
              ←
            </button>
            <strong style={{ minWidth: 200, textAlign: 'center' }}>{monthLabel}</strong>
            <button type="button" className="btn btn-ghost btn-sm" onClick={nextMonth} aria-label="Next month">
              →
            </button>
            <button type="button" className="btn btn-sm" onClick={goToday}>
              Today
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reload} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        <p style={{ marginTop: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          Audit codes, shipment IDs (SHIP codes or record id), and shipment schedule rows (Sch) appear on their
          scheduled or inspection dates. Shipments without an inspection date use the created date.
        </p>

        {error && <div className="alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        {loading && <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16, fontSize: 'var(--text-sm)' }}>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 2,
                background: 'var(--color-info-bg, #dbeafe)',
                marginRight: 6,
                verticalAlign: 'middle',
                border: '1px solid var(--color-border)',
              }}
            />
            Audit
          </span>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 2,
                background: 'var(--color-success-bg, #dcfce7)',
                marginRight: 6,
                verticalAlign: 'middle',
                border: '1px solid var(--color-border)',
              }}
            />
            Shipment
          </span>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 2,
                background: 'var(--color-warning-bg, #fef3c7)',
                marginRight: 6,
                verticalAlign: 'middle',
                border: '1px solid var(--color-border)',
              }}
            />
            Schedule
          </span>
        </div>

        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table className="table internal-management-calendar-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr>
                {weekdayLabels.map((w) => (
                  <th key={w} style={{ width: `${100 / 7}%`, textAlign: 'center', fontSize: 'var(--text-sm)' }}>
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => (
                <tr key={wi}>
                  {week.map((day, di) => {
                    if (day == null) {
                      return (
                        <td
                          key={di}
                          style={{
                            background: 'var(--color-border-subtle)',
                            border: '1px solid var(--color-border)',
                            height: 100,
                            verticalAlign: 'top',
                          }}
                        />
                      );
                    }
                    const dateKey = padDateKey(year, monthIndex, day);
                    const dayItems = byDay.get(dateKey) ?? [];
                    const visible = dayItems.slice(0, 4);
                    const more = dayItems.length - visible.length;
                    const title =
                      dayItems.length > 0 ? dayItems.map((x) => `${x.kind}: ${x.label}`).join('\n') : undefined;
                    return (
                      <td
                        key={di}
                        title={title}
                        style={{
                          border: '1px solid var(--color-border)',
                          height: 100,
                          verticalAlign: 'top',
                          padding: 6,
                          fontSize: 'var(--text-sm)',
                          background: 'var(--color-surface)',
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--color-text-muted)' }}>
                          {day}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {visible.map((it) => {
                            const bg =
                              it.kind === 'audit'
                                ? 'var(--color-info-bg, #dbeafe)'
                                : it.kind === 'shipment'
                                  ? 'var(--color-success-bg, #dcfce7)'
                                  : 'var(--color-warning-bg, #fef3c7)';
                            const inner =
                              it.kind === 'audit' ? (
                                <Link
                                  to={`/audit-record?id=${encodeURIComponent(it.id)}`}
                                  style={{
                                    color: 'inherit',
                                    textDecoration: 'underline',
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {it.label}
                                </Link>
                              ) : it.kind === 'shipment' ? (
                                <Link
                                  to="/shipments"
                                  style={{
                                    color: 'inherit',
                                    textDecoration: 'underline',
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={`${it.label} — open Shipments`}
                                >
                                  {it.label}
                                </Link>
                              ) : (
                                <span
                                  style={{
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={it.label}
                                >
                                  {it.label}
                                </span>
                              );
                            return (
                              <span
                                key={`${it.kind}-${it.id}`}
                                style={{
                                  display: 'block',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: bg,
                                  border: '1px solid var(--color-border)',
                                  fontSize: '11px',
                                  lineHeight: 1.25,
                                }}
                              >
                                {inner}
                              </span>
                            );
                          })}
                          {more > 0 && (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>+{more} more</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && items.length === 0 && !error && (
          <p className="table-empty" style={{ marginTop: 16 }}>
            No audits or shipments with dates in the system yet.
          </p>
        )}
      </div>
    </div>
  );
}
