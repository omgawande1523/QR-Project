const request = require('supertest');
const db = require('./helpers/db');
const createApp = require('../src/app');
const { registerOwner, auth } = require('./helpers/factory');

const app = createApp();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

async function callWaiter(restaurantId, overrides = {}) {
  return request(app)
    .post('/api/service-requests')
    .send({ restaurantId, tableNumber: 2, type: 'Waiter', customerName: 'Asha', ...overrides });
}

describe('service requests', () => {
  test('a customer can call a waiter for a real table', async () => {
    const owner = await registerOwner(app);
    const res = await callWaiter(owner.userId);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: 'Waiter', tableNumber: 2, status: 'pending' });
  });

  test('rejects a table the restaurant does not have', async () => {
    const owner = await registerOwner(app);
    const res = await callWaiter(owner.userId, { tableNumber: 99 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNKNOWN_TABLE');
  });

  test('rejects an unknown request type', async () => {
    const owner = await registerOwner(app);
    const res = await callWaiter(owner.userId, { type: 'Free food' });
    expect(res.status).toBe(400);
  });

  test('listing requires a token', async () => {
    const owner = await registerOwner(app);
    await callWaiter(owner.userId);
    const res = await request(app).get('/api/service-requests');
    expect(res.status).toBe(401);
  });

  test('an owner only sees their own requests', async () => {
    const a = await registerOwner(app);
    const b = await registerOwner(app);
    await callWaiter(a.userId);
    await callWaiter(b.userId, { type: 'Water' });

    const res = await request(app).get('/api/service-requests').set(auth(a.token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].type).toBe('Waiter');
  });

  test('handling requires a token and ownership', async () => {
    const a = await registerOwner(app);
    const b = await registerOwner(app);
    const created = await callWaiter(a.userId);
    const id = created.body._id;

    expect((await request(app).delete(`/api/service-requests/${id}`)).status).toBe(401);
    expect((await request(app).delete(`/api/service-requests/${id}`).set(auth(b.token))).status).toBe(403);

    const ok = await request(app).delete(`/api/service-requests/${id}`).set(auth(a.token));
    expect(ok.status).toBe(200);
    const pending = await request(app).get('/api/service-requests').set(auth(a.token));
    expect(pending.body).toHaveLength(0);
  });
});
