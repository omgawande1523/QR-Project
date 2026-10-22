import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { pushBack } from '../../lib/backStack';
import { IS_APP } from '../../lib/platform';

// Open dialogs, topmost last: with a crop dialog over the dish editor, Escape closes only the top one.
const openDialogs = [];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Tab and Shift+Tab wrap around inside the dialog instead of reaching the page behind it.
function trapTab(e, root) {
  const items = [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
  if (!items.length) {
    e.preventDefault();
    root.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === root)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

// Shared behaviour for dialogs: Escape closes, Tab stays inside, body scroll locks, focus moves in and
// back out.
function useDialog(open, onClose, ref) {
  // Callers often pass a new onClose on every render; reading it from a ref keeps the effect from
  // re-running, which would move focus back to the first field while the user is typing.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  // What had focus before opening, read while rendering: by the time effects run, a field with autoFocus
  // inside the dialog has already taken focus.
  const opener = useRef(null);
  if (open && !opener.current) opener.current = document.activeElement;
  useEffect(() => {
    if (!open) return undefined;
    const onClose = () => onCloseRef.current?.();
    const token = {};
    openDialogs.push(token);
    const previouslyFocused = opener.current || document.activeElement;
    const isTop = () => openDialogs[openDialogs.length - 1] === token;
    const onKey = (e) => {
      if (!isTop() || !ref.current) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') trapTab(e, ref.current);
    };
    // Anything else that moves focus out (a radio group's last stop, a script) brings it back inside.
    const onFocusIn = (e) => {
      if (isTop() && ref.current && !ref.current.contains(e.target)) ref.current.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    const removeBack = pushBack(onClose); // the app's back button closes the dialog first
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = ref.current?.querySelector('input, textarea, select, button:not([data-close]), [href]');
    (first || ref.current)?.focus({ preventScroll: true });
    return () => {
      openDialogs.splice(openDialogs.indexOf(token), 1);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      removeBack();
      document.body.style.overflow = overflow;
      opener.current = null;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, ref]);
}

export function BottomSheet({ open, onClose, title, children, labelledBy }) {
  const ref = useRef(null);
  useDialog(open, onClose, ref);
  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title} aria-labelledby={labelledBy} tabIndex={-1}>
        <div className="sheet-handle" aria-hidden="true" />
        {/* The app shows a Close button too: iPhones have no back button to dismiss the sheet. */}
        {(title || (IS_APP && onClose)) && (
          <div className="sheet-header">
            {title && <h2 style={{ fontSize: 'var(--text-xl)' }}>{title}</h2>}
            {IS_APP && onClose && (
              <IconButton label="Close" variant="flat" onClick={onClose} data-close>
                <X size={20} />
              </IconButton>
            )}
          </div>
        )}
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
          {onClose && (
            <IconButton label="Close" variant="flat" onClick={onClose} data-close>
              <X size={20} />
            </IconButton>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
