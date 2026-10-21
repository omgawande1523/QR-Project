import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, X, Printer, StickyNote } from 'lucide-react';
import { Button, IconButton, Badge } from '../../components/ui';
import { BOARD_COLUMNS, STATUS_LABEL, STATUS_TONE } from '../../lib/orderStatus';
import { formatPrice, timeAgo } from '../../lib/format';
import { PAYMENT_LABEL } from '../../lib/invoice';
import { IS_APP, haptic } from '../../lib/platform';

const shortId = (id) => String(id).slice(-6).toUpperCase();
const PREVIOUS = { process: 'pending', ready: 'process', served: 'ready', billed: 'served' };

// The board column (data-status) under a point on screen.
const statusAt = (point) => point && document.elementFromPoint(point.x, point.y)?.closest('[data-status]')?.dataset.status;

/*
 * Staff app: press and hold a card, then drag it to another column (HTML drag and drop does not work with
 * touch in Android's WebView). Moving the finger before the hold starts scrolls as usual. Native listeners,
 * because React's touchmove is passive and could not stop the page scrolling while a card is dragged.
 */
function useTouchDrag(ref, { enabled, onOver, onDrop }) {
  const [offset, setOffset] = useState(null);
  const handlers = useRef({ onOver, onDrop });
  handlers.current = { onOver, onDrop };
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;
    let drag = null;
    const start = (e) => {
      if (e.touches.length !== 1 || e.target.closest('button, a')) return;
      const t = e.touches[0];
      drag = { x: t.clientX, y: t.clientY, active: false };
      drag.timer = setTimeout(() => { drag.active = true; setOffset({ x: 0, y: 0 }); haptic(); }, 350);
    };
    const move = (e) => {
      if (!drag) return;
      const t = e.touches[0];
      if (!drag.active) {
        if (Math.hypot(t.clientX - drag.x, t.clientY - drag.y) > 10) { clearTimeout(drag.timer); drag = null; }
        return;
      }
      e.preventDefault();
      drag.last = { x: t.clientX, y: t.clientY };
      setOffset({ x: t.clientX - drag.x, y: t.clientY - drag.y });
      handlers.current.onOver(statusAt(drag.last));
    };
    const end = () => {
      if (!drag) return;
      clearTimeout(drag.timer);
      if (drag.active) {
        setOffset(null);
        handlers.current.onOver(null);
        handlers.current.onDrop(statusAt(drag.last));
      }
      drag = null;
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [ref, enabled]);
  return offset;
}

export function OrderItems({ items, compact = false }) {
  return (
    <ul className={`order-items ${compact ? 'is-compact' : ''}`}>
      {items.map((item, i) => (
        <li key={item._id || i}>
          <span className="order-qty">{item.quantity}×</span>
          <span className="grow">
            {item.menuItemName}
            {(item.variant?.name || item.addOns?.length > 0) && (
              <span className="order-options">{[item.variant?.name, ...(item.addOns || []).map((a) => a.name)].filter(Boolean).join(' · ')}</span>
            )}
            {item.notes && <span className="order-note"><StickyNote size={12} aria-hidden="true" /> {item.notes}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// One order on the board: table, customer, items, total, and one-tap status changes.
export function OrderCard({ order, onStatus, onPrint, draggable = false, busy = false, now, focused = false, onDragOverColumn }) {
  const ref = useRef(null);
  const offset = useTouchDrag(ref, {
    enabled: IS_APP && draggable,
    onOver: (status) => onDragOverColumn?.(status),
    onDrop: (status) => { if (status && status !== order.status) onStatus(order, status); }
  });
  const column = BOARD_COLUMNS.find((c) => c.status === order.status);
  const previous = PREVIOUS[order.status];
  const canCancel = ['pending', 'process'].includes(order.status);
  const ageMinutes = (now - new Date(order.createdAt)) / 60000;
  const late = order.status === 'pending' ? ageMinutes > 5 : order.status === 'process' ? ageMinutes > 25 : false;

  return (
    <article
      ref={ref}
      id={`order-${order._id}`}
      className={`order-card ${late ? 'is-late' : ''} ${focused ? 'is-focused' : ''} ${offset ? 'is-dragging' : ''}`}
      style={offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/order-id', order._id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      aria-label={`Table ${order.tableNumber}, ${STATUS_LABEL[order.status]}`}
    >
      <header className="row-between">
        <span className="order-table">T{order.tableNumber}</span>
        <div className="grow">
          <strong className="truncate" style={{ display: 'block' }}>{order.customerName || 'Guest'}</strong>
          <span className="muted text-xs">#{shortId(order._id)} · {timeAgo(order.createdAt, now)}</span>
        </div>
        {!column && <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>}
        {column && order.payment?.paidAt && <Badge tone="success">Paid · {PAYMENT_LABEL[order.payment.method]}</Badge>}
      </header>
      <OrderItems items={order.items} />
      <footer className="order-card-foot">
        <span className="price">{formatPrice(order.totalAmount)}</span>
        <div className="row" style={{ gap: 4 }}>
          {onPrint && <IconButton label="Open bill" variant="flat" onClick={() => onPrint(order)}><Printer size={18} /></IconButton>}
          {previous && <IconButton label={`Move back to ${STATUS_LABEL[previous]}`} variant="flat" onClick={() => onStatus(order, previous)} disabled={busy}><ChevronLeft size={18} /></IconButton>}
          {canCancel && <IconButton label="Cancel order" variant="flat" onClick={() => onStatus(order, 'cancelled')} disabled={busy}><X size={18} /></IconButton>}
        </div>
      </footer>
      {column && (
        <Button size="sm" block variant={order.status === 'pending' ? 'primary' : 'accent'} onClick={() => onStatus(order, column.next)} loading={busy}>
          {column.action}
        </Button>
      )}
    </article>
  );
}
