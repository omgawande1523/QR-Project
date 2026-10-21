const request = require('supertest');
const db = require('./helpers/db');
const createApp = require('../src/app');
const config = require('../src/config');
const { registerOwner } = require('./helpers/factory');

const app = createApp();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('CORS', () => {
  test('allows the configured frontend origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  test('does not allow other origins (including the old hardcoded Netlify site)', async () => {
    for (const origin of ['https://evil.example', 'https://qrmenusystem.netlify.app']) {
      const res = await request(app).get('/health').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }
  });

  test('the API info endpoint no longer lists allowed origins', async () => {
    const res = await request(app).get('/api');
    expect(res.body.cors).toBeUndefined();
  });

  test('dev-only localhost origins are not added outside development', () => {
    expect(config.env).toBe('test');
    expect(config.allowedOrigins).toEqual(['http://localhost:3000']);
  });
});

describe('scan tracking', () => {
  test('counts a real table without exposing the stats', async () => {
    const owner = await registerOwner(app);
    const res = await request(app).post(`/api/users/${owner.userId}/scan/2`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Scan recorded' });
  });

  test('rejects a table the restaurant does not have', async () => {
    const owner = await registerOwner(app);
    const res = await request(app).post(`/api/users/${owner.userId}/scan/77`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNKNOWN_TABLE');
  });

  test('returns 404 for an unknown restaurant', async () => {
    const res = await request(app).post('/api/users/0123456789abcdef01234567/scan/1');
    expect(res.status).toBe(404);
  });
});
