const crypto = require('crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { io: connect } = require('socket.io-client');
const db = require('./helpers/db');
const config = require('../src/config');
const User = require('../src/models/User');
const Session = require('../src/models/Session');
const { createServer } = require('../src/server');
const { describeBrowser } = require('../src/services/sessions');
const { registerOwner, auth } = require('./helpers/factory');

let app;
let server;
let ioServer;
let url;

beforeAll(async () => {
  await db.connect();
  ({ app, server, io: ioServer } = createServer());
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
afterEach(db.clear);
afterAll(async () => {
  ioServer.close();
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});

const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const appHeaders = (name = 'Samsung Galaxy Tab A8') => ({ 'X-Client': 'app', 'X-Device-Name': name });

async function login(identifier, password, headers = { 'User-Agent': CHROME_WINDOWS }) {
  const res = await request(app).post('/api/users/login').set(headers).send({ identifier, password });
  expect(res.status).toBe(200);
  return res.body.token;
}

const works = async (token) => (await request(app).get('/api/users/me').set(auth(token))).status === 200;

async function addStaff(ownerToken, role, email = `${role}${Date.now()}@test.local`) {
  const res = await request(app).post('/api/staff').set(auth(ownerToken)).send({ name: `A ${role}`, email, role, password: 'Staff@12345' });
  expect(res.status).toBe(201);
  return { id: res.body._id, email, password: 'Staff@12345' };
}

describe('sessions', () => {
  test('each login is a session listed with its device; the app gets a 30-day token', async () => {
    const owner = await registerOwner(app);
    const web = await login(owner.email, owner.password);
    const phone = await login(owner.email, owner.password, appHeaders());

    expect(jwt.decode(web).sid).toBeDefined();
    const days = (token) => Math.round((jwt.decode(token).exp - jwt.decode(token).iat) / 86400);
    expect(days(web)).toBe(7);
    expect(days(phone)).toBe(30);

    const res = await request(app).get('/api/sessions').set(auth(phone));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ client: 'app', deviceName: 'Samsung Galaxy Tab A8', current: true, notifications: false }),
      expect.objectContaining({ client: 'web', deviceName: 'Chrome on Windows', current: false })
    ]));
    // registerOwner's own sign-up session is listed too
    expect(res.body).toHaveLength(3);
  });

  test('signing out one device ends only that device', async () => {
    const owner = await registerOwner(app);
    const web = await login(owner.email, owner.password);
    const phone = await login(owner.email, owner.password, appHeaders());

    const del = await request(app).delete(`/api/sessions/${jwt.decode(phone).sid}`).set(auth(web));
    expect(del.status).toBe(204);
    expect(await works(phone)).toBe(false);
    expect(await works(web)).toBe(true);
    expect(await Session.exists({ _id: jwt.decode(phone).sid })).toBeNull();

    const again = await request(app).delete(`/api/sessions/${jwt.decode(phone).sid}`).set(auth(web));
    expect(again.status).toBe(404);
  });

  test('a login cannot see or end another login\'s sessions', async () => {
    const a = await registerOwner(app);
    const b = await registerOwner(app);
    const res = await request(app).get('/api/sessions').set(auth(a.token));
    expect(res.body.every((s) => s.id !== jwt.decode(b.token).sid)).toBe(true);
    const del = await request(app).delete(`/api/sessions/${jwt.decode(b.token).sid}`).set(auth(a.token));
    expect(del.status).toBe(404);
    expect(await works(b.token)).toBe(true);
  });

  test('signing out this device', async () => {
    const owner = await registerOwner(app);
    const res = await request(app).delete('/api/sessions/current').set(auth(owner.token));
    expect(res.status).toBe(204);
    expect(await works(owner.token)).toBe(false);
  });

  test('sign out everywhere ends every other device and keeps this one with a new token', async () => {
    const owner = await registerOwner(app);
    const phone = await login(owner.email, owner.password, appHeaders());
    const laptop = await login(owner.email, owner.password);
    // A token from before sessions existed (no sid) is ended too, through tokenVersion.
    const legacy = jwt.sign({ userId: owner.userId, tv: 0 }, config.jwtSecret, { expiresIn: '7d' });
    expect(await works(legacy)).toBe(true);

    const res = await request(app).post('/api/sessions/sign-out-everywhere').set(auth(laptop));
    expect(res.status).toBe(200);
    expect(res.body.signedOut).toBe(2); // the phone and the sign-up session
    expect(await works(phone)).toBe(false);
    expect(await works(legacy)).toBe(false);
    expect(await works(laptop)).toBe(false); // old token of this device
    expect(await works(res.body.token)).toBe(true);
    expect(jwt.decode(res.body.token).sid).toBe(jwt.decode(laptop).sid);
  });

  test('changing the password signs out every other device, the app included', async () => {
    const owner = await registerOwner(app);
    const phone = await login(owner.email, owner.password, appHeaders());
    await request(app).put('/api/sessions/current/push').set(auth(phone)).send({ token: 'fcm-token-of-the-phone-1234567890', platform: 'android' });

    const res = await request(app).post(`/api/users/${owner.userId}/change-password`).set(auth(owner.token))
      .send({ currentPassword: owner.password, newPassword: 'NewPassw0rd!456' });
    expect(res.status).toBe(200);
    expect(await works(phone)).toBe(false);
    expect(await Session.exists({ 'push.token': 'fcm-token-of-the-phone-1234567890' })).toBeNull();
    expect(await works(res.body.token)).toBe(true);
  });

  test('a password reset by email code signs out every device', async () => {
    const owner = await registerOwner(app);
    const phone = await login(owner.email, owner.password, appHeaders());
    const code = 'ABCD2345';
    await User.updateOne({ _id: owner.userId }, {
      resetCodeHash: crypto.createHash('sha256').update(code).digest('hex'),
      resetCodeExpiry: new Date(Date.now() + 600000)
    });
    const res = await request(app).post('/api/users/reset-password').send({ email: owner.email, token: code, newPassword: 'NewPassw0rd!456' });
    expect(res.status).toBe(200);
    expect(await works(phone)).toBe(false);
    expect(await works(owner.token)).toBe(false);
    expect(await Session.countDocuments({ restaurant: owner.userId })).toBe(0);
    // ...and the new password works in the app.
    expect(await works(await login(owner.email, 'NewPassw0rd!456', appHeaders()))).toBe(true);
  });

  test('a staff role change, deactivation, password reset or removal ends that person\'s sessions', async () => {
    const owner = await registerOwner(app);
    const changes = [
      (id) => request(app).patch(`/api/staff/${id}`).set(auth(owner.token)).send({ role: 'manager' }),
      (id) => request(app).patch(`/api/staff/${id}`).set(auth(owner.token)).send({ active: false }),
      (id) => request(app).post(`/api/staff/${id}/password`).set(auth(owner.token)).send({ password: 'Other@12345' }),
      (id) => request(app).delete(`/api/staff/${id}`).set(auth(owner.token))
    ];
    for (const change of changes) {
      const staff = await addStaff(owner.token, 'waiter');
      const phone = await login(staff.email, staff.password, appHeaders('Waiter phone'));
      expect(await works(phone)).toBe(true);
      expect((await change(staff.id)).status).toBeLessThan(300);
      expect(await works(phone)).toBe(false);
      expect(await Session.countDocuments({ staff: staff.id })).toBe(0);
    }
    expect(await works(owner.token)).toBe(true);
  });

  test('staff see and manage only their own sessions', async () => {
    const owner = await registerOwner(app);
    const staff = await addStaff(owner.token, 'kitchen');
    const tablet = await login(staff.email, staff.password, appHeaders('Kitchen tablet'));
    const res = await request(app).get('/api/sessions').set(auth(tablet));
    expect(res.body).toEqual([expect.objectContaining({ deviceName: 'Kitchen tablet', current: true })]);

    const ownerSession = jwt.decode(owner.token).sid;
    expect((await request(app).delete(`/api/sessions/${ownerSession}`).set(auth(tablet))).status).toBe(404);
  });

  test('the app renews its token for the same session; tokens from before sessions cannot', async () => {
    const owner = await registerOwner(app);
    const phone = await login(owner.email, owner.password, appHeaders());
    const res = await request(app).post('/api/sessions/refresh').set(auth(phone));
    expect(res.status).toBe(200);
    expect(jwt.decode(res.body.token).sid).toBe(jwt.decode(phone).sid);
    expect(await works(res.body.token)).toBe(true);

    const legacy = jwt.sign({ userId: owner.userId, tv: 0 }, config.jwtSecret, { expiresIn: '7d' });
    const old = await request(app).post('/api/sessions/refresh').set(auth(legacy));
    expect(old.status).toBe(409);
    expect(old.body.code).toBe('SIGN_IN_AGAIN');
  });

  test('a signed-out device loses its live socket at once', async () => {
    const owner = await registerOwner(app);
    const phone = await login(owner.email, owner.password, appHeaders());
    const socket = connect(url, { transports: ['websocket'], forceNew: true, reconnection: false, auth: { token: phone } });
    await new Promise((resolve, reject) => { socket.on('connect', resolve); socket.on('connect_error', reject); });

    const dropped = new Promise((resolve) => socket.on('disconnect', resolve));
    await request(app).delete(`/api/sessions/${jwt.decode(phone).sid}`).set(auth(owner.token));
    await expect(dropped).resolves.toBe('io server disconnect');
  });

  test('Socket.io accepts the staff app origins', async () => {
    for (const origin of ['https://localhost', 'capacitor://localhost']) {
      const res = await request(server).get('/socket.io/?EIO=4&transport=polling').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    }
    const evil = await request(server).get('/socket.io/?EIO=4&transport=polling').set('Origin', 'https://localhost.evil.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('the app tells whether it runs on iOS or Android; iOS devices can be listed and signed out', async () => {
    const owner = await registerOwner(app);
    const login = (headers) => request(app).post('/api/users/login').set(headers).send({ identifier: owner.email, password: owner.password });
    const iphone = await login({ 'X-Client': 'app', 'X-Platform': 'ios', 'X-Device-Name': 'Apple iPhone' });
    await login({ 'X-Client': 'app', 'X-Platform': 'ios' }); // no device name
    await login({ 'X-Client': 'app' }); // the first Android app sent no platform
    await login({ 'X-Platform': 'ios', 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1' });

    const list = (await request(app).get('/api/sessions').set(auth(iphone.body.token))).body;
    const rows = list.map((s) => [s.client, s.platform, s.deviceName]).sort();
    expect(rows).toEqual([
      ['app', 'android', 'Android app'],
      ['app', 'ios', 'Apple iPhone'],
      ['app', 'ios', 'iPhone app'],
      ['web', 'web', expect.any(String)], // the registerOwner sign-up
      ['web', 'web', 'Safari on iPhone'] // a browser cannot claim to be the app
    ].sort());

    const other = list.find((s) => s.platform === 'ios' && !s.current);
    expect((await request(app).delete(`/api/sessions/${other.id}`).set(auth(owner.token))).status).toBe(204);
    expect((await request(app).get('/api/sessions').set(auth(iphone.body.token))).body).toHaveLength(4);
  });

  test('browser names for the sessions list', () => {
    expect(describeBrowser(CHROME_WINDOWS)).toBe('Chrome on Windows');
    expect(describeBrowser('Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36')).toBe('Samsung Internet on Android');
    expect(describeBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iPhone');
    expect(describeBrowser('')).toBe('Browser');
  });
});
