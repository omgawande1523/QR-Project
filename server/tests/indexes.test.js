const db = require('./helpers/db');
const Order = require('../src/models/Order');
const MenuItem = require('../src/models/MenuItem');
const ServiceRequest = require('../src/models/ServiceRequest');
const User = require('../src/models/User');

beforeAll(db.connect);
afterAll(db.close);

async function indexKeys(Model) {
  await Model.syncIndexes();
  const indexes = await Model.collection.indexes();
  return indexes.map((index) => index.key);
}

describe('indexes', () => {
  test('orders are indexed by restaurant and newest first', async () => {
    expect(await indexKeys(Order)).toContainEqual({ restaurantId: 1, createdAt: -1 });
  });

  test('menu items are indexed by owner and category', async () => {
    expect(await indexKeys(MenuItem)).toContainEqual({ owner: 1, category: 1 });
  });

  test('pending service requests are indexed per restaurant', async () => {
    expect(await indexKeys(ServiceRequest)).toContainEqual({ restaurantId: 1, status: 1, timestamp: -1 });
  });

  test('restaurant emails are unique', async () => {
    expect(await indexKeys(User)).toContainEqual({ email: 1 });
  });

  test('the dashboard order query uses the index', async () => {
    const restaurantId = '0123456789abcdef01234567';
    await Order.create({ restaurantId, tableNumber: 1, totalAmount: 10 });
    const plan = await Order.find({ restaurantId }).sort({ createdAt: -1 }).explain('queryPlanner');
    expect(JSON.stringify(plan)).toContain('restaurantId_1_createdAt_-1');
  });
});
