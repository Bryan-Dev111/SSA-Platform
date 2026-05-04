import { Fragment, type ReactNode } from 'react';

const PO_PLURAL_LABEL = 'POs';

/** Uppercase styling on KPI labels would turn "POs" into "POS"; keep the plural s lowercase. */
function renderSummaryKpiTitle(title: string): ReactNode {
  if (!title.includes(PO_PLURAL_LABEL)) {
    return <span className="summary-kpi-label-upper">{title}</span>;
  }
  const parts = title.split(PO_PLURAL_LABEL);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part ? <span className="summary-kpi-label-upper">{part}</span> : null}
          {i < parts.length - 1 ? (
            <span className="summary-kpi-label-pos-plural">{PO_PLURAL_LABEL}</span>
          ) : null}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Compact KPI tile: label, value, optional subtitle; optional shipment-style alert (tooltip-capable).
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
  customAlert?: ReactNode;
}) {
  const hasCustom = customAlert != null;
  const hasDefault = Boolean(showAlert) && !hasCustom;
  const hasAlert = hasCustom || hasDefault;

  return (
    <div className={hasCustom ? 'card shipments-metric-card--overflow-visible' : 'card'}>
      <div
        className={`card-body summary-kpi-card-body${hasAlert ? ' summary-kpi-card-body--alert' : ''}${
          hasCustom ? ' summary-kpi-card-body--custom-tooltip' : ''
        }`}
      >
        {hasCustom ? (
          customAlert
        ) : hasDefault ? (
          <div
            aria-label={alertLabel ?? 'There are late or overdue items'}
            title={alertLabel}
            className="summary-kpi-alert-glyph"
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
        <div className="summary-kpi-label">{renderSummaryKpiTitle(title)}</div>
        <div className="summary-kpi-value">{value}</div>
        {subtitle ? <div className="summary-kpi-subtitle">{subtitle}</div> : null}
      </div>
    </div>
  );
}
