const request = require('supertest');
const sharp = require('sharp');
const db = require('./helpers/db');
const createApp = require('../src/app');
const { registerOwner, auth, createMenuItem } = require('./helpers/factory');

const app = createApp();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

let counter = 0;
async function addStaff(owner, role, overrides = {}) {
  counter += 1;
  const body = { name: `${role} ${counter}`, email: `${role}${counter}@staff.test`, role, password: 'Staff!2345', ...overrides };
  const created = await request(app).post('/api/staff').set(auth(owner.token)).send(body);
  expect(created.status).toBe(201);
  const login = await request(app).post('/api/users/login').send({ identifier: body.email, password: body.password });
  expect(login.status).toBe(200);
  return { ...created.body, token: login.body.token, password: body.password, login: login.body };
}

async function placeOrder(owner, item) {
  const res = await request(app).post('/api/orders').send({ restaurantId: owner.userId, tableNumber: 1, items: [{ menuItem: item._id, quantity: 1 }] });
  return res.body;
}

const setStatus = (token, orderId, status) => request(app).put(`/api/orders/${orderId}`).set(auth(token)).send({ status });

describe('staff management (owner only)', () => {
  test('the owner adds, lists, edits and removes staff; passwords never leave the server', async () => {
    const owner = await registerOwner(app);
    const waiter = await addStaff(owner, 'waiter');
    const list = await request(app).get('/api/staff').set(auth(owner.token));
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ name: waiter.name, role: 'waiter', active: true });
    expect(list.body[0].password).toBeUndefined();
    expect(list.body[0].tokenVersion).toBeUndefined();

    const edited = await request(app).patch(`/api/staff/${waiter._id}`).set(auth(owner.token)).send({ name: 'Ravi' });
    expect(edited.body.name).toBe('Ravi');
    expect((await request(app).delete(`/api/staff/${waiter._id}`).set(auth(owner.token))).status).toBe(200);
    expect((await request(app).get('/api/staff').set(auth(owner.token))).body).toHaveLength(0);
  });

  test('an email can belong to one login only', async () => {
    const owner = await registerOwner(app);
    const other = await registerOwner(app);
    const clashOwner = await request(app).post('/api/staff').set(auth(owner.token)).send({ name: 'X', email: other.email, role: 'waiter', password: 'Staff!2345' });
    expect(clashOwner.status).toBe(409);
    await addStaff(owner, 'kitchen', { email: 'cook@staff.test' });
    const clashStaff = await request(app).post('/api/staff').set(auth(other.token)).send({ name: 'Y', email: 'cook@staff.test', role: 'waiter', password: 'Staff!2345' });
    expect(clashStaff.status).toBe(409);
    const register = await request(app).post('/api/users/register').send({ email: 'cook@staff.test', password: 'Passw0rd!123', restaurantName: 'Z' });
    expect(register.status).toBe(400);
  });

  test('validates the role', async () => {
    const owner = await registerOwner(app);
    const res = await request(app).post('/api/staff').set(auth(owner.token)).send({ name: 'A', email: 'a@staff.test', role: 'owner', password: 'Staff!2345' });
    expect(res.status).toBe(400);
  });

  test.each(['manager', 'waiter', 'kitchen'])('a %s cannot manage staff', async (role) => {
    const owner = await registerOwner(app);
    const member = await addStaff(owner, role);
    expect((await request(app).get('/api/staff').set(auth(member.token))).status).toBe(403);
    expect((await request(app).post('/api/staff').set(auth(member.token)).send({ name: 'B', email: 'b@staff.test', role: 'waiter', password: 'Staff!2345' })).status).toBe(403);
  });
});

describe('staff login', () => {
  test('staff log in on the owner login screen and /me tells the client who they are', async () => {
    const owner = await registerOwner(app, { restaurantName: 'Chai Point' });
    const cook = await addStaff(owner, 'kitchen', { name: 'Meena' });
    expect(cook.login).toMatchObject({ role: 'kitchen', userId: owner.userId, name: 'Meena' });

    const me = await request(app).get('/api/users/me').set(auth(cook.token));
    expect(me.body).toMatchObject({ userId: owner.userId, role: 'kitchen', name: 'Meena', restaurantName: 'Chai Point' });
    const ownerMe = await request(app).get('/api/users/me').set(auth(owner.token));
    expect(ownerMe.body).toMatchObject({ role: 'owner', name: 'Chai Point' });
  });

  test('a wrong password or a deactivated account cannot log in', async () => {
    const owner = await registerOwner(app);
    const waiter = await addStaff(owner, 'waiter');
    expect((await request(app).post('/api/users/login').send({ identifier: waiter.email, password: 'wrong-one' })).status).toBe(400);
    await request(app).patch(`/api/staff/${waiter._id}`).set(auth(owner.token)).send({ active: false });
    expect((await request(app).post('/api/users/login').send({ identifier: waiter.email, password: waiter.password })).status).toBe(400);
  });
});

describe('role permissions', () => {
  test('kitchen: sees orders and moves them only between New, Preparing and Ready', async () => {
    const owner = await registerOwner(app);
    const cook = await addStaff(owner, 'kitchen');
    const item = await createMenuItem(app, owner.token);
    const order = await placeOrder(owner, item);

    expect((await request(app).get('/api/orders').set(auth(cook.token))).status).toBe(200);
    expect((await setStatus(cook.token, order._id, 'process')).status).toBe(200);
    expect((await setStatus(cook.token, order._id, 'ready')).status).toBe(200);
    expect((await setStatus(cook.token, order._id, 'process')).status).toBe(200); // recall
    await setStatus(owner.token, order._id, 'served');
    expect((await setStatus(cook.token, order._id, 'billed')).status).toBe(403);
    expect((await setStatus(cook.token, order._id, 'ready')).status).toBe(403); // not from served

    expect((await request(app).get('/api/service-requests').set(auth(cook.token))).status).toBe(403);
    expect((await request(app).post('/api/menu').set(auth(cook.token)).send({ name: 'X', price: 1 })).status).toBe(403);
    expect((await request(app).put(`/api/users/${owner.userId}`).set(auth(cook.token)).send({ tagline: 'x' })).status).toBe(403);
    const soldOut = await request(app).patch('/api/menu/availability').set(auth(cook.token)).send({ ids: [item._id], available: false });
    expect(soldOut.status).toBe(200);
  });

  test('waiter: runs the floor but cannot edit the menu or settings', async () => {
    const owner = await registerOwner(app);
    const waiter = await addStaff(owner, 'waiter');
    const item = await createMenuItem(app, owner.token);
    const order = await placeOrder(owner, item);
    for (const status of ['process', 'ready', 'served', 'billed', 'complete']) {
      expect((await setStatus(waiter.token, order._id, status)).status).toBe(200);
    }
    expect((await request(app).get('/api/service-requests').set(auth(waiter.token))).status).toBe(200);
    expect((await request(app).put(`/api/menu/${item._id}`).set(auth(waiter.token)).send({ price: 1 })).status).toBe(403);
    expect((await request(app).delete(`/api/menu/${item._id}`).set(auth(waiter.token))).status).toBe(403);
    expect((await request(app).put(`/api/users/${owner.userId}`).set(auth(waiter.token)).send({ tagline: 'x' })).status).toBe(403);
  });

  test('manager: menu, settings and images, but not staff or the owner password', async () => {
    const owner = await registerOwner(app);
    const manager = await addStaff(owner, 'manager');
    expect((await request(app).post('/api/menu').set(auth(manager.token)).send({ name: 'Thali', price: 199 })).status).toBe(200);
    expect((await request(app).put(`/api/users/${owner.userId}`).set(auth(manager.token)).send({ tagline: 'Fresh daily' })).status).toBe(200);
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#a3ad4f' } }).png().toBuffer();
    const upload = await request(app).post('/api/uploads/originals').set(auth(manager.token)).attach('image', png, { filename: 'a.png', contentType: 'image/png' });
    expect(upload.status).toBe(201);
    const pw = await request(app).post(`/api/users/${owner.userId}/change-password`).set(auth(manager.token)).send({ currentPassword: 'x', newPassword: 'Another!2345' });
    expect(pw.status).toBe(403);
  });

  test('waiter and kitchen cannot upload images', async () => {
    const owner = await registerOwner(app);
    for (const role of ['waiter', 'kitchen']) {
      const member = await addStaff(owner, role);
      expect((await request(app).post('/api/uploads/crop').set(auth(member.token)).send({})).status).toBe(403);
    }
  });

  test('staff of another restaurant cannot touch my orders', async () => {
    const mine = await registerOwner(app);
    const theirs = await registerOwner(app);
    const theirWaiter = await addStaff(theirs, 'waiter');
    const order = await placeOrder(mine, await createMenuItem(app, mine.token));
    expect((await setStatus(theirWaiter.token, order._id, 'process')).status).toBe(403);
    const list = await request(app).get('/api/orders').set(auth(theirWaiter.token));
    expect(list.body).toHaveLength(0);
  });
});

describe('sessions end when access changes', () => {
  test.each([
    ['deactivated', (owner, s) => request(app).patch(`/api/staff/${s._id}`).set(auth(owner.token)).send({ active: false })],
    ['given a new role', (owner, s) => request(app).patch(`/api/staff/${s._id}`).set(auth(owner.token)).send({ role: 'kitchen' })],
    ['password reset', (owner, s) => request(app).post(`/api/staff/${s._id}/password`).set(auth(owner.token)).send({ password: 'NewStaff!234' })],
    ['removed', (owner, s) => request(app).delete(`/api/staff/${s._id}`).set(auth(owner.token))]
  ])('a staff member who is %s is signed out at once', async (_label, change) => {
    const owner = await registerOwner(app);
    const waiter = await addStaff(owner, 'waiter');
    expect((await request(app).get('/api/orders').set(auth(waiter.token))).status).toBe(200);
    await change(owner, waiter);
    expect((await request(app).get('/api/orders').set(auth(waiter.token))).status).toBe(401);
  });

  test('a staff member changes their own password and gets a fresh token', async () => {
    const owner = await registerOwner(app);
    const waiter = await addStaff(owner, 'waiter');
    const res = await request(app).post('/api/staff/me/password').set(auth(waiter.token)).send({ currentPassword: waiter.password, newPassword: 'Changed!2345' });
    expect(res.status).toBe(200);
    expect((await request(app).get('/api/orders').set(auth(waiter.token))).status).toBe(401);
    expect((await request(app).get('/api/orders').set(auth(res.body.token))).status).toBe(200);
  });
});
