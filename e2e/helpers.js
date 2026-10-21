const API = 'http://localhost:5000';

async function demo(request) {
  const res = await request.get(`${API}/api/public/demo`);
  if (!res.ok()) throw new Error('Demo restaurant missing: run npm run seed first');
  return res.json();
}

async function ownerLogin(request) {
  const res = await request.post(`${API}/api/users/login`, { data: { identifier: 'demo@qrmenu.test', password: 'Demo@1234' } });
  return res.json();
}

async function setOrderStatus(request, token, orderId, status) {
  const res = await request.put(`${API}/api/orders/${orderId}`, { data: { status }, headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok()) throw new Error(`status update failed: ${res.status()}`);
}

module.exports = { API, demo, ownerLogin, setOrderStatus };
