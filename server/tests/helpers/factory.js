const request = require('supertest');

let counter = 0;

// Registers a restaurant owner through the API and returns its token and id.
async function registerOwner(app, overrides = {}) {
  counter += 1;
  const body = {
    email: `owner${counter}@test.local`,
    password: 'Passw0rd!123',
    restaurantName: `Test Restaurant ${counter}`,
    tables: [1, 2, 3],
    ...overrides
  };
  const res = await request(app).post('/api/users/register').send(body);
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, userId: res.body.userId, email: body.email, password: body.password };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function createMenuItem(app, token, overrides = {}) {
  const res = await request(app)
    .post('/api/menu')
    .set(auth(token))
    .send({ name: 'Paneer Tikka', description: 'Smoky', price: 250, category: 'Starters', ...overrides });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`create item failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

module.exports = { registerOwner, auth, createMenuItem };
