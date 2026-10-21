const request = require('supertest');
const db = require('./helpers/db');
const createApp = require('../src/app');
const config = require('../src/config');
const { registerOwner, createMenuItem } = require('./helpers/factory');

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
    // FRONTEND_URL plus the staff app's two fixed origins
    expect(config.allowedOrigins).toEqual(['http://localhost:3000', 'https://localhost', 'capacitor://localhost']);
  });

  test('allows the staff app origins and nothing that only looks like them', async () => {
    for (const origin of ['https://localhost', 'capacitor://localhost']) {
      const res = await request(app).get('/health').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    }
    for (const origin of ['http://localhost', 'https://localhost:8443', 'https://localhost.evil.example', 'capacitor://evil', 'ionic://localhost']) {
      const res = await request(app).get('/health').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }
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

describe('compression', () => {
  test('JSON responses are gzipped for clients that accept it', async () => {
    const owner = await registerOwner(app);
    for (let i = 0; i < 12; i += 1) {
      await createMenuItem(app, owner.token, { name: `Dish number ${i}`, description: 'A long enough description to make the menu bigger than a kilobyte.' });
    }
    const res = await request(app).get(`/api/menu/${owner.userId}`).set('Accept-Encoding', 'gzip');
    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.body).toHaveLength(12);
  });
});
