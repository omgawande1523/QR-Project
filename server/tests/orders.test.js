const request = require('supertest');
const db = require('./helpers/db');
const createApp = require('../src/app');
const { registerOwner, auth, createMenuItem } = require('./helpers/factory');

const app = createApp();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

function placeOrder(body) {
  return request(app).post('/api/orders').send(body);
}

async function setBilling(owner, settings) {
  const res = await request(app)
    .put(`/api/users/${owner.userId}`)
    .set(auth(owner.token))
    .send({ restaurantName: 'Billing Test', ...settings });
  expect(res.status).toBe(200);
}

async function curryWithOptions(owner) {
  return createMenuItem(app, owner.token, {
    name: 'Butter Chicken',
    price: 300,
    variants: [{ name: 'Half', price: 180 }, { name: 'Full', price: 300 }],
    addOns: [{ name: 'Extra butter', price: 30 }, { name: 'Rumali roti', price: 25 }]
  });
}

describe('order pricing is computed on the server', () => {
  test('price tampering fails: client prices and totals are ignored', async () => {
    const owner = await registerOwner(app);
    const item = await createMenuItem(app, owner.token, { name: 'Paneer Tikka', price: 250 });

    const res = await placeOrder({
      restaurantId: owner.userId,
      tableNumber: 1,
      totalAmount: 0,
      subtotal: 0,
      items: [{ menuItem: item._id, quantity: 2, price: 0, menuItemName: 'Free food', lineTotal: 0 }]
    });

    expect(res.status).toBe(201);
    expect(res.body.items[0]).toMatchObject({ menuItemName: 'Paneer Tikka', price: 250, quantity: 2, lineTotal: 500 });
    expect(res.body.subtotal).toBe(500);
    expect(res.body.totalAmount).toBe(500);
  });

  test('variants replace the base price and add-ons are added', async () => {
    const owner = await registerOwner(app);
    const curry = await curryWithOptions(owner);
    const half = curry.variants.find((v) => v.name === 'Half');
    const butter = curry.addOns.find((a) => a.name === 'Extra butter');

    const res = await placeOrder({
      restaurantId: owner.userId,
      tableNumber: 2,
      items: [{ menuItem: curry._id, quantity: 3, variantId: half._id, addOnIds: [butter._id], notes: 'less spicy' }]
    });

    expect(res.status).toBe(201);
    expect(res.body.items[0]).toMatchObject({
      variant: { name: 'Half', price: 180 },
      addOns: [{ name: 'Extra butter', price: 30 }],
      price: 210,
      lineTotal: 630,
      notes: 'less spicy'
    });
    expect(res.body.totalAmount).toBe(630);
  });

  test('service charge and GST come from the restaurant settings', async () => {
    const owner = await registerOwner(app);
    await setBilling(owner, { taxPercent: 5, serviceChargePercent: 10 });
    const item = await createMenuItem(app, owner.token, { price: 460 });

    const res = await placeOrder({ restaurantId: owner.userId, tableNumber: 1, items: [{ menuItem: item._id, quantity: 1 }] });

    expect(res.body).toMatchObject({
      subtotal: 460,
      serviceChargePercent: 10,
      serviceChargeAmount: 46,
      taxPercent: 5,
      taxAmount: 25.3, // 5% of (460 + 46)
      totalAmount: 531.3
    });
  });

  test('rejects a sold-out item', async () => {
    const owner = await registerOwner(app);
    const item = await createMenuItem(app, owner.token, { available: false });
    const res = await placeOrder({ restaurantId: owner.userId, tableNumber: 1, items: [{ menuItem: item._id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ITEM_UNAVAILABLE');
  });

  test('rejects an item that belongs to another restaurant', async () => {
    const a = await registerOwner(app);
    const b = await registerOwner(app);
    const cheapAtB = await createMenuItem(app, b.token, { price: 1 });
    const res = await placeOrder({ restaurantId: a.userId, tableNumber: 1, items: [{ menuItem: cheapAtB._id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ITEM_NOT_FOUND');
  });

  test.each([0, -1, 51, 2.5, '3'])('rejects quantity %p', async (quantity) => {
    const owner = await registerOwner(app);
    const item = await createMenuItem(app, owner.token);
    const res = await placeOrder({ restaurantId: owner.userId, tableNumber: 1, items: [{ menuItem: item._id, quantity }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('accepts the maximum quantity of 50', async () => {
    const owner = await registerOwner(app);
    const item = await createMenuItem(app, owner.token, { price: 10 });
    const res = await placeOrder({ restaurantId: owner.userId, tableNumber: 1, items: [{ menuItem: item._id, quantity: 50 }] });
    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(500);
  });

  test('requires a variant when the item has sizes and rejects unknown options', async () => {
    const owner = await registerOwner(app);
    const curry = await curryWithOptions(owner);
    const plain = await createMenuItem(app, owner.token);
    const base = { restaurantId: owner.userId, tableNumber: 1 };
    const fakeId = '0123456789abcdef01234567';

    const missing = await placeOrder({ ...base, items: [{ menuItem: curry._id, quantity: 1 }] });
    expect(missing.body.code).toBe('VARIANT_REQUIRED');

    const unknownVariant = await placeOrder({ ...base, items: [{ menuItem: curry._id, quantity: 1, variantId: fakeId }] });
    expect(unknownVariant.body.code).toBe('UNKNOWN_VARIANT');

    const variantOnPlain = await placeOrder({ ...base, items: [{ menuItem: plain._id, quantity: 1, variantId: curry.variants[0]._id }] });
    expect(variantOnPlain.body.code).toBe('UNKNOWN_VARIANT');

    const unknownAddOn = await placeOrder({
      ...base,
      items: [{ menuItem: curry._id, quantity: 1, variantId: curry.variants[0]._id, addOnIds: [fakeId] }]
    });
    expect(unknownAddOn.body.code).toBe('UNKNOWN_ADD_ON');

    const twice = curry.addOns[0]._id;
    const duplicate = await placeOrder({
      ...base,
      items: [{ menuItem: curry._id, quantity: 1, variantId: curry.variants[0]._id, addOnIds: [twice, twice] }]
    });
    expect(duplicate.body.code).toBe('DUPLICATE_ADD_ON');
  });

  test('rejects an unknown table, an empty cart and a missing restaurant', async () => {
    const owner = await registerOwner(app);
    const item = await createMenuItem(app, owner.token);

    const table = await placeOrder({ restaurantId: owner.userId, tableNumber: 42, items: [{ menuItem: item._id, quantity: 1 }] });
    expect(table.body.code).toBe('UNKNOWN_TABLE');

    const empty = await placeOrder({ restaurantId: owner.userId, tableNumber: 1, items: [] });
    expect(empty.status).toBe(400);

    const ghost = await placeOrder({ restaurantId: '0123456789abcdef01234567', tableNumber: 1, items: [{ menuItem: item._id, quantity: 1 }] });
    expect(ghost.status).toBe(404);
  });

  test('rejects orders while the restaurant is not accepting them', async () => {
    const owner = await registerOwner(app);
    await setBilling(owner, { acceptingOrders: false });
    const item = await createMenuItem(app, owner.token);
    const res = await placeOrder({ restaurantId: owner.userId, tableNumber: 1, items: [{ menuItem: item._id, quantity: 1 }] });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NOT_ACCEPTING_ORDERS');
  });
});

describe('order ownership', () => {
  test('owners only list their own orders and cannot change another restaurant order', async () => {
    const a = await registerOwner(app);
    const b = await registerOwner(app);
    const item = await createMenuItem(app, a.token);
    const order = await placeOrder({ restaurantId: a.userId, tableNumber: 1, items: [{ menuItem: item._id, quantity: 1 }] });

    const listA = await request(app).get('/api/orders').set(auth(a.token));
    const listB = await request(app).get('/api/orders').set(auth(b.token));
    expect(listA.body).toHaveLength(1);
    expect(listB.body).toHaveLength(0);

    const hijack = await request(app).put(`/api/orders/${order.body._id}`).set(auth(b.token)).send({ status: 'cancelled' });
    expect(hijack.status).toBe(403);

    const ok = await request(app).put(`/api/orders/${order.body._id}`).set(auth(a.token)).send({ status: 'process' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('process');
  });

  test('listing orders requires a token', async () => {
    expect((await request(app).get('/api/orders')).status).toBe(401);
  });
});
