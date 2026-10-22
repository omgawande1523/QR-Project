import { toPaise, toRupees } from './pricing';

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const optionsOf = (item) => [item.variant?.name, ...(item.addOns || []).map((a) => a.name)].filter(Boolean).join(' · ');
const sum = (orders, field) => orders.reduce((total, o) => total + toPaise(o[field] || 0), 0);
const single = (values) => (new Set(values).size === 1 ? values[0] : null);

/**
 * The guest's running bill for this visit: every order placed from this phone today that was not
 * cancelled, with the same dish (and options) merged into one line. Amounts come from the server's priced
 * orders, so they match the restaurant's bills.
 *
 * state: 'open'   something is unpaid and the restaurant has not made the bill for all of it yet
 *        'billed' everything unpaid has an invoice number: the guest can pay (UPI QR)
 *        'paid'   nothing left to pay
 */
export function visitBill(orders, now = new Date()) {
  const visit = orders
    .filter((o) => o.status !== 'cancelled' && sameDay(o.createdAt, now))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (visit.length === 0) return null;

  const lines = new Map();
  for (const order of visit) {
    for (const item of order.items) {
      const options = optionsOf(item);
      const key = `${item.menuItemName}|${options}|${toPaise(item.price)}`;
      const line = lines.get(key) || { key, name: item.menuItemName, options, quantity: 0, paise: 0 };
      line.quantity += item.quantity;
      line.paise += toPaise(item.lineTotal ?? item.price * item.quantity);
      lines.set(key, line);
    }
  }

  const unpaid = visit.filter((o) => !o.payment?.paidAt);
  const totalPaise = sum(visit, 'totalAmount');
  const duePaise = sum(unpaid, 'totalAmount');
  const state = duePaise === 0 ? 'paid' : unpaid.every((o) => o.invoiceNumber) ? 'billed' : 'open';

  return {
    orders: visit,
    lines: [...lines.values()].map(({ paise, ...line }) => ({ ...line, amount: toRupees(paise) })),
    subtotal: toRupees(sum(visit, 'subtotal')),
    serviceCharge: toRupees(sum(visit, 'serviceChargeAmount')),
    tax: toRupees(sum(visit, 'taxAmount')),
    total: toRupees(totalPaise),
    paid: toRupees(totalPaise - duePaise),
    due: toRupees(duePaise),
    serviceChargePercent: single(visit.map((o) => o.serviceChargePercent || 0)),
    taxPercent: single(visit.map((o) => o.taxPercent || 0)),
    invoiceNumbers: [...new Set(unpaid.map((o) => o.invoiceNumber).filter(Boolean))],
    tables: [...new Set(visit.map((o) => o.tableNumber))],
    state
  };
}
