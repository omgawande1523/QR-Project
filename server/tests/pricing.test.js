const { priceOrder } = require('../src/services/pricing');

const item = (overrides) => ({ _id: 'item1', name: 'Chai', price: 33.33, available: true, variants: [], addOns: [], ...overrides });
const menu = (...items) => new Map(items.map((i) => [i._id, i]));

describe('priceOrder', () => {
  test('rounds to whole paise without floating-point drift', () => {
    const result = priceOrder({ taxPercent: 5 }, menu(item()), [{ menuItem: 'item1', quantity: 3 }]);
    expect(result.subtotal).toBe(99.99);
    expect(result.taxAmount).toBe(5); // 4.9995 rounds to 5.00
    expect(result.totalAmount).toBe(104.99);
  });

  test('0.1 + 0.2 style prices still add up exactly', () => {
    const a = item({ _id: 'a', price: 0.1 });
    const b = item({ _id: 'b', price: 0.2 });
    const result = priceOrder({}, menu(a, b), [{ menuItem: 'a', quantity: 1 }, { menuItem: 'b', quantity: 1 }]);
    expect(result.totalAmount).toBe(0.3);
  });

  test('no tax or service charge by default', () => {
    const result = priceOrder({}, menu(item({ price: 100 })), [{ menuItem: 'item1', quantity: 1 }]);
    expect(result).toMatchObject({ subtotal: 100, taxAmount: 0, serviceChargeAmount: 0, totalAmount: 100 });
  });

  test('throws for an id that is not in the menu map', () => {
    expect(() => priceOrder({}, menu(item()), [{ menuItem: 'other', quantity: 1 }])).toThrow(/no longer on this menu/);
  });
});
