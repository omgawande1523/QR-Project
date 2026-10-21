const request = require('supertest');
const db = require('./helpers/db');
const createApp = require('../src/app');
const { registerOwner, auth, createMenuItem } = require('./helpers/factory');
const { indiaToday } = require('../src/services/analytics');

const app = createApp();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

async function servedOrder(owner, extra = {}) {
  const item = await createMenuItem(app, owner.token, { name: `Dosa ${Math.random()}` });
  const order = (await request(app).post('/api/orders').send({ restaurantId: owner.userId, tableNumber: 3, customerName: 'Meera', items: [{ menuItem: item._id, quantity: 1 }], ...extra })).body;
  return order;
}
const serve = (owner, id) => request(app).put(`/api/orders/${id}`).set(auth(owner.token)).send({ status: 'served' });
const rate = (order, body) => request(app).post(`/api/orders/${order._id}/feedback`).send({ token: order.trackingToken, ...body });

describe('guest feedback', () => {
  test('a guest rates a served meal once; the tracking page and owner see it', async () => {
    const owner = await registerOwner(app);
    const order = await servedOrder(owner);
    await serve(owner, order._id);

    const res = await rate(order, { rating: 4, tags: ['tasty', 'slow', 'tasty'], comment: '  Lovely dosa, a bit slow  ' });
    expect(res.status).toBe(201);
    expect(res.body.feedback).toMatchObject({ rating: 4, tags: ['tasty', 'slow'], comment: 'Lovely dosa, a bit slow' });
    expect(res.body.trackingToken).toBeUndefined();

    const status = await request(app).get(`/api/orders/status/${order._id}`).query({ token: order.trackingToken });
    expect(status.body.feedback.rating).toBe(4);

    const again = await rate(order, { rating: 1 });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('FEEDBACK_EXISTS');
  });

  test('cannot rate before the meal is served, or without the tracking token', async () => {
    const owner = await registerOwner(app);
    const order = await servedOrder(owner);
    const early = await rate(order, { rating: 5 });
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('NOT_SERVED');

    await serve(owner, order._id);
    expect((await rate({ ...order, trackingToken: 'wrong' }, { rating: 5 })).status).toBe(404);
    expect((await request(app).post(`/api/orders/${order._id}/feedback`).send({ rating: 5 })).status).toBe(400);
  });

  test('validates rating, tags and comment', async () => {
    const owner = await registerOwner(app);
    const order = await servedOrder(owner);
    await serve(owner, order._id);
    expect((await rate(order, { rating: 0 })).status).toBe(400);
    expect((await rate(order, { rating: 6 })).status).toBe(400);
    expect((await rate(order, { rating: 4.5 })).status).toBe(400);
    expect((await rate(order, { rating: 5, tags: ['amazing'] })).status).toBe(400);
    expect((await rate(order, { rating: 5, comment: 'x'.repeat(501) })).status).toBe(400);
  });

  test('a paid order can still be rated', async () => {
    const owner = await registerOwner(app);
    const order = await servedOrder(owner);
    await serve(owner, order._id);
    await request(app).post(`/api/orders/${order._id}/pay`).set(auth(owner.token)).send({ method: 'cash' });
    expect((await rate(order, { rating: 5 })).status).toBe(201);
  });
});

describe('feedback report', () => {
  test('average, distribution, tags and newest comments for the owner', async () => {
    const owner = await registerOwner(app);
    for (const [rating, tags, comment] of [[5, ['tasty', 'friendly'], 'Superb'], [4, ['tasty'], undefined], [2, ['slow', 'cold'], 'Took 40 minutes']]) {
      const order = await servedOrder(owner);
      await serve(owner, order._id);
      await rate(order, { rating, tags, comment });
    }
    await servedOrder(owner); // not rated

    const res = await request(app).get('/api/analytics/feedback').set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.range.to).toBe(indiaToday());
    expect(res.body).toMatchObject({ count: 3, average: 3.7, distribution: { 1: 0, 2: 1, 3: 0, 4: 1, 5: 1 } });
    expect(res.body.tags).toEqual({ tasty: 2, friendly: 1, slow: 1, cold: 1 });
    expect(res.body.entries).toHaveLength(3);
    expect(res.body.entries[0]).toMatchObject({ rating: 2, comment: 'Took 40 minutes', tableNumber: 3, customerName: 'Meera' });
    expect(res.body.entries[0].items[0]).toMatch(/^1 × Dosa/);
  });

  test('only for the owner and managers, and only their own restaurant', async () => {
    const owner = await registerOwner(app);
    const other = await registerOwner(app);
    const order = await servedOrder(other);
    await serve(other, order._id);
    await rate(order, { rating: 5 });
    expect((await request(app).get('/api/analytics/feedback').set(auth(owner.token))).body.count).toBe(0);

    const body = { name: 'W', email: 'w@fb.test', role: 'waiter', password: 'Staff!2345' };
    await request(app).post('/api/staff').set(auth(owner.token)).send(body);
    const login = await request(app).post('/api/users/login').send({ identifier: body.email, password: body.password });
    expect((await request(app).get('/api/analytics/feedback').set(auth(login.body.token))).status).toBe(403);
  });
});
