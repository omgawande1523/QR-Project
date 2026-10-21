const { test, expect } = require('@playwright/test');
const { API, demo, ownerLogin } = require('./helpers');

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test('new order appears live on the board and moves with one tap', async ({ page, request }) => {
  const { restaurantId } = await demo(request);
  const owner = await ownerLogin(request);
  const customer = `Board Test ${Date.now()}`;
  await page.addInitScript(([token, userId]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('qr.alerts', JSON.stringify({ sound: false, voice: false, browser: false }));
  }, [owner.token, owner.userId]);

  await page.goto('/dashboard/orders');
  await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
  await expect(page.getByText('Live')).toBeVisible();

  // A customer orders while the board is open
  const menu = await (await request.get(`${API}/api/menu/${restaurantId}`)).json();
  const chai = menu.find((i) => i.name === 'Masala Chai');
  const created = await request.post(`${API}/api/orders`, {
    data: { restaurantId, tableNumber: 4, customerName: customer, items: [{ menuItem: chai._id, quantity: 3 }] }
  });
  const order = await created.json();

  const newColumn = page.getByRole('region', { name: /^New/ });
  const card = newColumn.getByRole('article', { name: /Table 4/ }).filter({ hasText: customer });
  await expect(card).toBeVisible();

  await card.getByRole('button', { name: 'Accept' }).click();
  const preparing = page.getByRole('region', { name: /^Preparing/ });
  await expect(preparing.getByText(customer)).toBeVisible();

  const status = await (await request.get(`${API}/api/orders/status/${order._id}?token=${order.trackingToken}`)).json();
  expect(status.status).toBe('process');

  // A waiter call reaches the bell in the top bar
  await request.post(`${API}/api/service-requests`, { data: { restaurantId, tableNumber: 4, type: 'Water' } });
  await page.getByRole('button', { name: /Table requests \(\d+\)/ }).click();
  await expect(page.getByRole('dialog', { name: 'Table requests' }).getByText('T4').first()).toBeVisible();
});
