import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ShoppingBag, IndianRupee, Receipt, Flame, ArrowRight, Copy, ConciergeBell, ClipboardList, PartyPopper } from 'lucide-react';
import { useOwner } from './OwnerContext';
import { PageHeader } from './OwnerLayout';
import { OrderItems } from './OrderCard';
import { Button, Card, EmptyState, Skeleton, Badge, useToast } from '../../components/ui';
import { BOARD_COLUMNS, STATUS_LABEL, STATUS_TONE, isActiveOrder } from '../../lib/orderStatus';
import { formatPrice, timeAgo } from '../../lib/format';
import { useNow } from '../../lib/useNow';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function Stat({ icon, label, value, hint }) {
  return (
    <Card className="stat">
      <span className="stat-icon" aria-hidden="true">{icon}</span>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {hint && <p className="muted text-xs">{hint}</p>}
      </div>
    </Card>
  );
}

export default function DashboardHome() {
  const { profile, orders, ordersLoaded, setOrderStatus, requests, markRequestHandled, userId } = useOwner();
  const [params] = useSearchParams();
  const toast = useToast();
  const now = useNow();
  const [busy, setBusy] = useState(null);

  const stats = useMemo(() => {
    const since = startOfToday();
    const today = orders.filter((o) => new Date(o.createdAt) >= since && o.status !== 'cancelled');
    const revenue = today.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const counts = new Map();
    today.forEach((o) => o.items.forEach((i) => counts.set(i.menuItemName, (counts.get(i.menuItemName) || 0) + i.quantity)));
    const topItems = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return {
      count: today.length,
      revenue,
      average: today.length ? revenue / today.length : 0,
      active: orders.filter((o) => isActiveOrder(o.status)),
      topItems
    };
  }, [orders]);

  const menuLink = `${window.location.origin}/menu/${userId}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(menuLink);
      toast.success('Customer menu link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const advance = async (order) => {
    const column = BOARD_COLUMNS.find((c) => c.status === order.status);
    if (!column) return;
    setBusy(order._id);
    try { await setOrderStatus(order._id, column.next); } catch { /* toast shown */ } finally { setBusy(null); }
  };

  const maxTop = stats.topItems[0]?.[1] || 1;

  return (
    <>
      <PageHeader
        title={`${greeting()}${profile ? `, ${profile.restaurantName}` : ''}`}
        subtitle={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={<Button to="/dashboard/orders" icon={<ClipboardList size={18} />}>Open orders board</Button>}
      />

      {params.get('welcome') && (
        <Card className="welcome-card">
          <PartyPopper size={28} aria-hidden="true" />
          <div className="grow">
            <strong>Your restaurant is ready.</strong>
            <p className="text-sm">Add your dishes, then print table QR codes. Customers can order as soon as a dish is on the menu.</p>
          </div>
          <Button to="/dashboard/menu">Add dishes</Button>
        </Card>
      )}

      <section className="stat-grid" aria-label="Today">
        {!ordersLoaded ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={96} radius="var(--radius-card)" />) : (
          <>
            <Stat icon={<ShoppingBag size={22} />} label="Today's orders" value={stats.count} />
            <Stat icon={<IndianRupee size={22} />} label="Revenue today" value={formatPrice(stats.revenue)} hint="Excludes cancelled orders" />
            <Stat icon={<Receipt size={22} />} label="Average order" value={formatPrice(Math.round(stats.average * 100) / 100)} />
            <Stat icon={<Flame size={22} />} label="Active right now" value={stats.active.length} />
          </>
        )}
      </section>

      <div className="home-grid">
        <Card className="stack">
          <div className="row-between">
            <h2 className="card-title">Live orders</h2>
            <Link to="/dashboard/orders" className="text-sm bold tap-link">All orders <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          {stats.active.length === 0 ? (
            <EmptyState icon={<ShoppingBag size={28} />} title="No active orders">New orders appear here instantly.</EmptyState>
          ) : (
            <ul className="live-list">
              {stats.active.slice(0, 8).map((order) => {
                const column = BOARD_COLUMNS.find((c) => c.status === order.status);
                return (
                  <li key={order._id} className="live-row">
                    <span className="order-table">T{order.tableNumber}</span>
                    <div className="grow">
                      <div className="row" style={{ gap: 8 }}>
                        <strong>{order.customerName || 'Guest'}</strong>
                        <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                        <span className="muted text-xs">{timeAgo(order.createdAt, now)}</span>
                      </div>
                      <OrderItems items={order.items} compact />
                    </div>
                    <div className="live-actions">
                      <span className="price">{formatPrice(order.totalAmount)}</span>
                      {column && <Button size="sm" variant={order.status === 'pending' ? 'primary' : 'secondary'} onClick={() => advance(order)} loading={busy === order._id}>{column.action}</Button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="stack">
          <Card className="stack-sm">
            <h2 className="card-title">Top dishes today</h2>
            {stats.topItems.length === 0 ? <p className="muted text-sm">No orders yet today.</p> : (
              <ol className="top-list">
                {stats.topItems.map(([name, qty]) => (
                  <li key={name}>
                    <div className="row-between text-sm"><span className="truncate">{name}</span><strong>{qty}</strong></div>
                    <span className="top-bar" style={{ width: `${(qty / maxTop) * 100}%` }} aria-hidden="true" />
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card className="stack-sm">
            <h2 className="card-title">Table requests {requests.length > 0 && <Badge tone="warning">{requests.length}</Badge>}</h2>
            {requests.length === 0 ? <p className="muted text-sm">No tables are waiting.</p> : (
              <ul className="request-list">
                {requests.slice(0, 5).map((r) => (
                  <li key={r._id} className="request-row">
                    <span className="request-table">T{r.tableNumber}</span>
                    <div className="grow"><strong>{r.type === 'Bill' ? 'Bill' : r.type}</strong><p className="muted text-xs">{timeAgo(r.timestamp, now)}</p></div>
                    <Button size="sm" variant="secondary" icon={<ConciergeBell size={16} />} onClick={() => markRequestHandled(r._id)}>Done</Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="stack-sm">
            <h2 className="card-title">Your customer menu</h2>
            <p className="muted text-sm truncate">{menuLink}</p>
            <div className="row wrap">
              <Button size="sm" variant="secondary" icon={<Copy size={16} />} onClick={copyLink}>Copy link</Button>
              <Button size="sm" variant="ghost" to="/dashboard/tables">Table QR codes</Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
