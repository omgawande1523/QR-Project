const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const request = require('supertest');
const sharp = require('sharp');
const db = require('./helpers/db');
const createApp = require('../src/app');
const config = require('../src/config');
const User = require('../src/models/User');
const Staff = require('../src/models/Staff');
const MenuItem = require('../src/models/MenuItem');
const Order = require('../src/models/Order');
const Session = require('../src/models/Session');
const Upload = require('../src/models/Upload');
const Counter = require('../src/models/Counter');
const { registerOwner, auth, createMenuItem } = require('./helpers/factory');

const app = createApp();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

const works = async (token) => (await request(app).get('/api/users/me').set(auth(token))).status === 200;

describe('account deletion', () => {
  test('an owner deletes the whole restaurant, its images and every device, with the password', async () => {
    const owner = await registerOwner(app);
    const other = await registerOwner(app);
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#a3ad4f' } }).png().toBuffer();
    const upload = await request(app).post('/api/uploads/menu').set(auth(owner.token)).attach('image', png, 'dish.png');
    const item = await createMenuItem(app, owner.token, { image: upload.body.url });
    await request(app).post('/api/orders').send({ restaurantId: owner.userId, tableNumber: 1, items: [{ menuItem: item._id, quantity: 1 }] });
    await request(app).post('/api/staff').set(auth(owner.token)).send({ name: 'Ravi', email: 'ravi@test.local', role: 'waiter', password: 'Staff@12345' });
    const staffToken = (await request(app).post('/api/users/login').send({ identifier: 'ravi@test.local', password: 'Staff@12345' })).body.token;
    await Counter.create({ _id: `${owner.userId}:invoice:2026-27`, seq: 3 });
    await Upload.create({ owner: owner.userId, role: 'final', key: new URL(upload.body.url).pathname.replace('/uploads/', ''), url: upload.body.url });
    const file = path.join(config.storage.uploadDir, new URL(upload.body.url).pathname.replace('/uploads/', ''));
    expect(fs.existsSync(file)).toBe(true);

    const wrong = await request(app).post('/api/users/delete-account').set(auth(owner.token)).send({ password: 'not-it' });
    expect(wrong.status).toBe(400);
    expect(await User.exists({ _id: owner.userId })).not.toBeNull();

    const res = await request(app).post('/api/users/delete-account').set(auth(owner.token)).send({ password: owner.password });
    expect(res.status).toBe(200);
    for (const [Model, filter] of [[User, { _id: owner.userId }], [MenuItem, { owner: owner.userId }], [Order, { restaurantId: owner.userId }],
      [Staff, { restaurant: owner.userId }], [Session, { restaurant: owner.userId }], [Upload, { owner: owner.userId }], [Counter, { _id: `${owner.userId}:invoice:2026-27` }]]) {
      expect(await Model.countDocuments(filter)).toBe(0);
    }
    expect(fs.existsSync(file)).toBe(false);
    expect(await works(owner.token)).toBe(false);
    expect(await works(staffToken)).toBe(false);
    expect(await works(other.token)).toBe(true); // other restaurants untouched
  });

  test('a staff member deletes only their own login', async () => {
    const owner = await registerOwner(app);
    await request(app).post('/api/staff').set(auth(owner.token)).send({ name: 'Meena', email: 'meena@test.local', role: 'kitchen', password: 'Staff@12345' });
    const token = (await request(app).post('/api/users/login').send({ identifier: 'meena@test.local', password: 'Staff@12345' })).body.token;
    const res = await request(app).post('/api/users/delete-account').set(auth(token)).send({ password: 'Staff@12345' });
    expect(res.status).toBe(200);
    expect(await Staff.exists({ email: 'meena@test.local' })).toBeNull();
    expect(await works(token)).toBe(false);
    expect(await works(owner.token)).toBe(true);
  });

  test('the demo restaurant cannot be deleted, and a login is required', async () => {
    const owner = await registerOwner(app);
    await User.updateOne({ _id: owner.userId }, { isDemo: true });
    const res = await request(app).post('/api/users/delete-account').set(auth(owner.token)).send({ password: owner.password });
    expect(res.status).toBe(403);
    expect((await request(app).post('/api/users/delete-account').send({ password: 'x' })).status).toBe(401);
  });
});

describe('app version', () => {
  test('reports the minimum and latest staff app versions', async () => {
    const res = await request(app).get('/api/app-version');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ minVersion: '1.0.0', latestVersion: '1.0.0', updateUrl: 'https://play.google.com/store/apps/details?id=com.qrmenu.staff' });
  });

  test('versions come from APP_MIN_VERSION, APP_LATEST_VERSION and APP_UPDATE_URL, and must look like 1.2.3', () => {
    const run = (env) => execFileSync(process.execPath, ['-e', "try { console.log(JSON.stringify(require('./src/config').app)) } catch (e) { console.log(e.message) }"], {
      cwd: path.join(__dirname, '..'),
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(64), ...env },
      encoding: 'utf8'
    });
    expect(JSON.parse(run({ APP_MIN_VERSION: '1.2.0', APP_LATEST_VERSION: '1.4.1', APP_UPDATE_URL: 'https://example.com/app' })))
      .toEqual({ minVersion: '1.2.0', latestVersion: '1.4.1', updateUrl: 'https://example.com/app' });
    expect(run({ APP_MIN_VERSION: 'one' })).toMatch(/APP_MIN_VERSION: must look like 1\.2\.3/);
  });
});
