import { useEffect, useState } from 'react';
import { Printer, FileDown, ReceiptText, CheckCircle2, Banknote, Smartphone, CreditCard } from 'lucide-react';
import { Button, Modal, TextField, useToast } from '../../components/ui';
import { formatPrice, formatDateTime } from '../../lib/format';
import { api, errorMessage } from '../../lib/api';
import { qrCanvas } from '../../lib/tableCards';
import { PAYMENT_LABEL, RESTAURANT_SAC, downloadInvoicePdf, gstBreakdown, invoiceTitle, placeOfSupply, shortOrderId, upiPayLink } from '../../lib/invoice';
import { useOwner } from './OwnerContext';

const METHODS = [
  { value: 'cash', icon: Banknote },
  { value: 'upi', icon: Smartphone },
  { value: 'card', icon: CreditCard }
];

// UPI QR (PNG data URL) for an unpaid bill, or null when the restaurant has no UPI ID.
function useUpiQr(order, profile) {
  const [qr, setQr] = useState(null);
  const unpaid = order && !order.payment?.paidAt && order.status !== 'cancelled';
  const link = unpaid && profile?.upiId
    ? upiPayLink({ upiId: profile.upiId, payeeName: profile.restaurantName, amount: order.totalAmount, note: order.invoiceNumber ? `Invoice ${order.invoiceNumber}` : `Order ${shortOrderId(order._id)}` })
    : null;
  useEffect(() => {
    let cancelled = false;
    if (!link) { setQr(null); return undefined; }
    qrCanvas(link, { size: 360 }).then((canvas) => !cancelled && setQr(canvas.toDataURL('image/png')));
    return () => { cancelled = true; };
  }, [link]);
  return qr;
}

// The bill for one order: printable 80 mm receipt, A4 GST invoice PDF, and "mark paid".
export function BillModal({ order: initial, onClose }) {
  const { profile, replaceOrder } = useOwner();
  const toast = useToast();
  const [order, setOrder] = useState(initial);
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState('');
  const qr = useUpiQr(order, profile);

  useEffect(() => {
    setOrder(initial);
    setMethod('cash');
    setReference('');
  }, [initial]);

  if (!order) return null;
  const paid = Boolean(order.payment?.paidAt);
  const cancelled = order.status === 'cancelled';
  const gst = gstBreakdown(order);
  const title = order.invoiceNumber ? invoiceTitle(profile) : 'Receipt';

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(''); }
  };

  const makeBill = () => run('bill', async () => {
    const res = await api.post(`/api/orders/${order._id}/invoice`);
    setOrder(res.data);
    replaceOrder(res.data);
  });

  const markPaid = () => run('pay', async () => {
    const res = await api.post(`/api/orders/${order._id}/pay`, { method, reference: reference.trim() || undefined });
    setOrder(res.data);
    replaceOrder(res.data);
    toast.success(`Paid by ${PAYMENT_LABEL[method]} · ${formatPrice(res.data.totalAmount)}`);
  });

  const downloadPdf = () => run('pdf', () => downloadInvoicePdf({ order, profile, qrDataUrl: qr }));

  return (
    <Modal
      open
      onClose={onClose}
      title={`${title} · T${order.tableNumber}`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {order.invoiceNumber
            ? <Button variant="secondary" icon={<FileDown size={18} />} onClick={downloadPdf} loading={busy === 'pdf'}>PDF</Button>
            : !cancelled && <Button variant="secondary" icon={<ReceiptText size={18} />} onClick={makeBill} loading={busy === 'bill'}>Make bill</Button>}
          <Button icon={<Printer size={18} />} onClick={() => window.print()}>Print</Button>
        </>
      )}
    >
      {!cancelled && (
        <section className="bill-payment no-print" aria-label="Payment">
          {paid ? (
            <p className="bill-paid"><CheckCircle2 size={20} aria-hidden="true" /> Paid by {PAYMENT_LABEL[order.payment.method]} · {formatDateTime(order.payment.paidAt)}</p>
          ) : (
            <>
              <h3 className="bill-payment-title">Take payment</h3>
              <div className="segmented bill-methods" role="group" aria-label="Payment method">
                {METHODS.map(({ value, icon: Icon }) => (
                  <button key={value} type="button" aria-pressed={method === value} onClick={() => setMethod(value)}>
                    <Icon size={16} aria-hidden="true" /> {PAYMENT_LABEL[value]}
                  </button>
                ))}
              </div>
              {method !== 'cash' && (
                <TextField label={method === 'upi' ? 'UPI reference (optional)' : 'Card slip number (optional)'} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} />
              )}
              <Button block onClick={markPaid} loading={busy === 'pay'}>Mark paid · {formatPrice(order.totalAmount)}</Button>
              {!['served', 'billed'].includes(order.status) && <p className="muted text-xs">Paid in advance: the order stays on the board until it is served.</p>}
            </>
          )}
        </section>
      )}
      <div className="receipt print-area">
        <h3>{profile?.restaurantName}</h3>
        {profile?.address && <p>{profile.address}</p>}
        {profile?.gstin && <p>GSTIN {profile.gstin}</p>}
        {order.invoiceNumber && (
          <>
            <hr />
            <p className="receipt-title">{title.toUpperCase()}</p>
            <div className="receipt-row"><span>Invoice no.</span><span>{order.invoiceNumber}</span></div>
            <div className="receipt-row"><span>Date</span><span>{formatDateTime(order.invoicedAt || order.createdAt)}</span></div>
            {profile?.gstin && <div className="receipt-row"><span>Place of supply</span><span>{placeOfSupply(profile.gstin)}</span></div>}
          </>
        )}
        <hr />
        <p>Order #{shortOrderId(order._id)} · Table {order.tableNumber}</p>
        <p>{formatDateTime(order.createdAt)}{order.customerName ? ` · ${order.customerName}` : ''}</p>
        <hr />
        {order.items.map((item, i) => (
          <div key={item._id || i} className="receipt-row">
            <span>
              {item.quantity} × {item.menuItemName}
              {(item.variant?.name || item.addOns?.length > 0) && <small>{[item.variant?.name, ...(item.addOns || []).map((a) => a.name)].filter(Boolean).join(', ')}</small>}
            </span>
            <span>{formatPrice(item.lineTotal ?? item.price * item.quantity)}</span>
          </div>
        ))}
        <hr />
        {order.subtotal !== undefined && <div className="receipt-row"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>}
        {order.serviceChargeAmount > 0 && <div className="receipt-row"><span>Service charge {order.serviceChargePercent}%</span><span>{formatPrice(order.serviceChargeAmount)}</span></div>}
        {order.taxAmount > 0 && (
          <>
            <div className="receipt-row"><span>Taxable value (SAC {RESTAURANT_SAC})</span><span>{formatPrice(gst.taxable)}</span></div>
            <div className="receipt-row"><span>CGST {gst.halfRate}%</span><span>{formatPrice(gst.cgst)}</span></div>
            <div className="receipt-row"><span>SGST {gst.halfRate}%</span><span>{formatPrice(gst.sgst)}</span></div>
          </>
        )}
        <div className="receipt-row receipt-total"><span>Total</span><span>{formatPrice(order.totalAmount)}</span></div>
        {paid && <p className="receipt-paid">PAID · {PAYMENT_LABEL[order.payment.method]}{order.payment.reference ? ` · ${order.payment.reference}` : ''}</p>}
        {!paid && qr && (
          <div className="receipt-qr">
            <img src={qr} alt={`UPI QR code to pay ${formatPrice(order.totalAmount)}`} width={140} height={140} />
            <p>Scan to pay with any UPI app<br />{profile.upiId}</p>
          </div>
        )}
        <p className="receipt-thanks">Thank you! Visit again.</p>
      </div>

    </Modal>
  );
}
