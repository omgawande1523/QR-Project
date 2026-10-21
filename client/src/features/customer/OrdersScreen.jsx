import { Link } from 'react-router';
import { ClipboardList, ChevronRight } from 'lucide-react';
import { useCustomer } from './CustomerContext';
import { Badge, Button, EmptyState } from '../../components/ui';
import { STATUS_LABEL, STATUS_TONE } from '../../lib/orderStatus';
import { formatPrice, formatDateTime } from '../../lib/format';

export const shortId = (id) => String(id).slice(-6).toUpperCase();

export default function OrdersScreen() {
  const { restaurantId, trackedOrders } = useCustomer();
  const orders = [...trackedOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <main className="customer-page page-enter">
      <header className="page-header" style={{ gridTemplateColumns: '1fr' }}>
        <h1>Your orders</h1>
      </header>
      {orders.length === 0 ? (
        <EmptyState icon={<ClipboardList size={30} />} title="No orders yet" action={<Button to={`/menu/${restaurantId}/browse`}>Browse the menu</Button>}>
          Orders you place from this phone appear here, with live status.
        </EmptyState>
      ) : (
        <ul className="order-list">
          {orders.map((order) => (
            <li key={order._id}>
              <Link to={`/menu/${restaurantId}/orders/${order._id}`} className="order-row">
                <div className="grow">
                  <div className="row" style={{ gap: 8 }}>
                    <strong>#{shortId(order._id)}</strong>
                    <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                  </div>
                  <p className="muted text-sm truncate">
                    {order.items.map((i) => `${i.quantity}× ${i.menuItemName}`).join(', ')}
                  </p>
                  <p className="muted text-xs">{formatDateTime(order.createdAt)} · Table {order.tableNumber}</p>
                </div>
                <span className="price">{formatPrice(order.totalAmount)}</span>
                <ChevronRight size={18} aria-hidden="true" className="muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
