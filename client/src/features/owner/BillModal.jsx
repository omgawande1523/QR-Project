import { Printer } from 'lucide-react';
import { Button, Modal } from '../../components/ui';
import { formatPrice, formatDateTime } from '../../lib/format';
import { toPaise, toRupees } from '../../lib/pricing';
import { useOwner } from './OwnerContext';

// Printable customer receipt (window.print; only .print-area is printed).
export function ReceiptModal({ order, onClose }) {
  const { profile } = useOwner();
  if (!order) return null;
  // Split GST into CGST + SGST in whole paise so the two lines always add up to the tax.
  const taxPaise = toPaise(order.taxAmount || 0);
  const split = { cgst: toRupees(Math.floor(taxPaise / 2)), sgst: toRupees(taxPaise - Math.floor(taxPaise / 2)) };
  return (
    <Modal
      open
      onClose={onClose}
      title="Receipt"
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button icon={<Printer size={18} />} onClick={() => window.print()}>Print</Button></>}
    >
      <div className="receipt print-area">
        <h3>{profile?.restaurantName}</h3>
        {profile?.address && <p>{profile.address}</p>}
        {profile?.gstin && <p>GSTIN {profile.gstin}</p>}
        <hr />
        <p>Order #{String(order._id).slice(-6).toUpperCase()} · Table {order.tableNumber}</p>
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
            <div className="receipt-row"><span>CGST {order.taxPercent / 2}%</span><span>{formatPrice(split.cgst)}</span></div>
            <div className="receipt-row"><span>SGST {order.taxPercent / 2}%</span><span>{formatPrice(split.sgst)}</span></div>
          </>
        )}
        <div className="receipt-row receipt-total"><span>Total</span><span>{formatPrice(order.totalAmount)}</span></div>
        <p className="receipt-thanks">Thank you! Visit again.</p>
      </div>
    </Modal>
  );
}
