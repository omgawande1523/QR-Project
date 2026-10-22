const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/db');
const createApp = require('../src/app');
const config = require('../src/config');
const Order = require('../src/models/Order');
const Session = require('../src/models/Session');
const push = require('../src/services/push');
const { createFcmSender, loadServiceAccount } = require('../src/services/push/fcmSender');
const { registerOwner, auth, createMenuItem } = require('./helpers/factory');

const app = createApp();

beforeAll(db.connect);
beforeEach(() => push.setSender(push.createMockSender()));
afterEach(async () => {
  await push.idle();
  await db.clear();
});
afterAll(db.close);

const appHeaders = { 'X-Client': 'app', 'X-Device-Name': 'Test phone' };
const sent = () => push.getSender().sent;
const tokensFor = (type) => sent().filter((m) => m.data.type === type).map((m) => m.token).sort();

async function signInApp(identifier, password, fcmToken, prefs, platform = 'android') {
  const login = await request(app).post('/api/users/login').set({ ...appHeaders, 'X-Platform': platform }).send({ identifier, password });
  expect(login.status).toBe(200);
  const reg = await request(app).put('/api/sessions/current/push').set(auth(login.body.token))
    .send({ token: fcmToken, platform, ...(prefs ? { prefs } : {}) });
  expect(reg.status).toBe(200);
  return login.body.token;
}

// A restaurant with an app signed in for every role, each with its own push token (prefix keeps two
// restaurants' tokens apart: one token belongs to one device).
async function restaurantWithTeam(prefix = 'token') {
  const owner = await registerOwner(app);
  const devices = { owner: await signInApp(owner.email, owner.password, `${prefix}-owner-0000000000000000`) };
  for (const role of ['manager', 'waiter', 'kitchen']) {
    const email = `${role}.${owner.userId}@test.local`;
    await request(app).post('/api/staff').set(auth(owner.token)).send({ name: role, email, role, password: 'Staff@12345' });
    devices[role] = await signInApp(email, 'Staff@12345', `${prefix}-${role}-0000000000000000`);
  }
  const item = await createMenuItem(app, owner.token, { name: 'Masala Dosa', price: 120 });
  return { owner, devices, item };
}

const placeOrder = (restaurantId, item, tableNumber = 2) => request(app).post('/api/orders')
  .send({ restaurantId, tableNumber, customerName: 'Asha', items: [{ menuItem: item._id, quantity: 2 }] });

describe('device registration', () => {
  test('registers, updates switches and removes this device\'s push token', async () => {
    const owner = await registerOwner(app);
    const reg = await request(app).put('/api/sessions/current/push').set(auth(owner.token))
      .send({ token: 'device-token-1234567890abcdef', platform: 'android' });
    expect(reg.status).toBe(200);
    expect(reg.body).toMatchObject({ notifications: true, prefs: { newOrder: true, tableRequest: true, orderReady: true } });

    const off = await request(app).put('/api/sessions/current/push').set(auth(owner.token)).send({ prefs: { tableRequest: false } });
    expect(off.body.prefs).toMatchObject({ newOrder: true, tableRequest: false });

    const list = await request(app).get('/api/sessions').set(auth(owner.token));
    expect(list.body[0].notifications).toBe(true);
    expect(list.body[0].prefs).toMatchObject({ newOrder: true, tableRequest: false }); // this device's own switches

    expect((await request(app).delete('/api/sessions/current/push').set(auth(owner.token))).status).toBe(204);
    expect(await Session.exists({ 'push.token': 'device-token-1234567890abcdef' })).toBeNull();
  });

  test('a token moves to the newest session on the same phone', async () => {
    const owner = await registerOwner(app);
    const first = await signInApp(owner.email, owner.password, 'shared-phone-token-1234567890');
    const second = await signInApp(owner.email, owner.password, 'shared-phone-token-1234567890');
    expect(await Session.countDocuments({ 'push.token': 'shared-phone-token-1234567890' })).toBe(1);
    expect((await Session.findOne({ 'push.token': 'shared-phone-token-1234567890' })).id).toBe(jwt.decode(second).sid);
    expect(first).not.toBe(second);
  });

  test('rejects bad input and tokens from before sessions existed', async () => {
    const owner = await registerOwner(app);
    const noPlatform = await request(app).put('/api/sessions/current/push').set(auth(owner.token)).send({ token: 'device-token-1234567890abcdef' });
    expect(noPlatform.status).toBe(400);
    const unknownType = await request(app).put('/api/sessions/current/push').set(auth(owner.token)).send({ prefs: { marketing: true } });
    expect(unknownType.status).toBe(400);

    const legacy = jwt.sign({ userId: owner.userId, tv: 0 }, config.jwtSecret, { expiresIn: '7d' });
    const res = await request(app).put('/api/sessions/current/push').set(auth(legacy)).send({ token: 'device-token-1234567890abcdef', platform: 'android' });
    expect(res.status).toBe(409);
  });
});

describe('push fan-out', () => {
  test('a new order goes to the owner, manager and kitchen, not the waiter', async () => {
    const { owner, item } = await restaurantWithTeam();
    expect((await placeOrder(owner.userId, item)).status).toBe(201);
    await push.idle();
    expect(tokensFor('newOrder')).toEqual(['token-kitchen-0000000000000000', 'token-manager-0000000000000000', 'token-owner-0000000000000000']);

    const message = sent()[0];
    expect(message.notification).toEqual({ title: 'New order · Table 2', body: '2× Masala Dosa' });
    expect(message.android).toMatchObject({ priority: 'HIGH', notification: { channel_id: 'new_orders', notification_priority: 'PRIORITY_MAX' } });
    expect(Object.values(message.data).every((v) => typeof v === 'string')).toBe(true);
    expect(message.data).toMatchObject({ type: 'newOrder', tableNumber: '2' });
  });

  test('a waiter call or bill request goes to the owner, manager and waiter', async () => {
    const { owner } = await restaurantWithTeam();
    const res = await request(app).post('/api/service-requests').send({ restaurantId: owner.userId, tableNumber: 3, type: 'Bill' });
    expect(res.status).toBe(201);
    await push.idle();
    expect(tokensFor('tableRequest')).toEqual(['token-manager-0000000000000000', 'token-owner-0000000000000000', 'token-waiter-0000000000000000']);
    expect(sent()[0].notification.title).toBe('Bill requested · Table 3');
    expect(sent()[0].android.notification.channel_id).toBe('table_requests');
  });

  test('an order that becomes ready goes to the waiter, once', async () => {
    const { owner, devices, item } = await restaurantWithTeam();
    const order = (await placeOrder(owner.userId, item)).body;
    await push.idle();
    push.setSender(push.createMockSender());

    for (const status of ['process', 'ready', 'ready']) {
      const res = await request(app).put(`/api/orders/${order._id}`).set(auth(devices.kitchen)).send({ status });
      expect(res.status).toBe(200);
    }
    await push.idle();
    expect(tokensFor('orderReady')).toEqual(['token-waiter-0000000000000000']);
    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toMatchObject({ data: { orderId: order._id }, android: { notification: { channel_id: 'order_ready' } } });
  });

  test('a type switched off on one device is not sent to it', async () => {
    const { owner, item } = await restaurantWithTeam();
    await signInApp(owner.email, owner.password, 'token-owner-tablet-000000000000', { newOrder: false });
    await placeOrder(owner.userId, item);
    await push.idle();
    expect(tokensFor('newOrder')).not.toContain('token-owner-tablet-000000000000');
    expect(tokensFor('newOrder')).toContain('token-owner-0000000000000000');
  });

  test('other restaurants\' devices are never notified, and nothing is sent after sign-out', async () => {
    const first = await restaurantWithTeam();
    const second = await restaurantWithTeam('other');
    await request(app).delete('/api/sessions/current').set(auth(first.devices.kitchen));
    await placeOrder(first.owner.userId, first.item);
    await push.idle();
    expect(tokensFor('newOrder')).toEqual(['token-manager-0000000000000000', 'token-owner-0000000000000000']);
    expect(await Session.countDocuments({ restaurant: second.owner.userId, 'push.token': { $exists: true } })).toBe(4);
  });

  test('tokens of uninstalled apps are removed; other devices still get it', async () => {
    const { owner, item } = await restaurantWithTeam();
    push.getSender().unregistered.add('token-manager-0000000000000000');
    const result = await push.notify(owner.userId, 'newOrder', { _id: 'o1', tableNumber: 1, items: [{ quantity: 1, menuItemName: item.name }] });
    await push.idle();
    expect(result).toEqual({ sent: 2, removed: 1, failed: 0 });
    expect(await Session.exists({ 'push.token': 'token-manager-0000000000000000' })).toBeNull();
  });

  test('is sent after the order is saved, and a failing sender never breaks the order', async () => {
    const { owner, item } = await restaurantWithTeam();
    const seenInDatabase = [];
    push.setSender({ name: 'probe', async send(message) { seenInDatabase.push(Boolean(await Order.exists({ _id: message.data.orderId }))); return { ok: true }; } });
    await placeOrder(owner.userId, item);
    await push.idle();
    expect(seenInDatabase).toEqual([true, true, true]);

    push.setSender({ name: 'broken', send: async () => { throw new Error('network down'); } });
    const res = await placeOrder(owner.userId, item);
    expect(res.status).toBe(201);
    await push.idle();
  });
});

describe('iPhone and iPad', () => {
  // The owner and the waiter use iPhones, the kitchen an Android tablet.
  async function mixedTeam() {
    const owner = await registerOwner(app);
    await signInApp(owner.email, owner.password, 'ios-owner-000000000000000000', undefined, 'ios');
    const devices = {};
    for (const [role, platform] of [['waiter', 'ios'], ['kitchen', 'android']]) {
      const email = `${role}.${owner.userId}@test.local`;
      await request(app).post('/api/staff').set(auth(owner.token)).send({ name: role, email, role, password: 'Staff@12345' });
      devices[role] = await signInApp(email, 'Staff@12345', `${platform}-${role}-000000000000000000`, undefined, platform);
    }
    const item = await createMenuItem(app, owner.token, { name: 'Masala Dosa', price: 120 });
    return { owner, devices, item };
  }
  const messageTo = (token) => sent().find((m) => m.token === token);

  test('the device token records its platform', async () => {
    const { owner } = await mixedTeam();
    const platforms = await Session.find({ restaurant: owner.userId }).select('push.platform').lean();
    expect(platforms.map((s) => s.push.platform).sort()).toEqual(['android', 'ios', 'ios']);
  });

  test('a new order reaches an iPhone through APNs with its sound, time-sensitive, and Android with its channel', async () => {
    const { owner, item } = await mixedTeam();
    await placeOrder(owner.userId, item);
    await push.idle();
    const iphone = messageTo('ios-owner-000000000000000000');
    expect(iphone.notification).toEqual({ title: 'New order · Table 2', body: '2× Masala Dosa' });
    expect(iphone.android).toBeUndefined();
    expect(iphone.apns.headers).toMatchObject({ 'apns-priority': '10', 'apns-push-type': 'alert' });
    expect(Number(iphone.apns.headers['apns-expiration'])).toBeGreaterThan(Date.now() / 1000);
    expect(iphone.apns.payload.aps).toMatchObject({ sound: 'new_order.wav', 'interruption-level': 'time-sensitive', 'thread-id': 'new_orders' });
    expect(iphone.data).toMatchObject({ type: 'newOrder', orderId: expect.any(String) }); // tapping opens the order

    const tablet = messageTo('android-kitchen-000000000000000000');
    expect(tablet.apns).toBeUndefined();
    expect(tablet.android.notification.channel_id).toBe('new_orders');
  });

  test('a waiter call is time-sensitive on iPhone; an order ready is an ordinary alert', async () => {
    const { owner, devices, item } = await mixedTeam();
    await request(app).post('/api/service-requests').send({ restaurantId: owner.userId, tableNumber: 3, type: 'Waiter' });
    const order = (await placeOrder(owner.userId, item)).body;
    await push.idle();
    expect(messageTo('ios-waiter-000000000000000000').apns.payload.aps).toMatchObject({ sound: 'table_request.wav', 'interruption-level': 'time-sensitive' });

    push.setSender(push.createMockSender());
    await request(app).put(`/api/orders/${order._id}`).set(auth(devices.kitchen)).send({ status: 'ready' });
    await push.idle();
    expect(sent()).toHaveLength(1);
    expect(sent()[0].apns.payload.aps).toMatchObject({ sound: 'order_ready.wav', 'interruption-level': 'active', 'thread-id': 'order_ready' });
  });

  test('buildMessage: one platform block per message; a token without a platform is Android', () => {
    const order = { _id: 'o1', tableNumber: 4, items: [{ quantity: 1, menuItemName: 'Chai' }] };
    expect(push.buildMessage('t', 'newOrder', order, 'ios')).toMatchObject({ token: 't', apns: { headers: { 'apns-collapse-id': 'order-o1' } } });
    expect(push.buildMessage('t', 'newOrder', order)).toHaveProperty('android');
    expect(push.buildMessage('t', 'newOrder', order)).not.toHaveProperty('apns');
  });
});

describe('FCM sender', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const serviceAccount = {
    type: 'service_account',
    project_id: 'qr-menu-test',
    client_email: 'push@qr-menu-test.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    token_uri: 'https://oauth2.googleapis.com/token'
  };

  function fakeGoogle(sendStatus = 200, sendBody = {}) {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
      if (url === serviceAccount.token_uri) return json(200, { access_token: 'ya29.test', expires_in: 3600 });
      return json(sendStatus, sendBody);
    };
    return { calls, fetchImpl };
  }

  test('signs in with a service-account JWT, caches the access token and sends v1 messages', async () => {
    const google = fakeGoogle();
    const sender = createFcmSender(serviceAccount, { fetchImpl: google.fetchImpl });
    const message = push.buildMessage('device-token', 'newOrder', { _id: 'o1', tableNumber: 4, items: [{ quantity: 1, menuItemName: 'Chai' }] });
    expect(await sender.send(message)).toEqual({ ok: true });
    expect(await sender.send(message)).toEqual({ ok: true });

    const tokenCalls = google.calls.filter((c) => c.url === serviceAccount.token_uri);
    expect(tokenCalls).toHaveLength(1);
    const assertion = new URLSearchParams(tokenCalls[0].init.body).get('assertion');
    const claims = jwt.verify(assertion, publicKey.export({ type: 'spki', format: 'pem' }), { algorithms: ['RS256'] });
    expect(claims).toMatchObject({ iss: serviceAccount.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: serviceAccount.token_uri });

    const sendCall = google.calls.find((c) => c.url.includes('messages:send'));
    expect(sendCall.url).toBe('https://fcm.googleapis.com/v1/projects/qr-menu-test/messages:send');
    expect(sendCall.init.headers.Authorization).toBe('Bearer ya29.test');
    expect(JSON.parse(sendCall.init.body).message).toMatchObject({ token: 'device-token', notification: { title: 'New order · Table 4' } });
  });

  test('reports uninstalled apps as unregistered', async () => {
    const gone = createFcmSender(serviceAccount, fakeGoogle(404, { error: { status: 'NOT_FOUND', message: 'Requested entity was not found.', details: [{ errorCode: 'UNREGISTERED' }] } }));
    expect(await gone.send({ token: 'x' })).toMatchObject({ ok: false, unregistered: true });
    const busy = createFcmSender(serviceAccount, fakeGoogle(503, { error: { status: 'UNAVAILABLE', message: 'try later' } }));
    expect(await busy.send({ token: 'x' })).toMatchObject({ ok: false, unregistered: false });
  });

  test('reads the key from JSON or a file path and refuses anything else', () => {
    expect(loadServiceAccount('')).toBeNull();
    expect(loadServiceAccount(JSON.stringify(serviceAccount)).project_id).toBe('qr-menu-test');
    const file = path.join(os.tmpdir(), `qr-menu-sa-${process.pid}.json`);
    fs.writeFileSync(file, JSON.stringify(serviceAccount));
    expect(loadServiceAccount(file).client_email).toBe(serviceAccount.client_email);
    fs.rmSync(file);
    expect(() => loadServiceAccount('{ not json')).toThrow('not valid JSON');
    expect(() => loadServiceAccount(JSON.stringify({ type: 'authorized_user' }))).toThrow('service-account key');
  });
});
