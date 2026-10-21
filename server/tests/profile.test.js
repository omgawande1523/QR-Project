const request = require('supertest');
const db = require('./helpers/db');
const createApp = require('../src/app');
const { registerOwner, auth, createMenuItem } = require('./helpers/factory');

const app = createApp();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

const update = (owner, body) => request(app).put(`/api/users/${owner.userId}`).set(auth(owner.token)).send(body);

describe('restaurant profile', () => {
  test('saves tagline, address, GSTIN, opening hours and categories without resending the name', async () => {
    const owner = await registerOwner(app);
    const res = await update(owner, {
      tagline: 'Fresh food, olive-leaf calm',
      address: 'FC Road, Pune',
      gstin: '27abcde1234f1z5',
      openingHours: [{ day: 1, open: '08:00', close: '22:30', closed: false }, { day: 0, open: '00:00', close: '00:00', closed: true }],
      categories: ['Breakfast', 'Mains']
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ gstin: '27ABCDE1234F1Z5', categories: ['Breakfast', 'Mains'], restaurantName: expect.any(String) });
  });

  test('the public profile shows what customers need and nothing private', async () => {
    const owner = await registerOwner(app);
    await update(owner, { tagline: 'Hello', gstin: '27ABCDE1234F1Z5', categories: ['Mains'] });
    const res = await request(app).get(`/api/users/${owner.userId}/public`);
    expect(res.body).toMatchObject({ tagline: 'Hello', categories: ['Mains'], acceptingOrders: true });
    ['email', 'gstin', 'tableStats', 'phoneNumber', 'tokenVersion'].forEach((field) => expect(res.body[field]).toBeUndefined());
  });

  test.each([
    [{ gstin: 'ABC' }],
    [{ openingHours: [{ day: 1, open: '8am', close: '22:00' }] }],
    [{ openingHours: [{ day: 1, open: '08:00', close: '22:00' }, { day: 1, open: '09:00', close: '21:00' }] }],
    [{ categories: ['Mains', 'mains'] }],
    [{ restaurantName: '   ' }]
  ])('rejects invalid input %j', async (body) => {
    const owner = await registerOwner(app);
    expect((await update(owner, body)).status).toBe(400);
  });
});

describe('categories', () => {
  test('a new item category is appended to the restaurant category list', async () => {
    const owner = await registerOwner(app);
    await update(owner, { categories: ['Starters'] });
    await createMenuItem(app, owner.token, { category: 'Desserts' });
    const profile = await request(app).get(`/api/users/${owner.userId}/public`);
    expect(profile.body.categories).toEqual(['Starters', 'Desserts']);
  });

  test('renaming a category updates the list and every item in it', async () => {
    const owner = await registerOwner(app);
    await createMenuItem(app, owner.token, { name: 'Dosa', category: 'Tiffin' });
    await createMenuItem(app, owner.token, { name: 'Idli', category: 'Tiffin' });
    await createMenuItem(app, owner.token, { name: 'Naan', category: 'Breads' });

    const res = await request(app).post('/api/menu/categories/rename').set(auth(owner.token)).send({ from: 'Tiffin', to: 'Breakfast' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ categories: ['Breakfast', 'Breads'], updated: 2 });

    const menu = await request(app).get(`/api/menu/${owner.userId}`);
    expect(menu.body.filter((i) => i.category === 'Breakfast').map((i) => i.name).sort()).toEqual(['Dosa', 'Idli']);
  });

  test('renaming onto an existing category is refused', async () => {
    const owner = await registerOwner(app);
    await update(owner, { categories: ['Starters', 'Mains'] });
    const res = await request(app).post('/api/menu/categories/rename').set(auth(owner.token)).send({ from: 'Starters', to: 'mains' });
    expect(res.status).toBe(409);
  });
});
