import type { ReactNode } from 'react';

/**
 * Dashboard-style summary card: label, primary value, optional muted subtitle.
 * Supports an optional alert glyph in the top-right, or a custom alert (e.g. hover tooltip).
 */
export function MetricCard({
  title,
  value,
  subtitle,
  showAlert,
  alertLabel,
  customAlert,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  showAlert?: boolean;
  alertLabel?: string;
  /** When set, replaces the default static triangle (use for rich tooltips). */
  customAlert?: ReactNode;
}) {
  const hasCustom = customAlert != null;
  const hasDefault = Boolean(showAlert) && !hasCustom;
  const hasAlert = hasCustom || hasDefault;

  return (
    <div className={hasCustom ? 'card shipments-metric-card--overflow-visible' : 'card'}>
      <div
        className="card-body"
        style={{
          padding: '0.9rem',
          position: 'relative',
          ...(hasAlert ? { minHeight: 88, zIndex: hasCustom ? 1 : undefined } : {}),
        }}
      >
        {hasCustom ? (
          customAlert
        ) : hasDefault ? (
          <div
            aria-label={alertLabel ?? 'There are late or overdue items'}
            title={alertLabel}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 26,
              height: 26,
              borderRadius: 6,
              background: 'rgba(254, 226, 226, 0.98)',
              border: '1px solid rgba(252, 165, 165, 0.95)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 4.2L3.3 19.5h17.4L12 4.2z"
                stroke="#dc2626"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path d="M12 9.5v4.2" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="17.3" r="0.95" fill="#dc2626" />
            </svg>
          </div>
        ) : null}
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-muted)',
            paddingRight: hasAlert ? 36 : 0,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{value}</div>
        {subtitle ? (
          <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', lineHeight: 1.35 }}>
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
