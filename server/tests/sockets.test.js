const request = require('supertest');
const { io: connect } = require('socket.io-client');
const db = require('./helpers/db');
const { createServer } = require('../src/server');
const { registerOwner, auth, createMenuItem } = require('./helpers/factory');

let app;
let server;
let ioServer;
let url;
const sockets = [];

beforeAll(async () => {
  await db.connect();
  ({ app, server, io: ioServer } = createServer());
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  await db.clear();
});

afterAll(async () => {
  ioServer.close();
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});

function open(options = {}) {
  const socket = connect(url, { transports: ['websocket'], forceNew: true, reconnection: false, ...options });
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

// Resolves with the payload if `event` arrives within `ms`, otherwise with null.
function nextEvent(socket, event, ms = 400) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { socket.off(event, handler); resolve(null); }, ms);
    function handler(payload) { clearTimeout(timer); resolve(payload); }
    socket.once(event, handler);
  });
}

async function placeOrder(restaurantId, item) {
  const res = await request(app).post('/api/orders').send({
    restaurantId,
    tableNumber: 1,
    customerName: 'Ravi',
    items: [{ menuItem: item._id, menuItemName: item.name, price: item.price, quantity: 1 }]
  });
  expect(res.status).toBe(201);
  return res.body;
}

describe('sockets', () => {
  test('rejects a dashboard socket with an invalid token', async () => {
    await expect(open({ auth: { token: 'forged' } })).rejects.toThrow('unauthorized');
  });

  test('only the owning dashboard receives newOrder', async () => {
    const a = await registerOwner(app);
    const b = await registerOwner(app);
    const item = await createMenuItem(app, a.token);

    const dashA = await open({ auth: { token: a.token } });
    const dashB = await open({ auth: { token: b.token } });
    const gotA = nextEvent(dashA, 'newOrder');
    const gotB = nextEvent(dashB, 'newOrder');

    await placeOrder(a.userId, item);
    expect((await gotA)?.tableNumber).toBe(1);
    expect(await gotB).toBeNull();
  });

  test('an anonymous socket cannot join a restaurant room with the old join event', async () => {
    const a = await registerOwner(app);
    const item = await createMenuItem(app, a.token);

    const snoop = await open();
    snoop.emit('join', a.userId);
    snoop.emit('join', `restaurant:${a.userId}`);
    const leaked = nextEvent(snoop, 'newOrder');

    await placeOrder(a.userId, item);
    expect(await leaked).toBeNull();
  });

  test('a customer follows their order only with the right tracking token', async () => {
    const a = await registerOwner(app);
    const item = await createMenuItem(app, a.token);
    const order = await placeOrder(a.userId, item);
    expect(order.trackingToken).toEqual(expect.any(String));

    const intruder = await open();
    const denied = await emitWithAck(intruder, 'trackOrder', { orderId: order._id, token: 'guess' });
    expect(denied.ok).toBe(false);

    const customer = await open();
    const allowed = await emitWithAck(customer, 'trackOrder', { orderId: order._id, token: order.trackingToken });
    expect(allowed.ok).toBe(true);

    const toCustomer = nextEvent(customer, 'orderUpdated');
    const toIntruder = nextEvent(intruder, 'orderUpdated');
    await request(app).put(`/api/orders/${order._id}`).set(auth(a.token)).send({ status: 'process' });

    const update = await toCustomer;
    expect(update.status).toBe('process');
    expect(update.trackingToken).toBeUndefined();
    expect(await toIntruder).toBeNull();
  });

  test('a client-sent menuUpdated is not rebroadcast; server emits after a real change', async () => {
    const a = await registerOwner(app);
    const item = await createMenuItem(app, a.token);

    const viewer = await open();
    expect((await emitWithAck(viewer, 'joinMenu', a.userId)).ok).toBe(true);
    const attacker = await open();

    const fake = nextEvent(viewer, 'menuUpdated');
    attacker.emit('menuUpdated', { _id: item._id, owner: a.userId, price: 0 });
    expect(await fake).toBeNull();

    const real = nextEvent(viewer, 'menuUpdated');
    await request(app).put(`/api/menu/${item._id}`).set(auth(a.token)).send({ available: false });
    expect((await real)?.available).toBe(false);
  });

  test('order status lookup needs the tracking token', async () => {
    const a = await registerOwner(app);
    const item = await createMenuItem(app, a.token);
    const order = await placeOrder(a.userId, item);

    expect((await request(app).get(`/api/orders/status/${order._id}`)).status).toBe(400);
    expect((await request(app).get(`/api/orders/status/${order._id}?token=wrong`)).status).toBe(404);
    const ok = await request(app).get(`/api/orders/status/${order._id}?token=${order.trackingToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.trackingToken).toBeUndefined();
  });
});
