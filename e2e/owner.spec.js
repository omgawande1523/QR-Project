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
  await expect(page.getByText('Live', { exact: true })).toBeVisible();

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

test('availability toggle in the menu manager reaches open customer menus instantly', async ({ page, browser, request }) => {
  const { restaurantId } = await demo(request);
  const owner = await ownerLogin(request);
  await page.addInitScript(([token, userId]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
  }, [owner.token, owner.userId]);

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`/menu/${restaurantId}/browse`);
  const poha = phone.getByRole('article').filter({ hasText: 'Kanda Poha' });
  await expect(poha.getByRole('button', { name: 'Add Kanda Poha', exact: true })).toBeEnabled();

  await page.goto('/dashboard/menu');
  const toggle = page.getByRole('switch', { name: 'Kanda Poha available' });
  await toggle.uncheck();
  await expect(poha.getByRole('button', { name: 'Kanda Poha is sold out' })).toBeDisabled();

  await toggle.check();
  await expect(poha.getByRole('button', { name: 'Add Kanda Poha', exact: true })).toBeEnabled();
  await phone.close();
});
