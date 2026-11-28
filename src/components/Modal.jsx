import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ open, onClose, title, description, children, footer, size = 'md', closeOnBackdrop = true }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = size === 'lg' ? ' lg' : size === 'sm' ? ' sm' : '';

  return (
    <div
      className="overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className={`modal${sizeClass}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div className="grow">
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="btn btn-ghost btn-icon close" onClick={onClose} aria-label="Tutup">
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Konfirmasi',
  message,
  confirmLabel = 'Ya, lanjutkan',
  danger = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => {
              onConfirm?.();
              onClose?.();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="small" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {message}
      </p>
    </Modal>
  );
}
