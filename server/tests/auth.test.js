const request = require('supertest');
const db = require('./helpers/db');
const createApp = require('../src/app');
const { registerOwner, auth } = require('./helpers/factory');

const app = createApp();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('auth', () => {
  test('register returns a token and user id', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ email: 'new@test.local', password: 'Passw0rd!123', restaurantName: 'New Place' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.userId).toEqual(expect.any(String));
  });

  test('register rejects a duplicate email', async () => {
    await registerOwner(app, { email: 'dup@test.local' });
    const res = await request(app)
      .post('/api/users/register')
      .send({ email: 'dup@test.local', password: 'Passw0rd!123', restaurantName: 'Again' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  test('login works with email and the right password', async () => {
    const owner = await registerOwner(app);
    const res = await request(app)
      .post('/api/users/login')
      .send({ identifier: owner.email, password: owner.password });

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(owner.userId);
  });

  test('login rejects a wrong password', async () => {
    const owner = await registerOwner(app);
    const res = await request(app)
      .post('/api/users/login')
      .send({ identifier: owner.email, password: 'wrong-password' });

    expect(res.status).toBe(400);
    expect(res.body.token).toBeUndefined();
  });

  test('profile requires a token', async () => {
    const owner = await registerOwner(app);
    const res = await request(app).get(`/api/users/${owner.userId}`);
    expect(res.status).toBe(401);
  });

  test('profile never returns the password hash', async () => {
    const owner = await registerOwner(app);
    const res = await request(app).get(`/api/users/${owner.userId}`).set(auth(owner.token));

    expect(res.status).toBe(200);
    expect(res.body.password).toBeUndefined();
  });

  test('an owner cannot read another owner profile', async () => {
    const a = await registerOwner(app);
    const b = await registerOwner(app);
    const res = await request(app).get(`/api/users/${b.userId}`).set(auth(a.token));
    expect(res.status).toBe(403);
  });
});
