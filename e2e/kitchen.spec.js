const { test, expect } = require('@playwright/test');
const { API, demo, ownerLogin } = require('./helpers');

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

test('kitchen display: a new ticket appears live, Start then Bump, and Recall undoes', async ({ page, browser, request }) => {
  const { restaurantId } = await demo(request);
  const owner = await ownerLogin(request);
  await page.addInitScript(([token, userId]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('qr.alerts', JSON.stringify({ sound: false, voice: false, browser: false }));
  }, [owner.token, owner.userId]);

  await page.goto('/kitchen');
  await expect(page.getByText('Live', { exact: true })).toBeVisible();

  const menu = await (await request.get(`${API}/api/menu/${restaurantId}`)).json();
  const curry = menu.find((i) => i.name === 'Home-style Chicken Curry');
  const naan = menu.find((i) => i.name === 'Garlic Naan');
  const customer = `KDS ${Date.now()}`;
  const order = await (await request.post(`${API}/api/orders`, {
    data: {
      restaurantId,
      tableNumber: 5,
      customerName: customer,
      items: [{ menuItem: curry._id, quantity: 2, variantId: curry.variants[1]._id, notes: 'no chilli' }, { menuItem: naan._id, quantity: 4 }]
    }
  })).json();

  const ticket = page.getByRole('article').filter({ hasText: customer });
  await expect(ticket).toBeVisible();
  await expect(ticket).toContainText('NEW');
  await expect(ticket).toContainText('Full');
  await expect(ticket).toContainText('no chilli');

  await ticket.getByRole('button', { name: 'Start cooking' }).click();
  await expect(ticket).toContainText('COOKING');

  await ticket.getByRole('button', { name: /Bump/ }).click();
  await expect(ticket).toHaveCount(0);
  const status = async () => (await (await request.get(`${API}/api/orders/status/${order._id}?token=${order.trackingToken}`)).json()).status;
  expect(await status()).toBe('ready');

  await page.getByRole('button', { name: 'Recall table 5' }).click();
  await expect(ticket).toContainText('COOKING');
  expect(await status()).toBe('process');

  // A customer following the order sees the kitchen's progress.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.addInitScript(([rid, id, token]) => {
    localStorage.setItem(`qr.orders.${rid}`, JSON.stringify([{ id, token }]));
  }, [restaurantId, order._id, order.trackingToken]);
  await phone.goto(`/menu/${restaurantId}/orders/${order._id}`);
  await expect(phone.locator('.tracking-status')).toHaveText('Preparing');
  await ticket.getByRole('button', { name: /Bump/ }).click();
  await expect(phone.locator('.tracking-status')).toHaveText('Ready');
  await phone.close();
});

test('the kitchen display needs a login and returns there after it', async ({ page }) => {
  await page.goto('/kitchen');
  await expect(page).toHaveURL(/\/login\?next=%2Fkitchen$/);
});
