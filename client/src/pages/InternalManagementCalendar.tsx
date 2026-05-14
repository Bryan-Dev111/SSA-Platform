/**
 * Calendar view for Internal Management: audits (codes), shipments (SHIP codes),
 * and user-added events (subject + date) for Sentinel Supplier Assurance.
 * Global Supply variant shows PO delivery/arrival dates and user-added events (subject + date).
 */
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { TOptions } from 'i18next';
import { Link } from 'react-router-dom';
import { apiJson } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

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

interface PurchaseOrderCalendarRow {
  id: string;
  code: string;
  estimatedFarmerDeliveryDate: string | null;
  estimatedArrivalAtBuyer: string | null;
}

/** User-created calendar row (SSA Internal Management or Global Supply). */
interface ManualCalendarEventRow {
  id: string;
  subject: string;
  eventDate: string;
}

type CalendarItem =
  | { kind: 'audit'; id: string; label: string; dateKey: string }
  | { kind: 'shipment'; id: string; label: string; dateKey: string }
  | { kind: 'poDelivery'; id: string; poCode: string; dateKey: string }
  | { kind: 'poArrival'; id: string; poCode: string; dateKey: string }
  | { kind: 'customEvent'; id: string; label: string; dateKey: string };

function calendarItemSortKey(it: CalendarItem): string {
  if (it.kind === 'poDelivery') return `${it.poCode}\0delivery`;
  if (it.kind === 'poArrival') return `${it.poCode}\0arrival`;
  return it.label;
}

type TranslateFn = (key: string, fallbackOrOptions?: string | TOptions) => string;

function calendarItemDisplayLabel(it: CalendarItem, t: TranslateFn): string {
  if (it.kind === 'poDelivery') return t('internal.calendar.poFarmDelivery', { code: it.poCode });
  if (it.kind === 'poArrival') return t('internal.calendar.poArrivalBuyer', { code: it.poCode });
  return it.label;
}

const CALENDAR_KIND_I18N: Record<Exclude<CalendarItem['kind'], 'customEvent'>, string> = {
  audit: 'internal.calendar.kind.audit',
  shipment: 'internal.calendar.kind.shipment',
  poDelivery: 'internal.calendar.kind.poDelivery',
  poArrival: 'internal.calendar.kind.poArrival',
};

function calendarTooltipLine(it: CalendarItem, t: TranslateFn): string {
  if (it.kind === 'customEvent') {
    return t('internal.calendar.tooltipCustom', { subject: it.label });
  }
  return `${t(CALENDAR_KIND_I18N[it.kind])}: ${calendarItemDisplayLabel(it, t)}`;
}

/** Real greens for SSA shipment chips; app `--color-success-*` tokens are blue for general UI (see index.css). */
const SSA_CALENDAR_SHIPMENT_BG = '#dcfce7';
const SSA_CALENDAR_SHIPMENT_BORDER = '#86efac';
const SSA_CALENDAR_SHIPMENT_TEXT = '#14532d';

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

function todayDateInputValue(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function useInternalManagementCalendarItems(
  token: string | null,
  variant: 'supplierAssurance' | 'globalSupply',
  t: TranslateFn
): {
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
    const loadPromise =
      variant === 'globalSupply'
        ? Promise.all([
            apiJson<PurchaseOrderCalendarRow[]>('/purchase-orders', { token }).catch(() => []),
            apiJson<ManualCalendarEventRow[]>('/global-supply-calendar-events', { token }).catch(
              () => [] as ManualCalendarEventRow[]
            ),
          ]).then(([poList, eventRows]) => {
            const next: CalendarItem[] = [];
            for (const po of poList) {
              const farmDeliveryKey = isoDateKey(po.estimatedFarmerDeliveryDate);
              if (farmDeliveryKey) {
                next.push({
                  kind: 'poDelivery',
                  id: `${po.id}-delivery`,
                  poCode: po.code,
                  dateKey: farmDeliveryKey,
                });
              }
              const buyerArrivalKey = isoDateKey(po.estimatedArrivalAtBuyer);
              if (buyerArrivalKey) {
                next.push({
                  kind: 'poArrival',
                  id: `${po.id}-arrival`,
                  poCode: po.code,
                  dateKey: buyerArrivalKey,
                });
              }
            }
            for (const ev of eventRows) {
              const dk = isoDateKey(ev.eventDate);
              if (!dk) continue;
              next.push({
                kind: 'customEvent',
                id: ev.id,
                label: ev.subject,
                dateKey: dk,
              });
            }
            return next;
          })
        : Promise.all([
            apiJson<AuditCalendarRow[]>('/audits', { token }).catch(() => [] as AuditCalendarRow[]),
            apiJson<ShipmentCalendarRow[]>('/shipments', { token }).catch(() => [] as ShipmentCalendarRow[]),
            apiJson<ManualCalendarEventRow[]>('/internal-management-calendar-events', { token }).catch(
              () => [] as ManualCalendarEventRow[]
            ),
          ]).then(([auditList, shipmentList, eventRows]) => {
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
            for (const ev of eventRows) {
              const dk = isoDateKey(ev.eventDate);
              if (!dk) continue;
              next.push({
                kind: 'customEvent',
                id: ev.id,
                label: ev.subject,
                dateKey: dk,
              });
            }
            return next;
          });

    loadPromise
      .then((nextItems) => {
        nextItems.sort((a, b) => {
          const c = a.dateKey.localeCompare(b.dateKey);
          if (c !== 0) return c;
          return calendarItemSortKey(a).localeCompare(calendarItemSortKey(b));
        });
        setItems(nextItems);
      })
      .catch(() => {
        setError(t('internal.calendar.loadFailed'));
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [token, variant, t]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load };
}

export function InternalManagementCalendarView({
  token,
  variant = 'supplierAssurance',
}: {
  token: string | null;
  variant?: 'supplierAssurance' | 'globalSupply';
}) {
  const toast = useToast();
  const { t, locale } = useLanguage();
  const { items, loading, error, reload } = useInternalManagementCalendarItems(token, variant, t);
  const [newEventSubject, setNewEventSubject] = useState('');
  const [newEventDate, setNewEventDate] = useState(todayDateInputValue);
  const [savingEvent, setSavingEvent] = useState(false);
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

  const monthLabel = useMemo(
    () => cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
    [cursor, locale]
  );

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

  const submitCalendarEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const subject = newEventSubject.trim();
    if (!subject) {
      toast.error(t('internal.calendar.enterSubject'));
      return;
    }
    if (!newEventDate) {
      toast.error(t('internal.calendar.chooseDate'));
      return;
    }
    const path =
      variant === 'globalSupply'
        ? '/global-supply-calendar-events'
        : '/internal-management-calendar-events';
    setSavingEvent(true);
    try {
      await apiJson(path, {
        token,
        method: 'POST',
        body: JSON.stringify({ subject, eventDate: newEventDate }),
      });
      toast.success(t('internal.calendar.eventAdded'));
      setNewEventSubject('');
      setNewEventDate(todayDateInputValue());
      reload();
    } catch (err) {
      let msg = t('internal.calendar.addEventFailed');
      if (err instanceof Error) {
        try {
          const j = JSON.parse(err.message) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          msg = err.message || msg;
        }
      }
      toast.error(msg);
    } finally {
      setSavingEvent(false);
    }
  };

  const weekdayLabels = useMemo(() => {
    const anchor = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: 'short' });
    });
  }, [locale]);

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
          <h2 style={{ margin: 0 }}>{t('internal.calendar.title')}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={prevMonth}
              aria-label={t('internal.calendar.prevMonth')}
            >
              ←
            </button>
            <strong style={{ minWidth: 200, textAlign: 'center' }}>{monthLabel}</strong>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={nextMonth}
              aria-label={t('internal.calendar.nextMonth')}
            >
              →
            </button>
            <button type="button" className="btn btn-sm" onClick={goToday}>
              {t('internal.calendar.today')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reload} disabled={loading}>
              {t('internal.calendar.refresh')}
            </button>
          </div>
        </div>

        {error && <div className="alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        {loading && <p style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>}

        {token ? (
          <form
            onSubmit={(ev) => void submitCalendarEvent(ev)}
            className="stack"
            style={{
              gap: 10,
              marginBottom: '1rem',
              padding: '12px 14px',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              background: 'var(--color-surface-2, #f8fafc)',
              maxWidth: 520,
            }}
          >
            <strong style={{ fontSize: 'var(--text-sm)' }}>{t('internal.calendar.addEventHeading')}</strong>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'flex-end',
              }}
            >
              <label className="field" style={{ flex: '1 1 180px', marginBottom: 0 }}>
                <span className="field-label">{t('internal.calendar.subject')}</span>
                <input
                  className="input"
                  type="text"
                  value={newEventSubject}
                  onChange={(ev) => setNewEventSubject(ev.target.value)}
                  placeholder={t('internal.calendar.subjectPlaceholder')}
                  maxLength={500}
                  disabled={savingEvent}
                  autoComplete="off"
                />
              </label>
              <label className="field" style={{ width: 160, marginBottom: 0 }}>
                <span className="field-label">{t('internal.calendar.date')}</span>
                <input
                  className="input"
                  type="date"
                  value={newEventDate}
                  onChange={(ev) => setNewEventDate(ev.target.value)}
                  disabled={savingEvent}
                />
              </label>
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingEvent}>
                {savingEvent ? t('internal.calendar.adding') : t('internal.calendar.addEvent')}
              </button>
            </div>
          </form>
        ) : null}

        {variant === 'globalSupply' ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              marginBottom: 16,
              fontSize: 'var(--text-sm)',
            }}
          >
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
              {t('internal.calendar.legendPoFarmDelivery')}
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
              {t('internal.calendar.legendPoArrival')}
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
              {t('internal.calendar.legendEvent')}
            </span>
          </div>
        ) : (
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
              {t('internal.calendar.legendAudit')}
            </span>
            <span>
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: SSA_CALENDAR_SHIPMENT_BG,
                  marginRight: 6,
                  verticalAlign: 'middle',
                  border: `1px solid ${SSA_CALENDAR_SHIPMENT_BORDER}`,
                }}
              />
              {t('internal.calendar.legendShipment')}
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
              {t('internal.calendar.legendEvent')}
            </span>
          </div>
        )}

        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table className="table internal-management-calendar-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr>
                {weekdayLabels.map((w, wi) => (
                  <th key={`${wi}-${w}`} style={{ width: `${100 / 7}%`, textAlign: 'center', fontSize: 'var(--text-sm)' }}>
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
                      dayItems.length > 0
                        ? dayItems.map((x) => calendarTooltipLine(x, t)).join('\n')
                        : undefined;
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
                                  ? SSA_CALENDAR_SHIPMENT_BG
                                  : it.kind === 'poDelivery'
                                    ? 'var(--color-info-bg, #dbeafe)'
                                    : it.kind === 'poArrival'
                                      ? 'var(--color-success-bg, #dcfce7)'
                                      : 'var(--color-warning-bg, #fef3c7)';
                            const chipBorder =
                              it.kind === 'shipment'
                                ? `1px solid ${SSA_CALENDAR_SHIPMENT_BORDER}`
                                : '1px solid var(--color-border)';
                            const chipColor = it.kind === 'shipment' ? SSA_CALENDAR_SHIPMENT_TEXT : 'inherit';
                            const chipText = calendarItemDisplayLabel(it, t);
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
                                  {chipText}
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
                                  title={t('internal.calendar.openShipmentsTitle', { label: chipText })}
                                >
                                  {chipText}
                                </Link>
                              ) : it.kind === 'customEvent' ? (
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
                              ) : (
                                <span
                                  style={{
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={chipText}
                                >
                                  {chipText}
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
                                  border: chipBorder,
                                  color: chipColor,
                                  fontSize: '11px',
                                  lineHeight: 1.25,
                                }}
                              >
                                {inner}
                              </span>
                            );
                          })}
                          {more > 0 && (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              {t('internal.calendar.moreCount', { count: more })}
                            </span>
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
            {variant === 'globalSupply'
              ? t('internal.calendar.emptyGlobalSupply')
              : t('internal.calendar.emptySupplierAssurance')}
          </p>
        )}
      </div>
    </div>
  );
}
