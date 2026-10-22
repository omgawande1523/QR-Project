import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Receipt, CheckCircle2, ChevronRight, ChevronLeft, Smartphone } from 'lucide-react';
import { useCustomer } from './CustomerContext';
import { Button, Card, IconButton, useToast } from '../../components/ui';
import { formatPrice } from '../../lib/format';
import { errorMessage } from '../../lib/api';
import { upiPayLink } from '../../lib/invoice';
import { visitBill } from '../../lib/visitBill';

// This visit's running bill (orders from this phone today), shared by the welcome screen, the menu bar
// and the bill page. Re-computed live as order updates arrive over the socket.
export function useVisitBill() {
  const { trackedOrders } = useCustomer();
  return useMemo(() => visitBill(trackedOrders), [trackedOrders]);
}

const STATE_LABEL = { open: 'Unpaid', billed: 'Ready to pay', paid: 'Paid' };

// Pay-by-UPI QR for the amount due; the QR library is only loaded when there is something to pay.
function UpiPay({ restaurant, bill }) {
  const [qr, setQr] = useState(null);
  const link = upiPayLink({
    upiId: restaurant.upiId,
    payeeName: restaurant.restaurantName,
    amount: bill.due,
    note: bill.invoiceNumbers.length ? `Invoice ${bill.invoiceNumbers.join(', ')}` : `Table ${bill.tables.join(', ')}`
  });
  useEffect(() => {
    let cancelled = false;
    import('../../lib/tableCards')
      .then(({ qrCanvas }) => qrCanvas(link, { size: 360 }))
      .then((canvas) => !cancelled && setQr(canvas.toDataURL('image/png')))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [link]);
  return (
    <div className="visit-bill-upi">
      {qr && <img src={qr} alt={`UPI QR code to pay ${formatPrice(bill.due)} to ${restaurant.restaurantName}`} width="168" height="168" />}
      <p className="text-sm">Scan with any UPI app, or pay from this phone:</p>
      <Button href={link} variant="accent" icon={<Smartphone size={18} />}>Pay {formatPrice(bill.due)} with UPI</Button>
      <p className="muted text-xs">UPI ID {restaurant.upiId} · Show the payment to your waiter.</p>
    </div>
  );
}

/** The full bill: items, totals, what is paid and due, "Ask for bill" and, once billed, UPI payment. */
export function VisitBillCard({ bill, headingLevel = 2 }) {
  const { restaurant, table, requestService } = useCustomer();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState(false);
  const Heading = `h${headingLevel}`;

  const askForBill = async () => {
    setAsking(true);
    try {
      await requestService('Bill');
      setAsked(true);
      toast.success('We are bringing your bill');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not ask for the bill'));
    } finally {
      setAsking(false);
    }
  };

  return (
    <Card className={`visit-bill is-${bill.state}`} aria-labelledby="visit-bill-title">
      <div className="visit-bill-head">
        <Heading id="visit-bill-title" className="card-title"><Receipt size={20} aria-hidden="true" /> Your bill</Heading>
        <span className={`visit-bill-state is-${bill.state}`}>{STATE_LABEL[bill.state]}</span>
      </div>
      <p className="muted text-xs">
        Table {bill.tables.join(', ')} · {bill.orders.length} order{bill.orders.length === 1 ? '' : 's'} from this phone today
      </p>

      <ul className="visit-bill-lines">
        {bill.lines.map((line) => (
          <li key={line.key} className="kv">
            <span>
              {line.quantity} × {line.name}
              {line.options && <span className="muted text-xs" style={{ display: 'block' }}>{line.options}</span>}
            </span>
            <span>{formatPrice(line.amount)}</span>
          </li>
        ))}
      </ul>
      <hr className="divider" />
      <div className="kv"><span>Subtotal</span><span>{formatPrice(bill.subtotal)}</span></div>
      {bill.serviceCharge > 0 && <div className="kv"><span>Service charge{bill.serviceChargePercent ? ` (${bill.serviceChargePercent}%)` : ''}</span><span>{formatPrice(bill.serviceCharge)}</span></div>}
      {bill.tax > 0 && <div className="kv"><span>GST{bill.taxPercent ? ` (${bill.taxPercent}%)` : ''}</span><span>{formatPrice(bill.tax)}</span></div>}
      <div className="kv kv-total"><span>Total</span><span>{formatPrice(bill.total)}</span></div>
      {bill.paid > 0 && bill.due > 0 && (
        <>
          <div className="kv"><span>Paid</span><span>− {formatPrice(bill.paid)}</span></div>
          <div className="kv kv-total"><span>To pay</span><span>{formatPrice(bill.due)}</span></div>
        </>
      )}
      {bill.invoiceNumbers.length > 0 && <p className="muted text-xs">Invoice {bill.invoiceNumbers.join(', ')}</p>}

      {bill.state === 'paid' && (
        <p className="visit-bill-paid" role="status"><CheckCircle2 size={20} aria-hidden="true" /> Paid. Thank you, visit again!</p>
      )}
      {bill.state === 'billed' && restaurant?.upiId && <UpiPay restaurant={restaurant} bill={bill} />}
      {bill.state === 'billed' && !restaurant?.upiId && <p className="text-sm">Your bill is ready. Please pay at the counter or to your waiter.</p>}
      {bill.state === 'open' && (
        <div className="visit-bill-actions">
          <Button variant="secondary" icon={<Receipt size={18} />} onClick={askForBill} loading={asking} disabled={asked || !(table || bill.tables[0])}>
            {asked ? 'Bill requested' : 'Ask for bill'}
          </Button>
          <p className="muted text-xs">Pay at the counter or to your waiter after your meal.</p>
        </div>
      )}
    </Card>
  );
}

/** Compact bar for the menu page: what is due, and a link to the full bill. */
export function VisitBillBar({ bill }) {
  const { restaurantId } = useCustomer();
  return (
    <Link to={`/menu/${restaurantId}/bill`} className={`visit-bill-bar is-${bill.state}`}>
      <Receipt size={18} aria-hidden="true" />
      <span className="grow">
        Your bill · <strong>{formatPrice(bill.state === 'paid' ? bill.total : bill.due)}</strong>
        <span className="visit-bill-bar-state"> {bill.state === 'paid' ? 'paid' : bill.state === 'billed' ? 'ready to pay' : 'so far'}</span>
      </span>
      <span className="visit-bill-bar-link">View <ChevronRight size={16} aria-hidden="true" /></span>
    </Link>
  );
}

/** /menu/:id/bill */
export default function BillScreen() {
  const { restaurantId } = useCustomer();
  const bill = useVisitBill();
  const navigate = useNavigate();
  return (
    <main className="customer-page page-enter">
      <header className="page-header">
        <IconButton label="Back to the menu" onClick={() => navigate(`/menu/${restaurantId}/browse`)}><ChevronLeft size={22} /></IconButton>
        <h1>Your bill</h1>
        <span />
      </header>
      {bill ? <VisitBillCard bill={bill} /> : (
        <Card className="stack-sm">
          <p>No orders from this phone today yet.</p>
          <Button to={`/menu/${restaurantId}/browse`}>Browse the menu</Button>
        </Card>
      )}
    </main>
  );
}
