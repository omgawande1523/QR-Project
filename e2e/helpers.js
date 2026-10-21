const API = 'http://localhost:5000';

async function demo(request) {
  const res = await request.get(`${API}/api/public/demo`);
  if (!res.ok()) throw new Error('Demo restaurant missing: run npm run seed first');
  return res.json();
}

// Log in once per test run: the login endpoint is rate limited (20 attempts / 15 min per IP).
let cachedLogin = null;
async function ownerLogin(request) {
  if (cachedLogin) return cachedLogin;
  const res = await request.post(`${API}/api/users/login`, { data: { identifier: 'demo@qrmenu.test', password: 'Demo@1234' } });
  if (!res.ok()) throw new Error(`Demo login failed (${res.status()}): ${await res.text()}`);
  cachedLogin = await res.json();
  return cachedLogin;
}

async function setOrderStatus(request, token, orderId, status) {
  const res = await request.put(`${API}/api/orders/${orderId}`, { data: { status }, headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok()) throw new Error(`status update failed: ${res.status()}`);
}

module.exports = { API, demo, ownerLogin, setOrderStatus };
