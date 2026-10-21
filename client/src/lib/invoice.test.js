import { describe, expect, test } from 'vitest';
import { amountInWords, gstBreakdown, invoiceTitle, placeOfSupply, upiPayLink } from './invoice';

describe('amountInWords', () => {
  test.each([
    [0, 'Rupees Zero Only'],
    [7, 'Rupees Seven Only'],
    [115, 'Rupees One Hundred Fifteen Only'],
    [1234.5, 'Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only'],
    [100000, 'Rupees One Lakh Only'],
    [12345678.09, 'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Nine Paise Only']
  ])('%s', (amount, words) => expect(amountInWords(amount)).toBe(words));
});

describe('gstBreakdown', () => {
  test('splits an odd number of paise so CGST + SGST equals the tax', () => {
    const gst = gstBreakdown({ subtotal: 100, serviceChargeAmount: 5.25, taxPercent: 5, taxAmount: 5.27 });
    expect(gst).toEqual({ taxable: 105.25, halfRate: 2.5, cgst: 2.63, sgst: 2.64 });
  });
});

test('place of supply comes from the GSTIN state code', () => {
  expect(placeOfSupply('27ABCDE1234F1Z5')).toBe('27 - Maharashtra');
  expect(placeOfSupply('07ABCDE1234F1Z5')).toBe('07 - Delhi');
  expect(placeOfSupply('')).toBe('');
});

test('only a restaurant with a GSTIN issues a tax invoice', () => {
  expect(invoiceTitle({ gstin: '27ABCDE1234F1Z5' })).toBe('Tax Invoice');
  expect(invoiceTitle({})).toBe('Bill');
});

test('UPI link carries payee, amount with paise and a note', () => {
  const link = upiPayLink({ upiId: 'cafe@okaxis', payeeName: 'Cafe Shiv & Co', amount: 236.5, note: 'Invoice 2026-27/000001' });
  expect(link.startsWith('upi://pay?')).toBe(true);
  const params = new URLSearchParams(link.slice('upi://pay?'.length));
  expect(Object.fromEntries(params)).toEqual({ pa: 'cafe@okaxis', pn: 'Cafe Shiv & Co', am: '236.50', cu: 'INR', tn: 'Invoice 2026-27/000001' });
  expect(link).not.toContain('+');
});
