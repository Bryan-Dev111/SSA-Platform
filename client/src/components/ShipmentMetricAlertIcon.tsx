/**
 * Red warning triangle + hover tooltip for shipment KPIs (late PO vs schedule, overdue inspection).
 * Shared by Shipments page (On-Time Delivery) and Dashboard (Shipments card).
 * Tooltip is portaled to document.body so Dashboard layout cannot clip or cover it (parity with Shipments).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  includeOverdueInspectionInTooltip = true,
  summaryFallbackWhenNoTooltipLines,
}: {
  shortDeliveries: number;
  shortDetails: ShipmentShortDeliveryDetail[];
  overdueInspectionCount?: number;
  overdueInspectionDetails?: ShipmentOverdueInspectionDetail[];
  /** Dashboard: omit "Overdue inspection" from the hover panel; Shipments page keeps both (default true). */
  includeOverdueInspectionInTooltip?: boolean;
  /** When the hover panel has no lines (e.g. overdue-only on Dashboard), used for button title / aria-label. */
  summaryFallbackWhenNoTooltipLines?: string;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fixedPos, setFixedPos] = useState<{ top: number; right: number } | null>(null);

  const cancelScheduledClose = () => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(() => setPanelOpen(false), 120);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current != null) clearTimeout(closeTimerRef.current);
    };
  }, []);

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

  if (includeOverdueInspectionInTooltip && overdueInspectionCount > 0) {
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
  const titleAttr = tooltipBlocks.map((b) => `${b.heading}\n${b.lines.join('\n')}`).join('\n\n');
  const ariaSummary =
    flatLines.length > 0
      ? flatLines.join('. ')
      : (summaryFallbackWhenNoTooltipLines?.trim() || 'Shipment alert');
  const titleForButton =
    flatLines.length > 0 ? titleAttr : (summaryFallbackWhenNoTooltipLines?.trim() || 'Shipment alert');

  const openPanel = () => {
    cancelScheduledClose();
    if (tooltipBlocks.length === 0) return;
    setPanelOpen(true);
  };

  useEffect(() => {
    if (panelOpen && tooltipBlocks.length === 0) setPanelOpen(false);
  }, [panelOpen, tooltipBlocks.length]);

  useLayoutEffect(() => {
    if (!panelOpen || !anchorRef.current) {
      setFixedPos(null);
      return;
    }
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setFixedPos({ top: r.bottom + 5, right: window.innerWidth - r.right });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [panelOpen, tooltipBlocks.length]);

  const tooltipEl =
    panelOpen && tooltipBlocks.length > 0 && fixedPos != null && typeof document !== 'undefined' ? (
      createPortal(
        <div
          style={{
            position: 'fixed',
            top: fixedPos.top,
            right: fixedPos.right,
            zIndex: 10000,
            minWidth: 220,
            maxWidth: 300,
            maxHeight: 'min(60vh, 360px)',
            overflowY: 'auto',
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
          onMouseEnter={cancelScheduledClose}
          onMouseLeave={scheduleClose}
        >
          {tooltipBlocks.map((block, bi) => (
            <div key={block.heading} style={{ marginTop: bi > 0 ? 10 : 0 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{block.heading}</div>
              {block.lines.map((line, i) => (
                <div key={`${bi}-${i}`}>{line}</div>
              ))}
            </div>
          ))}
        </div>,
        document.body
      )
    ) : null;

  return (
    <div
      ref={anchorRef}
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        zIndex: panelOpen ? 100 : 25,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
      onMouseEnter={openPanel}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className="shipments-late-alert-btn"
        aria-label={ariaSummary}
        title={titleForButton}
        onFocus={() => openPanel()}
        onBlur={() => scheduleClose()}
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
      {tooltipEl}
    </div>
  );
}
