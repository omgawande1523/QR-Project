const request = require('supertest');
const createApp = require('../src/app');

// No database connection in this file: /health must report it.
describe('health', () => {
  test('returns 503 while MongoDB is disconnected', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'unhealthy', mongodb: 'disconnected' });
  });
});
