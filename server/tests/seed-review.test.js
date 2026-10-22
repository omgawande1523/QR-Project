const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../src/models/User');
const Staff = require('../src/models/Staff');
const MenuItem = require('../src/models/MenuItem');
const Order = require('../src/models/Order');

const run = promisify(execFile);
let mongod;
let uploadDir;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('seed-review-test'));
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-seed-'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

const seed = (args, env = {}) => run(process.execPath, [path.join(__dirname, '..', 'scripts', 'seed.js'), ...args], {
  cwd: path.join(__dirname, '..'),
  env: {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    NODE_ENV: 'development',
    JWT_SECRET: 'x'.repeat(64),
    MONGODB_URI: mongod.getUri('seed-review-test'),
    STORAGE_DRIVER: 'local',
    UPLOAD_DIR: uploadDir,
    ...env
  }
});

describe('App Store review account (seed --review)', () => {
  test('creates "App Review Café" with owner, waiter and kitchen logins, a menu and live orders; re-running replaces only it', async () => {
    const other = await User.create({ email: 'someone@test.local', password: 'x', restaurantName: 'Real Café' });
    const { stdout } = await seed(['--review'], { REVIEW_PASSWORD: 'Review-Pass-2026' });
    expect(stdout).toContain('App Review Café');

    const owner = await User.findOne({ email: 'appreview@qrmenu.app' }).select('+password');
    expect(owner.restaurantName).toBe('App Review Café');
    expect(owner.isDemo).toBeFalsy(); // reviewers can try deleting the account
    expect(await bcrypt.compare('Review-Pass-2026', owner.password)).toBe(true);
    const staff = await Staff.find({ restaurant: owner._id }).lean();
    expect(staff.map((s) => [s.email, s.role]).sort()).toEqual([['appreview.kitchen@qrmenu.app', 'kitchen'], ['appreview.waiter@qrmenu.app', 'waiter']]);
    expect(await MenuItem.countDocuments({ owner: owner._id })).toBeGreaterThan(10);
    expect(await Order.countDocuments({ restaurantId: owner._id, status: { $in: ['pending', 'process', 'ready'] } })).toBeGreaterThan(0);

    const items = await MenuItem.countDocuments({ owner: owner._id });
    await seed(['--review'], { REVIEW_PASSWORD: 'Review-Pass-2026' });
    const again = await User.findOne({ email: 'appreview@qrmenu.app' });
    expect(String(again._id)).not.toBe(String(owner._id));
    expect(await MenuItem.countDocuments({ owner: again._id })).toBe(items);
    expect(await MenuItem.countDocuments({ owner: owner._id })).toBe(0);
    expect(await User.exists({ _id: other._id })).not.toBeNull();
    expect(await User.exists({ isDemo: true })).toBeNull(); // --review does not touch or create the demo restaurant
  }, 180000);

  test('in production it needs a strong REVIEW_PASSWORD', async () => {
    for (const REVIEW_PASSWORD of ['', 'short']) {
      await expect(seed(['--review'], { NODE_ENV: 'production', REVIEW_PASSWORD })).rejects.toMatchObject({ stderr: expect.stringContaining('REVIEW_PASSWORD') });
    }
  }, 60000);
});
