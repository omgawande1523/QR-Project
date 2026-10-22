import { describe, expect, test } from 'vitest';
import { visitBill } from './visitBill';

const NOW = new Date('2026-10-22T13:30:00');
const order = (id, items, extra = {}) => {
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const tax = Math.round(subtotal * 5) / 100;
  return {
    _id: id, status: 'served', tableNumber: 3, createdAt: '2026-10-22T12:00:00', items,
    subtotal, serviceChargePercent: 0, serviceChargeAmount: 0, taxPercent: 5, taxAmount: tax, totalAmount: subtotal + tax, ...extra
  };
};
const chai = (quantity) => ({ menuItemName: 'Masala Chai', price: 40, quantity, lineTotal: 40 * quantity });
const curryFull = { menuItemName: 'Chicken Curry', price: 340, quantity: 1, lineTotal: 340, variant: { name: 'Full', price: 320 }, addOns: [{ name: 'Extra butter', price: 20 }] };

describe('visitBill', () => {
  test('nothing ordered today means no bill', () => {
    expect(visitBill([], NOW)).toBeNull();
    expect(visitBill([order('old', [chai(1)], { createdAt: '2026-10-21T20:00:00' })], NOW)).toBeNull();
    expect(visitBill([order('x', [chai(1)], { status: 'cancelled' })], NOW)).toBeNull();
  });

  test('merges the same dish across orders and adds up the totals in whole paise', () => {
    const bill = visitBill([order('a', [chai(2), curryFull]), order('b', [chai(1)], { createdAt: '2026-10-22T12:40:00' })], NOW);
    expect(bill.lines).toEqual([
      { key: 'Masala Chai||4000', name: 'Masala Chai', options: '', quantity: 3, amount: 120 },
      { key: 'Chicken Curry|Full · Extra butter|34000', name: 'Chicken Curry', options: 'Full · Extra butter', quantity: 1, amount: 340 }
    ]);
    expect(bill).toMatchObject({ subtotal: 460, tax: 23, total: 483, paid: 0, due: 483, taxPercent: 5, state: 'open' });
  });

  test('a cancelled order is left out', () => {
    const bill = visitBill([order('a', [chai(1)]), order('b', [curryFull], { status: 'cancelled' })], NOW);
    expect(bill.total).toBe(42);
    expect(bill.orders.map((o) => o._id)).toEqual(['a']);
  });

  test('billed once every unpaid order has an invoice number; paid orders count as paid', () => {
    const paid = order('a', [chai(1)], { status: 'complete', invoiceNumber: '2026-27/000010', payment: { method: 'cash', paidAt: '2026-10-22T12:30:00' } });
    const open = order('b', [chai(2)]);
    expect(visitBill([paid, open], NOW)).toMatchObject({ state: 'open', paid: 42, due: 84, invoiceNumbers: [] });

    const billed = visitBill([paid, { ...open, status: 'billed', invoiceNumber: '2026-27/000011' }], NOW);
    expect(billed).toMatchObject({ state: 'billed', due: 84, invoiceNumbers: ['2026-27/000011'] });

    const done = visitBill([paid, { ...open, status: 'complete', invoiceNumber: '2026-27/000011', payment: { method: 'upi', paidAt: NOW } }], NOW);
    expect(done).toMatchObject({ state: 'paid', due: 0, paid: 126 });
  });

  test('different rates across orders are not summarised as one rate', () => {
    const bill = visitBill([order('a', [chai(1)]), order('b', [chai(1)], { taxPercent: 12 })], NOW);
    expect(bill.taxPercent).toBeNull();
  });
});
