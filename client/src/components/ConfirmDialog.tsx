/**
 * Reusable confirmation dialog: clean modal with message and Confirm/Cancel.
 */
import { useEffect, type ReactNode } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string | ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="confirm-dialog-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div className="confirm-dialog confirm-dialog--narrow" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-dialog-title" className="confirm-dialog-title">
          {title}
        </h3>
        <div id="confirm-dialog-desc" className="confirm-dialog-message">
          {typeof message === 'string' ? <p style={{ margin: 0 }}>{message}</p> : message}
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => onConfirm()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
