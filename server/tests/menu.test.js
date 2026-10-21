const request = require('supertest');
const db = require('./helpers/db');
const createApp = require('../src/app');
const { registerOwner, auth, createMenuItem } = require('./helpers/factory');

const app = createApp();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('menu', () => {
  test('GET /api/menu no longer lists every restaurant menu', async () => {
    const owner = await registerOwner(app);
    await createMenuItem(app, owner.token);
    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(404);
  });

  test('a restaurant menu lists only that restaurant items', async () => {
    const a = await registerOwner(app);
    const b = await registerOwner(app);
    await createMenuItem(app, a.token, { name: 'A dish' });
    await createMenuItem(app, b.token, { name: 'B dish' });

    const res = await request(app).get(`/api/menu/${a.userId}`);
    expect(res.status).toBe(200);
    expect(res.body.map((i) => i.name)).toEqual(['A dish']);
  });

  test('creating an item requires a token', async () => {
    const res = await request(app).post('/api/menu').send({ name: 'X', price: 10 });
    expect(res.status).toBe(401);
  });

  test('an owner cannot edit or delete another owner item', async () => {
    const a = await registerOwner(app);
    const b = await registerOwner(app);
    const item = await createMenuItem(app, a.token);

    const edit = await request(app).put(`/api/menu/${item._id}`).set(auth(b.token)).send({ price: 1 });
    const del = await request(app).delete(`/api/menu/${item._id}`).set(auth(b.token));
    expect(edit.status).toBe(403);
    expect(del.status).toBe(403);

    const after = await request(app).get(`/api/menu/${a.userId}`);
    expect(after.body[0].price).toBe(250);
  });

  test('the owner can update availability and delete', async () => {
    const owner = await registerOwner(app);
    const item = await createMenuItem(app, owner.token);

    const edit = await request(app).put(`/api/menu/${item._id}`).set(auth(owner.token)).send({ available: false });
    expect(edit.status).toBe(200);
    expect(edit.body.available).toBe(false);

    const del = await request(app).delete(`/api/menu/${item._id}`).set(auth(owner.token));
    expect(del.status).toBe(200);
  });
});
