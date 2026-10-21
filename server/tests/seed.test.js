const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const request = require('supertest');
const mongoose = require('mongoose');
const db = require('./helpers/db');
const createApp = require('../src/app');

const run = promisify(execFile);
const app = createApp();

beforeAll(db.connect);
afterAll(db.close);

// Runs scripts/seed.js in a child process against the same in-memory database.
function seed() {
  const uri = mongoose.connection.getClient().options.hosts
    .map((h) => `${h.host}:${h.port}`).join(',');
  return run(process.execPath, [path.join(__dirname, '..', 'scripts', 'seed.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, MONGODB_URI: `mongodb://${uri}/${mongoose.connection.name}` }
  });
}

describe('seed script', () => {
  test('creates the demo restaurant and can be re-run', async () => {
    await seed();
    const { stdout } = await seed();
    expect(stdout).toContain('Replaced the existing demo restaurant.');

    const login = await request(app)
      .post('/api/users/login')
      .send({ identifier: 'demo@qrmenu.test', password: 'Demo@1234' });
    expect(login.status).toBe(200);

    const menu = await request(app).get(`/api/menu/${login.body.userId}`);
    expect(menu.body.length).toBeGreaterThanOrEqual(20);
    expect(menu.body.every((item) => item.image.includes('/uploads/menu/'))).toBe(true);

    const orders = await request(app).get('/api/orders').set('Authorization', `Bearer ${login.body.token}`);
    expect(orders.body).toHaveLength(8);
    expect(orders.body.every((order) => order.totalAmount > 0)).toBe(true);

    const profile = await request(app).get(`/api/users/${login.body.userId}/public`);
    expect(profile.body).toMatchObject({ restaurantName: 'Olive Leaf Café', tables: [1, 2, 3, 4, 5], taxPercent: 5 });
  }, 60000);
});
