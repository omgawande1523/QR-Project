import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router';
import { ChevronLeft, ClipboardCheck, CookingPot, BellRing, HandPlatter, ConciergeBell, Receipt, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';
import { useCustomer } from './CustomerContext';
import { Button, IconButton, Card, EmptyState, Skeleton, useToast } from '../../components/ui';
import { CUSTOMER_STEPS, customerStepIndex, STATUS_LABEL } from '../../lib/orderStatus';
import { formatPrice, formatTime } from '../../lib/format';
import { errorMessage } from '../../lib/api';
import { shortId } from './OrdersScreen';
import { FeedbackCard } from './FeedbackCard';
import { canRate } from '../../lib/feedback';

const STEP_ICONS = [ClipboardCheck, CookingPot, BellRing, HandPlatter];

export default function OrderTrackingScreen() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { openWaiter } = useOutletContext();
  const { restaurantId, orders, reorder, requestService, table } = useCustomer();
  const order = orders[orderId];
  const justPlaced = location.state?.justPlaced;
  const [askingBill, setAskingBill] = useState(false);
  const previousStatus = useRef(order?.status);

  // Announce live status changes.
  useEffect(() => {
    if (!order) return;
    if (previousStatus.current && previousStatus.current !== order.status) {
      toast.info(`Order #${shortId(order._id)}: ${STATUS_LABEL[order.status]}`);
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    }
    previousStatus.current = order.status;
  }, [order, toast]);

  if (!order) {
    return (
      <main className="customer-page">
        <Skeleton height={48} style={{ marginTop: 16 }} />
        <Skeleton height={220} radius="var(--radius-card)" style={{ marginTop: 16 }} />
        <p className="muted text-sm" style={{ marginTop: 16 }}>
          Looking for your order… If it does not appear, it was placed from another phone.
        </p>
        <Button variant="ghost" to={`/menu/${restaurantId}/orders`}>All orders</Button>
      </main>
    );
  }

  const cancelled = order.status === 'cancelled';
  const step = customerStepIndex(order.status);
  const current = CUSTOMER_STEPS[step];

  const askForBill = async () => {
    setAskingBill(true);
    try {
      await requestService('Bill');
      toast.success('We are bringing your bill');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not ask for the bill'));
    } finally {
      setAskingBill(false);
    }
  };

  const again = () => {
    const skipped = reorder(order);
    if (skipped) toast.info(`${skipped} item(s) are no longer available and were skipped`);
    navigate(`/menu/${restaurantId}/cart`);
  };

  return (
    <main className="customer-page tracking-page page-enter">
      <header className="page-header">
        <IconButton label="All orders" onClick={() => navigate(`/menu/${restaurantId}/orders`)}><ChevronLeft size={22} /></IconButton>
        <h1>Order #{shortId(order._id)}</h1>
        <span />
      </header>

      {justPlaced && !cancelled && (
        <div className="placed-banner" role="status">
          <CheckCircle2 size={28} aria-hidden="true" />
          <div>
            <strong>Order placed!</strong>
            <p className="text-sm">The kitchen has it. This page updates live.</p>
          </div>
        </div>
      )}

      {cancelled ? (
        <EmptyState icon={<XCircle size={30} />} title="This order was cancelled">
          Please ask your waiter if you have any questions.
        </EmptyState>
      ) : (
        <Card className="tracking-card">
          <p className="tracking-status">{current.label}</p>
          <p className="muted">{current.hint}</p>
          <ol className="timeline">
            {CUSTOMER_STEPS.map((s, i) => {
              const Icon = STEP_ICONS[i];
              const state = i < step ? 'done' : i === step ? 'current' : 'upcoming';
              return (
                <li key={s.key} className={`timeline-step is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                  <span className="timeline-icon" aria-hidden="true"><Icon size={18} /></span>
                  <span className="timeline-label">{s.label}</span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {canRate(order) && <FeedbackCard order={order} />}

      <div className="tracking-actions">
        <Button variant="secondary" icon={<ConciergeBell size={18} />} onClick={openWaiter}>Call waiter</Button>
        <Button variant="secondary" icon={<Receipt size={18} />} onClick={askForBill} loading={askingBill} disabled={!table && !order.tableNumber}>Ask for bill</Button>
        <Button variant="accent" icon={<RotateCcw size={18} />} onClick={again}>Reorder</Button>
      </div>

      <Card>
        <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
          <h2 className="card-title">Items</h2>
          <span className="muted text-sm">Table {order.tableNumber} · {formatTime(order.createdAt)}</span>
        </div>
        <ul className="receipt-lines">
          {order.items.map((item, i) => (
            <li key={item._id || i} className="kv">
              <span>
                {item.quantity} × {item.menuItemName}
                {(item.variant?.name || item.addOns?.length > 0) && (
                  <span className="muted text-xs" style={{ display: 'block' }}>
                    {[item.variant?.name, ...(item.addOns || []).map((a) => a.name)].filter(Boolean).join(' · ')}
                  </span>
                )}
                {item.notes && <span className="muted text-xs" style={{ display: 'block' }}>“{item.notes}”</span>}
              </span>
              <span>{formatPrice(item.lineTotal ?? item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <hr className="divider" />
        {order.subtotal !== undefined && <div className="kv"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>}
        {order.serviceChargeAmount > 0 && <div className="kv"><span>Service charge ({order.serviceChargePercent}%)</span><span>{formatPrice(order.serviceChargeAmount)}</span></div>}
        {order.taxAmount > 0 && <div className="kv"><span>GST ({order.taxPercent}%)</span><span>{formatPrice(order.taxAmount)}</span></div>}
        <div className="kv kv-total"><span>Total</span><span>{formatPrice(order.totalAmount)}</span></div>
      </Card>
    </main>
  );
}
