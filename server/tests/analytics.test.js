const request = require('supertest');
const db = require('./helpers/db');
const createApp = require('../src/app');
const Order = require('../src/models/Order');
const User = require('../src/models/User');
const { registerOwner, auth, createMenuItem } = require('./helpers/factory');
const { indiaToday } = require('../src/services/analytics');

const app = createApp();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

// An order placed at an India local time ("2026-10-19T21:30"), with lines [item, quantity, unit price].
function order(owner, istTime, lines, extra = {}) {
  const items = lines.map(([item, quantity, price]) => ({ menuItem: item._id, menuItemName: item.name, price, quantity, lineTotal: price * quantity }));
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  return Order.create({
    restaurantId: owner.userId,
    tableNumber: 1,
    items,
    subtotal,
    totalAmount: subtotal,
    status: 'complete',
    createdAt: new Date(`${istTime}:00+05:30`),
    ...extra
  });
}

const report = (token, query) => request(app).get('/api/analytics').query(query).set(auth(token));

describe('sales analytics', () => {
  test('totals, days, weeks, items, categories, peak hours and tables for a date range', async () => {
    const owner = await registerOwner(app, { tables: [1, 2, 3] });
    const tikka = await createMenuItem(app, owner.token, { name: 'Paneer Tikka', price: 250, category: 'Starters' });
    const chai = await createMenuItem(app, owner.token, { name: 'Masala Chai', price: 30, category: 'Beverages' });
    const naan = await createMenuItem(app, owner.token, { name: 'Butter Naan', price: 45, category: 'Breads' });

    await order(owner, '2026-10-19T21:30', [[tikka, 2, 250], [chai, 2, 30]]); // Monday night
    await order(owner, '2026-10-20T00:15', [[chai, 1, 30.5]], { tableNumber: 2 }); // just after midnight in India (still the 19th in UTC)
    await order(owner, '2026-10-20T13:05', [[naan, 4, 45]], { tableNumber: 2, status: 'pending' });
    await order(owner, '2026-10-21T13:40', [[tikka, 1, 250]], { status: 'cancelled' });
    await order(owner, '2026-10-26T12:00', [[chai, 3, 30]], { tableNumber: 3 }); // next Monday
    await order(owner, '2026-10-12T19:00', [[tikka, 1, 250]]); // previous period
    await order(owner, '2026-10-27T10:00', [[tikka, 9, 250]]); // after the range
    await User.updateOne({ _id: owner.userId }, { $set: { 'tableStats.1': 12, 'tableStats.2': 4 } });

    const res = await report(owner.token, { from: '2026-10-19', to: '2026-10-26' });
    expect(res.status).toBe(200);
    const body = res.body;

    expect(body.range).toEqual({ from: '2026-10-19', to: '2026-10-26', days: 8, timeZone: 'Asia/Kolkata' });
    expect(body.totals).toEqual({ orders: 4, revenue: 860.5, averageOrder: 215.13, itemsSold: 12, cancelled: 1 });
    expect(body.previous).toMatchObject({ from: '2026-10-11', to: '2026-10-18', orders: 1, revenue: 250 });

    expect(body.days).toHaveLength(8);
    expect(body.days[0]).toEqual({ date: '2026-10-19', orders: 1, revenue: 560 });
    expect(body.days[1]).toEqual({ date: '2026-10-20', orders: 2, revenue: 210.5 });
    expect(body.days[2]).toEqual({ date: '2026-10-21', orders: 0, revenue: 0 });
    expect(body.weeks).toEqual([
      { weekStart: '2026-10-19', orders: 3, revenue: 770.5 },
      { weekStart: '2026-10-26', orders: 1, revenue: 90 }
    ]);

    expect(body.items.map((i) => [i.name, i.quantity, i.revenue])).toEqual([
      ['Paneer Tikka', 2, 500],
      ['Masala Chai', 6, 180.5],
      ['Butter Naan', 4, 180]
    ]);
    expect(body.categories.map((c) => [c.category, c.revenue])).toEqual([['Starters', 500], ['Beverages', 180.5], ['Breads', 180]]);

    // Monday (1) 21:00 and Tuesday (2) 00:00 in India time
    expect(body.hours).toEqual(expect.arrayContaining([
      { day: 1, hour: 21, orders: 1, revenue: 560 },
      { day: 2, hour: 0, orders: 1, revenue: 30.5 },
      { day: 2, hour: 13, orders: 1, revenue: 180 }
    ]));
    expect(body.tables).toEqual([
      { table: 1, orders: 1, revenue: 560, scans: 12 },
      { table: 2, orders: 2, revenue: 210.5, scans: 4 },
      { table: 3, orders: 1, revenue: 90, scans: 0 }
    ]);
  });

  test('defaults to the last 7 days in India time and reports payments', async () => {
    const owner = await registerOwner(app);
    const chai = await createMenuItem(app, owner.token, { name: 'Masala Chai', price: 30 });
    await order(owner, `${indiaToday()}T00:30`, [[chai, 2, 30]], { payment: { method: 'upi', paidAt: new Date() } });
    const res = await report(owner.token, {});
    expect(res.body.range.days).toBe(7);
    expect(res.body.range.to).toBe(indiaToday());
    expect(res.body.totals.revenue).toBe(60);
    expect(res.body.payments).toEqual([{ method: 'upi', orders: 1, revenue: 60 }]);
  });

  test('a deleted dish keeps its sales under "Uncategorised"', async () => {
    const owner = await registerOwner(app);
    const gone = await createMenuItem(app, owner.token, { name: 'Old Special', price: 100, category: 'Mains' });
    await request(app).delete(`/api/menu/${gone._id}`).set(auth(owner.token));
    await order(owner, '2026-10-20T13:00', [[gone, 1, 100]]);
    const res = await report(owner.token, { from: '2026-10-20', to: '2026-10-20' });
    expect(res.body.items[0]).toMatchObject({ name: 'Old Special', category: 'Uncategorised' });
  });

  test('only counts your own restaurant', async () => {
    const owner = await registerOwner(app);
    const other = await registerOwner(app);
    const chai = await createMenuItem(app, other.token, { name: 'Chai', price: 30 });
    await order(other, '2026-10-20T13:00', [[chai, 1, 30]]);
    const res = await report(owner.token, { from: '2026-10-20', to: '2026-10-20' });
    expect(res.body.totals.orders).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  test('validates the range', async () => {
    const owner = await registerOwner(app);
    expect((await report(owner.token, { from: '20-10-2026' })).status).toBe(400);
    expect((await report(owner.token, { from: '2026-10-21', to: '2026-10-20' })).body.code).toBe('INVALID_RANGE');
    expect((await report(owner.token, { from: '2025-01-01', to: '2026-10-20' })).body.code).toBe('RANGE_TOO_LONG');
  });

  test('owners and managers only', async () => {
    const owner = await registerOwner(app);
    expect((await request(app).get('/api/analytics')).status).toBe(401);
    for (const [role, expected] of [['manager', 200], ['waiter', 403], ['kitchen', 403]]) {
      const body = { name: role, email: `${role}@stats.test`, role, password: 'Staff!2345' };
      await request(app).post('/api/staff').set(auth(owner.token)).send(body);
      const login = await request(app).post('/api/users/login').send({ identifier: body.email, password: body.password });
      expect((await report(login.body.token, {})).status).toBe(expected);
    }
  });
});
