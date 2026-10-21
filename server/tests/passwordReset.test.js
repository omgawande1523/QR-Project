jest.mock('../src/services/mailer', () => ({
  isEmailConfigured: jest.fn(() => true),
  sendPasswordResetEmail: jest.fn(async () => {})
}));

const request = require('supertest');
const db = require('./helpers/db');
const createApp = require('../src/app');
const mailer = require('../src/services/mailer');
const User = require('../src/models/User');
const { registerOwner, auth } = require('./helpers/factory');

const app = createApp();

beforeAll(db.connect);
afterEach(async () => {
  await db.clear();
  jest.clearAllMocks();
  mailer.isEmailConfigured.mockReturnValue(true);
});
afterAll(db.close);

const lastCode = () => mailer.sendPasswordResetEmail.mock.calls.at(-1)[0].resetCode;

describe('password reset', () => {
  test('gives the same reply for registered and unknown emails', async () => {
    const owner = await registerOwner(app);
    const known = await request(app).post('/api/users/forgot-password').send({ email: owner.email });
    const unknown = await request(app).post('/api/users/forgot-password').send({ email: 'nobody@test.local' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(mailer.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  test('stores only a hash of the 8-character code', async () => {
    const owner = await registerOwner(app);
    await request(app).post('/api/users/forgot-password').send({ email: owner.email });

    const code = lastCode();
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    const stored = await User.findOne({ email: owner.email }).select('+resetCodeHash');
    expect(stored.resetCodeHash).toHaveLength(64);
    expect(stored.resetCodeHash).not.toContain(code);
  });

  test('a valid code resets the password once and signs out old sessions', async () => {
    const owner = await registerOwner(app);
    await request(app).post('/api/users/forgot-password').send({ email: owner.email });
    const code = lastCode();

    const reset = await request(app)
      .post('/api/users/reset-password')
      .send({ email: owner.email, token: code.toLowerCase(), newPassword: 'BrandNew!2345' });
    expect(reset.status).toBe(200);

    const oldSession = await request(app).get(`/api/users/${owner.userId}`).set(auth(owner.token));
    expect(oldSession.status).toBe(401);

    const login = await request(app).post('/api/users/login').send({ identifier: owner.email, password: 'BrandNew!2345' });
    expect(login.status).toBe(200);

    const reused = await request(app)
      .post('/api/users/reset-password')
      .send({ email: owner.email, token: code, newPassword: 'Another!2345' });
    expect(reused.status).toBe(400);
  });

  test('a code is discarded after 5 wrong guesses', async () => {
    const owner = await registerOwner(app);
    await request(app).post('/api/users/forgot-password').send({ email: owner.email });
    const code = lastCode();

    for (let i = 0; i < 5; i += 1) {
      const wrong = await request(app)
        .post('/api/users/reset-password')
        .send({ email: owner.email, token: 'WRONG234', newPassword: 'BrandNew!2345' });
      expect(wrong.body.code).toBe('INVALID_RESET_CODE');
    }
    const right = await request(app)
      .post('/api/users/reset-password')
      .send({ email: owner.email, token: code, newPassword: 'BrandNew!2345' });
    expect(right.status).toBe(400);
  });

  test('an unknown email and a wrong code fail the same way', async () => {
    const res = await request(app)
      .post('/api/users/reset-password')
      .send({ email: 'nobody@test.local', token: 'ABCDEFGH', newPassword: 'BrandNew!2345' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid or expired reset code');
  });

  test('reports clearly when email is not configured', async () => {
    mailer.isEmailConfigured.mockReturnValue(false);
    const res = await request(app).post('/api/users/forgot-password').send({ email: 'a@test.local' });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('EMAIL_NOT_CONFIGURED');
  });
});

describe('change password', () => {
  test('returns a fresh token and signs out older sessions', async () => {
    const owner = await registerOwner(app);
    const secondDevice = await request(app).post('/api/users/login').send({ identifier: owner.email, password: owner.password });

    const res = await request(app)
      .post(`/api/users/${owner.userId}/change-password`)
      .set(auth(owner.token))
      .send({ currentPassword: owner.password, newPassword: 'Changed!2345' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));

    expect((await request(app).get(`/api/users/${owner.userId}`).set(auth(secondDevice.body.token))).status).toBe(401);
    expect((await request(app).get(`/api/users/${owner.userId}`).set(auth(res.body.token))).status).toBe(200);
  });

  test('profile responses never include password or reset fields', async () => {
    const owner = await registerOwner(app);
    const res = await request(app).get(`/api/users/${owner.userId}`).set(auth(owner.token));
    ['password', 'resetCodeHash', 'resetCodeExpiry', 'tokenVersion'].forEach((field) => {
      expect(res.body[field]).toBeUndefined();
    });
  });
});
