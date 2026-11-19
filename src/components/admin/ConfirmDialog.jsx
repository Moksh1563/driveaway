import React, { useCallback } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { ERROR_IN } from '../booking/FieldError';

/**
 * Confirmation step for admin actions that email customers or change records.
 * The body states the consequences; a refusal from the server is shown inline so the admin can read it.
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Go back',
  danger = false,
  loading = false,
  error = '',
}) {
  // While the request runs the dialog stays put (Escape, backdrop and Close do nothing)
  const handleClose = useCallback(() => { if (!loading) onClose(); }, [loading, onClose]);

  // The dialog itself opens and closes with the shared modal/scrim motion (Modal); a refusal from the
  // server drops in under the details, and a different refusal replays it so the change is seen
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="sm">
      <div className="space-y-4 text-sm">
        {children}
        {error && (
          <p
            key={error}
            role="alert"
            className={`rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 font-semibold text-danger ${ERROR_IN}`}
          >
            {error}
          </p>
        )}
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" onClick={handleClose} disabled={loading} className="flex-1">{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} className="flex-1">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
