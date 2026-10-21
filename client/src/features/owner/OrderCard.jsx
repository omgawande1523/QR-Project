import { ChevronLeft, X, Printer, StickyNote } from 'lucide-react';
import { Button, IconButton, Badge } from '../../components/ui';
import { BOARD_COLUMNS, STATUS_LABEL, STATUS_TONE } from '../../lib/orderStatus';
import { formatPrice, timeAgo } from '../../lib/format';
import { PAYMENT_LABEL } from '../../lib/invoice';

const shortId = (id) => String(id).slice(-6).toUpperCase();
const PREVIOUS = { process: 'pending', ready: 'process', served: 'ready', billed: 'served' };

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
export function OrderCard({ order, onStatus, onPrint, draggable = false, busy = false, now }) {
  const column = BOARD_COLUMNS.find((c) => c.status === order.status);
  const previous = PREVIOUS[order.status];
  const canCancel = ['pending', 'process'].includes(order.status);
  const ageMinutes = (now - new Date(order.createdAt)) / 60000;
  const late = order.status === 'pending' ? ageMinutes > 5 : order.status === 'process' ? ageMinutes > 25 : false;

  return (
    <article
      className={`order-card ${late ? 'is-late' : ''}`}
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
