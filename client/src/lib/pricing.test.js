import { unitPricePaise, computeBill, toPaise } from './pricing';
import { formatPrice } from './format';

const curry = {
  price: 300,
  variants: [{ _id: 'half', name: 'Half', price: 180 }, { _id: 'full', name: 'Full', price: 300 }],
  addOns: [{ _id: 'butter', name: 'Extra butter', price: 30 }, { _id: 'roti', name: 'Rumali roti', price: 25 }]
};

describe('unitPricePaise', () => {
  test('uses the base price for an item without options', () => {
    expect(unitPricePaise({ price: 120 })).toBe(12000);
  });

  test('a variant replaces the base price and add-ons are added', () => {
    expect(unitPricePaise(curry, 'half', ['butter', 'roti'])).toBe(23500);
  });

  test('returns null when a required variant is missing or an option no longer exists', () => {
    expect(unitPricePaise(curry, undefined)).toBeNull();
    expect(unitPricePaise(curry, 'gone')).toBeNull();
    expect(unitPricePaise(curry, 'full', ['gone'])).toBeNull();
    expect(unitPricePaise({ price: 50 }, 'half')).toBeNull();
  });
});

describe('computeBill (same maths as the server)', () => {
  test('service charge then GST on subtotal + service charge', () => {
    const bill = computeBill([{ unitPaise: toPaise(460), quantity: 1 }], { taxPercent: 5, serviceChargePercent: 10 });
    expect(bill).toMatchObject({ subtotal: 460, serviceCharge: 46, tax: 25.3, total: 531.3 });
  });

  test('rounds to whole paise like the server', () => {
    const bill = computeBill([{ unitPaise: toPaise(33.33), quantity: 3 }], { taxPercent: 5 });
    expect(bill).toMatchObject({ subtotal: 99.99, tax: 5, total: 104.99 });
  });

  test('no tax or service charge by default', () => {
    expect(computeBill([{ unitPaise: 10000, quantity: 2 }]).total).toBe(200);
  });
});

describe('formatPrice', () => {
  test('shows rupees without paise when whole and two decimals otherwise', () => {
    expect(formatPrice(120)).toBe('₹120');
    expect(formatPrice(25.3)).toBe('₹25.30');
    expect(formatPrice(1234.5)).toBe('₹1,234.50');
  });
});
