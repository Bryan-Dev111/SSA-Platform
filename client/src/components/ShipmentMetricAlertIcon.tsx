/**
 * Red warning triangle + hover tooltip for shipment KPIs (late PO vs schedule, overdue inspection).
 * Shared by Shipments page (On-Time Delivery) and Dashboard (Shipments card).
 */
import { useState } from 'react';

export type ShipmentShortDeliveryDetail = {
  purchaseOrder: string | null;
  partNumber: string | null;
  missingQty: number;
};

export type ShipmentOverdueInspectionDetail = {
  purchaseOrder: string | null;
  qty: number | null;
};

export function ShipmentMetricAlertIcon({
  shortDeliveries,
  shortDetails,
  overdueInspectionCount = 0,
  overdueInspectionDetails = [],
}: {
  shortDeliveries: number;
  shortDetails: ShipmentShortDeliveryDetail[];
  overdueInspectionCount?: number;
  overdueInspectionDetails?: ShipmentOverdueInspectionDetail[];
}) {
  const [hover, setHover] = useState(false);

  const tooltipBlocks: { heading: string; lines: string[] }[] = [];
  if (shortDeliveries > 0) {
    const lines =
      shortDetails.length > 0
        ? shortDetails.map((d) => {
            const po = d.purchaseOrder?.trim() ? d.purchaseOrder.trim() : '—';
            const part = d.partNumber?.trim() ? d.partNumber.trim() : '—';
            const missing = d.missingQty;
            return `PO: ${po} · Part: ${part} · Quantity missing: ${missing}`;
          })
        : [`${shortDeliveries} late (quantity short vs planned; details unavailable)`];
    tooltipBlocks.push({ heading: 'Late (quantity short vs planned)', lines });
  }

  if (overdueInspectionCount > 0) {
    const lines =
      overdueInspectionDetails.length > 0
        ? overdueInspectionDetails.map((d) => {
            const po = d.purchaseOrder?.trim() ? d.purchaseOrder.trim() : '—';
            const q = d.qty != null ? String(d.qty) : '—';
            return `PO: ${po} · Qty: ${q}`;
          })
        : [`${overdueInspectionCount} overdue (past requested inspection date; details unavailable)`];
    tooltipBlocks.push({ heading: 'Overdue inspection (past requested date)', lines });
  }

  const flatLines = tooltipBlocks.flatMap((b) => [b.heading, ...b.lines]);
  const ariaSummary = flatLines.length > 0 ? flatLines.join('. ') : 'Shipment alert';
  const titleAttr = tooltipBlocks.map((b) => `${b.heading}\n${b.lines.join('\n')}`).join('\n\n');

  return (
    <div
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className="shipments-late-alert-btn"
        aria-label={ariaSummary}
        title={titleAttr}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          background: 'rgba(254, 226, 226, 0.98)',
          border: '1px solid rgba(252, 165, 165, 0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'default',
          padding: 0,
          margin: 0,
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 4.2L3.3 19.5h17.4L12 4.2z"
            stroke="#dc2626"
            strokeWidth="1.65"
            strokeLinejoin="round"
          />
          <path d="M12 9.5v4.2" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="17.3" r="0.85" fill="#dc2626" />
        </svg>
      </button>
      {hover ? (
        <>
          <div style={{ height: 5, width: 30, flexShrink: 0 }} aria-hidden />
          <div
            style={{
              minWidth: 220,
              maxWidth: 300,
              padding: '0.55rem 0.65rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              boxShadow: 'var(--shadow-md)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text)',
              lineHeight: 1.45,
              textAlign: 'left',
            }}
            role="tooltip"
          >
            {tooltipBlocks.map((block, bi) => (
              <div key={block.heading} style={{ marginTop: bi > 0 ? 10 : 0 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{block.heading}</div>
                {block.lines.map((line, i) => (
                  <div key={`${bi}-${i}`}>{line}</div>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
