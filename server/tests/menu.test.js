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

describe('menu item details and bulk availability', () => {
  test('stores badges, spice level and calories', async () => {
    const owner = await registerOwner(app);
    const item = await createMenuItem(app, owner.token, { tags: ['bestseller', 'bestseller', 'chefs_special'], spiceLevel: 2, calories: 540 });
    expect(item).toMatchObject({ tags: ['bestseller', 'chefs_special'], spiceLevel: 2, calories: 540 });

    const bad = await request(app).post('/api/menu').set(auth(owner.token)).send({ name: 'X', price: 1, tags: ['free'] });
    expect(bad.status).toBe(400);
  });

  test('bulk sold-out only changes the owner items', async () => {
    const a = await registerOwner(app);
    const b = await registerOwner(app);
    const a1 = await createMenuItem(app, a.token, { name: 'A1' });
    const a2 = await createMenuItem(app, a.token, { name: 'A2' });
    const b1 = await createMenuItem(app, b.token, { name: 'B1' });

    const res = await request(app)
      .patch('/api/menu/availability')
      .set(auth(a.token))
      .send({ ids: [a1._id, a2._id, b1._id], available: false });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);

    const menuA = await request(app).get(`/api/menu/${a.userId}`);
    expect(menuA.body.every((i) => i.available === false)).toBe(true);
    const menuB = await request(app).get(`/api/menu/${b.userId}`);
    expect(menuB.body[0].available).toBe(true);
  });

  test('bulk availability needs a token and at least one id', async () => {
    const owner = await registerOwner(app);
    expect((await request(app).patch('/api/menu/availability').send({ ids: [], available: false })).status).toBe(401);
    expect((await request(app).patch('/api/menu/availability').set(auth(owner.token)).send({ ids: [], available: false })).status).toBe(400);
  });
});
