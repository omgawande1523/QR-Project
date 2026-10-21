const { test, expect } = require('@playwright/test');
const { API, demo, ownerLogin, setOrderStatus } = require('./helpers');

test('a guest rates a served meal and the owner sees it on the Feedback page', async ({ page, browser, request }) => {
  const { restaurantId } = await demo(request);
  const owner = await ownerLogin(request);
  const menu = await (await request.get(`${API}/api/menu/${restaurantId}`)).json();
  const poha = menu.find((i) => i.name === 'Kanda Poha');
  const customer = `Rated ${Date.now()}`;
  const order = await (await request.post(`${API}/api/orders`, {
    data: { restaurantId, tableNumber: 2, customerName: customer, items: [{ menuItem: poha._id, quantity: 1 }] }
  })).json();

  await page.addInitScript(([rid, id, token]) => {
    localStorage.setItem(`qr.orders.${rid}`, JSON.stringify([{ id, token }]));
  }, [restaurantId, order._id, order.trackingToken]);
  await page.goto(`/menu/${restaurantId}/orders/${order._id}`);
  await expect(page.locator('.tracking-status')).toHaveText('Received');
  await expect(page.getByText('How was your meal?')).toHaveCount(0);

  // The card appears live once the waiter marks the order served.
  await setOrderStatus(request, owner.token, order._id, 'served');
  await expect(page.getByText('How was your meal?')).toBeVisible();

  const stars = page.getByRole('radiogroup', { name: 'Rate your meal' });
  await stars.getByRole('radio', { name: /^5 stars/ }).click();
  await page.keyboard.press('ArrowLeft'); // keyboard works like native radios
  await expect(stars.getByRole('radio', { name: /^4 stars/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Good', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tasty food' }).click();
  const comment = `Fluffy poha ${Date.now()}`;
  await page.getByLabel('Anything else? (optional)').fill(comment);
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByText('Thanks for your feedback!')).toBeVisible();
  await expect(page.getByRole('img', { name: '4 out of 5 stars' })).toBeVisible();

  const status = await (await request.get(`${API}/api/orders/status/${order._id}?token=${order.trackingToken}`)).json();
  expect(status.feedback).toMatchObject({ rating: 4, tags: ['tasty'], comment });

  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desk.addInitScript(([token, userId]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('qr.alerts', JSON.stringify({ sound: false, voice: false, browser: false }));
  }, [owner.token, owner.userId]);
  await desk.goto('/dashboard/feedback');
  await expect(desk.getByRole('heading', { name: 'Feedback', level: 1 })).toBeVisible();
  const entry = desk.locator('.feedback-list li').filter({ hasText: comment });
  await expect(entry).toContainText(customer);
  await expect(entry).toContainText('Tasty food');
  await desk.getByRole('button', { name: '1–3 stars' }).click();
  await expect(entry).toHaveCount(0);
  await desk.close();
});
