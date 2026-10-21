const request = require('supertest');
const db = require('./helpers/db');
const createApp = require('../src/app');
const { registerOwner, auth, createMenuItem } = require('./helpers/factory');

const app = createApp();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('input validation and error format', () => {
  test('rejects a NoSQL operator in the login identifier', async () => {
    await registerOwner(app, { email: 'victim@test.local' });
    const res = await request(app)
      .post('/api/users/login')
      .send({ identifier: { $ne: null }, password: { $ne: null } });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.token).toBeUndefined();
  });

  test('rejects an invalid email and a short password with field details', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ email: 'not-an-email', password: 'short', restaurantName: 'X' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR', message: expect.any(String) });
    const fields = res.body.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password']));
  });

  test('stores emails in lowercase and lets the owner log in with any casing', async () => {
    await request(app)
      .post('/api/users/register')
      .send({ email: 'Mixed.Case@Test.Local', password: 'Passw0rd!123', restaurantName: 'Case Cafe' });

    const res = await request(app)
      .post('/api/users/login')
      .send({ identifier: 'MIXED.case@test.local', password: 'Passw0rd!123' });
    expect(res.status).toBe(200);
  });

  test('rejects a malformed id with 400 instead of a server error', async () => {
    const res = await request(app).get('/api/menu/not-an-id');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('rejects a negative price', async () => {
    const owner = await registerOwner(app);
    const res = await request(app)
      .post('/api/menu')
      .set(auth(owner.token))
      .send({ name: 'Free Lunch', price: -10 });
    expect(res.status).toBe(400);
  });

  test('ignores fields that are not part of the schema (owner cannot be spoofed)', async () => {
    const owner = await registerOwner(app);
    const other = await registerOwner(app);
    const item = await createMenuItem(app, owner.token, { owner: other.userId });
    expect(item.owner).toBe(owner.userId);
  });

  test('rejects a non-numeric table in scan tracking', async () => {
    const owner = await registerOwner(app);
    const res = await request(app).post(`/api/users/${owner.userId}/scan/1.$where`);
    expect(res.status).toBe(400);
  });

  test('malformed JSON returns a JSON 400', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .set('Content-Type', 'application/json')
      .send('{"identifier": ');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_JSON');
  });

  test('unknown routes return a JSON 404', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
  });

  test('an invalid token is a 401 with a consistent body', async () => {
    const res = await request(app).get('/api/orders').set(auth('garbage'));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: expect.any(String), code: 'INVALID_TOKEN' });
  });
});

describe('error handler', () => {
  test('hides internal error details behind a generic 500', async () => {
    const express = require('express');
    const { errorHandler } = require('../src/middleware/error');
    const probe = express();
    probe.get('/boom', () => { throw new Error('connection string mongodb://admin:hunter2@db'); });
    probe.use(errorHandler);

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(probe).get('/boom');
    spy.mockRestore();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: expect.any(String), code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(res.body)).not.toMatch(/hunter2|stack|mongodb/);
  });
});
