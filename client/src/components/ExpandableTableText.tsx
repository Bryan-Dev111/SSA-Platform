import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Table cell for notes/descriptions: same UX as Corrective Actions Summary —
 * long text shows a 2-line preview button; click opens a full-text modal (portal).
 */
export function ExpandableTableText({
  value,
  empty = '—',
  modalTitle,
}: {
  value: string | null | undefined;
  empty?: string;
  /** Shown as the modal heading (e.g. `Notes — FARM-001`). */
  modalTitle: string;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const text = (value ?? '').trim();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!text) {
    return <span style={{ color: 'var(--color-text-muted)' }}>{empty}</span>;
  }

  const useModal =
    text.length > 120 || /\r?\n/.test(text);

  if (!useModal) {
    return (
      <div style={{ lineHeight: 1.35, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</div>
    );
  }

  const modal =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        className="confirm-dialog-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={() => setOpen(false)}
      >
        <div className="confirm-dialog confirm-dialog--wide" onClick={(e) => e.stopPropagation()}>
          <h3 id={titleId} className="confirm-dialog-title">
            {modalTitle}
          </h3>
          <p style={{ marginBottom: '1rem', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{text}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
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
        title="Click to view full note"
      >
        {text}
      </button>
      {modal}
    </>
  );
}
