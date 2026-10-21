import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';

// Open dialogs, topmost last: with a crop dialog over the dish editor, Escape closes only the top one.
const openDialogs = [];

// Shared behaviour for dialogs: Escape closes, body scroll locks, focus moves in and back out.
function useDialog(open, onClose, ref) {
  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    openDialogs.push(token);
    const previouslyFocused = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && openDialogs[openDialogs.length - 1] === token && onClose?.();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = ref.current?.querySelector('input, textarea, select, button:not([data-close]), [href]');
    (first || ref.current)?.focus({ preventScroll: true });
    return () => {
      openDialogs.splice(openDialogs.indexOf(token), 1);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, ref]);
}

export function BottomSheet({ open, onClose, title, children, labelledBy }) {
  const ref = useRef(null);
  useDialog(open, onClose, ref);
  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title} aria-labelledby={labelledBy} tabIndex={-1}>
        <div className="sheet-handle" aria-hidden="true" />
        {title && <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)' }}>{title}</h2>}
        {children}
      </div>
    </div>,
    document.body
  );
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  const ref = useRef(null);
  useDialog(open, onClose, ref);
  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="modal-header">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>{title}</h2>
          <IconButton label="Close" variant="flat" onClick={onClose} data-close>
            <X size={20} />
          </IconButton>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
