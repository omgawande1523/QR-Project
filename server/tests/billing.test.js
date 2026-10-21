const request = require('supertest');
const db = require('./helpers/db');
const createApp = require('../src/app');
const { registerOwner, auth, createMenuItem } = require('./helpers/factory');
const { financialYear } = require('../src/services/invoices');

const app = createApp();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

async function placeOrder(owner, item) {
  const res = await request(app).post('/api/orders').send({ restaurantId: owner.userId, tableNumber: 2, items: [{ menuItem: item._id, quantity: 2 }] });
  expect(res.status).toBe(201);
  return res.body;
}

async function addStaff(owner, role) {
  const body = { name: role, email: `${role}@bill.test`, role, password: 'Staff!2345' };
  await request(app).post('/api/staff').set(auth(owner.token)).send(body);
  const login = await request(app).post('/api/users/login').send({ identifier: body.email, password: body.password });
  return login.body.token;
}

const invoice = (token, id) => request(app).post(`/api/orders/${id}/invoice`).set(auth(token));
const pay = (token, id, body) => request(app).post(`/api/orders/${id}/pay`).set(auth(token)).send(body);

describe('financial year', () => {
  test('runs April to March in India time', () => {
    expect(financialYear(new Date('2026-04-01T00:00:00+05:30'))).toBe('2026-27');
    expect(financialYear(new Date('2027-03-31T23:59:00+05:30'))).toBe('2026-27');
    // 31 March 19:00 UTC is already 1 April in India
    expect(financialYear(new Date('2027-03-31T19:00:00Z'))).toBe('2027-28');
    expect(financialYear(new Date('2099-12-31T00:00:00Z'))).toBe('2099-00');
  });
});

describe('invoices', () => {
  test('making the bill assigns a consecutive number once and marks the order billed', async () => {
    const owner = await registerOwner(app);
    const item = await createMenuItem(app, owner.token);
    const a = await placeOrder(owner, item);
    const b = await placeOrder(owner, item);
    const fy = financialYear();

    const first = await invoice(owner.token, a._id);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ status: 'billed', invoiceNumber: `${fy}/000001` });
    expect(first.body.invoicedAt).toBeTruthy();
    // Printing again keeps the same number
    expect((await invoice(owner.token, a._id)).body.invoiceNumber).toBe(`${fy}/000001`);
    expect((await invoice(owner.token, b._id)).body.invoiceNumber).toBe(`${fy}/000002`);
  });

  test('each restaurant has its own sequence', async () => {
    const one = await registerOwner(app);
    const two = await registerOwner(app);
    const orderOne = await placeOrder(one, await createMenuItem(app, one.token));
    const orderTwo = await placeOrder(two, await createMenuItem(app, two.token));
    expect((await invoice(one.token, orderOne._id)).body.invoiceNumber).toMatch(/\/000001$/);
    expect((await invoice(two.token, orderTwo._id)).body.invoiceNumber).toMatch(/\/000001$/);
  });

  test('concurrent bills never share a number', async () => {
    const owner = await registerOwner(app);
    const item = await createMenuItem(app, owner.token);
    const orders = await Promise.all([1, 2, 3, 4, 5].map(() => placeOrder(owner, item)));
    const numbers = (await Promise.all(orders.map((o) => invoice(owner.token, o._id)))).map((r) => r.body.invoiceNumber);
    expect(new Set(numbers).size).toBe(5);
  });

  test('another restaurant cannot bill your order, and cancelled orders cannot be billed', async () => {
    const owner = await registerOwner(app);
    const other = await registerOwner(app);
    const order = await placeOrder(owner, await createMenuItem(app, owner.token));
    expect((await invoice(other.token, order._id)).status).toBe(403);
    await request(app).put(`/api/orders/${order._id}`).set(auth(owner.token)).send({ status: 'cancelled' });
    const res = await invoice(owner.token, order._id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ORDER_CANCELLED');
  });
});

describe('payments', () => {
  test('marking paid records the method, closes the order and numbers the bill if needed', async () => {
    const owner = await registerOwner(app);
    const order = await placeOrder(owner, await createMenuItem(app, owner.token));
    const res = await pay(owner.token, order._id, { method: 'upi', reference: 'UTR 4321' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'complete', payment: { method: 'upi', reference: 'UTR 4321' } });
    expect(res.body.payment.paidAt).toBeTruthy();
    expect(res.body.invoiceNumber).toMatch(/\/000001$/);

    const again = await pay(owner.token, order._id, { method: 'cash' });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_PAID');
    // Reprinting a paid bill keeps it complete
    expect((await invoice(owner.token, order._id)).body.status).toBe('complete');
  });

  test('only cash, UPI or card can be recorded by staff', async () => {
    const owner = await registerOwner(app);
    const order = await placeOrder(owner, await createMenuItem(app, owner.token));
    expect((await pay(owner.token, order._id, { method: 'online' })).status).toBe(400);
    expect((await pay(owner.token, order._id, {})).status).toBe(400);
  });

  test('waiters and managers can bill and take payment; the kitchen cannot', async () => {
    const owner = await registerOwner(app);
    const item = await createMenuItem(app, owner.token);
    const waiter = await addStaff(owner, 'waiter');
    const manager = await addStaff(owner, 'manager');
    const kitchen = await addStaff(owner, 'kitchen');
    const [a, b, c] = [await placeOrder(owner, item), await placeOrder(owner, item), await placeOrder(owner, item)];

    expect((await invoice(waiter, a._id)).status).toBe(200);
    expect((await pay(waiter, a._id, { method: 'cash' })).status).toBe(200);
    expect((await pay(manager, b._id, { method: 'card' })).status).toBe(200);
    expect((await invoice(kitchen, c._id)).status).toBe(403);
    expect((await pay(kitchen, c._id, { method: 'cash' })).status).toBe(403);
  });

  test('the customer tracking page sees the bill and payment', async () => {
    const owner = await registerOwner(app);
    const order = await placeOrder(owner, await createMenuItem(app, owner.token));
    await pay(owner.token, order._id, { method: 'card' });
    const status = await request(app).get(`/api/orders/status/${order._id}`).query({ token: order.trackingToken });
    expect(status.body).toMatchObject({ status: 'complete', payment: { method: 'card' } });
    expect(status.body.invoiceNumber).toBeTruthy();
  });
});

describe('UPI ID for the bill QR code', () => {
  test('is saved lower-case and validated', async () => {
    const owner = await registerOwner(app);
    const put = (upiId) => request(app).put(`/api/users/${owner.userId}`).set(auth(owner.token)).send({ upiId });
    expect((await put('Cafe.Shiv@OKAXIS')).body.upiId).toBe('cafe.shiv@okaxis');
    expect((await put('not a upi id')).status).toBe(400);
    expect((await put('')).status).toBe(200);
  });
});
