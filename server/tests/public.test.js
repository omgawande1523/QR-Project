jest.mock('../src/services/mailer', () => ({
  isEmailConfigured: jest.fn(() => false),
  sendPasswordResetEmail: jest.fn(async () => {}),
  sendLeadNotification: jest.fn(async () => {})
}));

const request = require('supertest');
const db = require('./helpers/db');
const createApp = require('../src/app');
const mailer = require('../src/services/mailer');
const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const { registerOwner } = require('./helpers/factory');

const app = createApp();

beforeAll(db.connect);
afterEach(async () => {
  await db.clear();
  jest.clearAllMocks();
});
afterAll(db.close);

describe('demo restaurant lookup', () => {
  test('returns 404 until a demo restaurant exists', async () => {
    const res = await request(app).get('/api/public/demo');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NO_DEMO');
  });

  test('returns the demo restaurant id and its first table', async () => {
    const owner = await registerOwner(app, { tables: [3, 4] });
    await User.updateOne({ _id: owner.userId }, { isDemo: true });
    const res = await request(app).get('/api/public/demo');
    expect(res.body).toEqual({ restaurantId: owner.userId, table: 3 });
  });

  test('isDemo cannot be set through the profile API', async () => {
    const owner = await registerOwner(app);
    await request(app).put(`/api/users/${owner.userId}`).set('Authorization', `Bearer ${owner.token}`).send({ isDemo: true });
    expect((await request(app).get('/api/public/demo')).status).toBe(404);
  });
});

describe('contact form', () => {
  const valid = { name: 'Asha', email: 'asha@cafe.test', phone: '98765 43210', restaurantName: 'Chai Point', message: 'Please call me about pricing.' };

  test('stores the enquiry', async () => {
    const res = await request(app).post('/api/public/contact').send(valid);
    expect(res.status).toBe(201);
    const lead = await Lead.findOne();
    expect(lead).toMatchObject({ name: 'Asha', email: 'asha@cafe.test', phone: '9876543210' });
    expect(mailer.sendLeadNotification).not.toHaveBeenCalled();
  });

  test('emails a notification when SMTP is configured', async () => {
    mailer.isEmailConfigured.mockReturnValueOnce(true);
    await request(app).post('/api/public/contact').send(valid);
    expect(mailer.sendLeadNotification).toHaveBeenCalledTimes(1);
  });

  test('validates the fields', async () => {
    const res = await request(app).post('/api/public/contact').send({ name: '', email: 'nope', message: 'hi' });
    expect(res.status).toBe(400);
    const fields = res.body.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'message']));
  });
});
