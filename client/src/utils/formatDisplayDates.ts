/**
 * Locale-aware display dates for tables (calendar days vs timestamps).
 * Calendar values use UTC noon so YYYY-MM-DD does not shift by local timezone.
 */

export function formatDisplayCalendarDate(value: string | null | undefined): string {
  if (value == null || typeof value !== 'string') return '—';
  const cal = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cal)) return '—';
  const parsed = new Date(`${cal}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDisplayDateTime(iso: string | null | undefined): string {
  if (iso == null || typeof iso !== 'string') return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** POP / period range: two calendar days, locale formatted. */
export function formatDisplayCalendarRange(popStart: string | null, popEnd: string | null): string {
  if (!popStart || !popEnd) return '—';
  return `${formatDisplayCalendarDate(popStart)} – ${formatDisplayCalendarDate(popEnd)}`;
}
