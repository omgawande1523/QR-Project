const { test, expect } = require('@playwright/test');
const { API, demo, ownerLogin, setOrderStatus } = require('./helpers');

test('scan -> menu -> item with size and add-on -> cart -> order -> live status', async ({ page, request }) => {
  const { restaurantId } = await demo(request);
  const owner = await ownerLogin(request);

  // Welcome screen opened by the table QR code
  await page.goto(`/menu/${restaurantId}?table=3`);
  await expect(page.getByRole('heading', { name: 'Olive Leaf Café' })).toBeVisible();
  await expect(page.getByText('Table 3')).toBeVisible();
  await page.getByRole('button', { name: /View Menu/ }).click();

  // Simple item straight from the grid
  await expect(page.getByRole('heading', { name: 'Breakfast' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Idli Sambar', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Idli Sambar quantity' })).toBeVisible();
  await page.getByRole('group', { name: 'Idli Sambar quantity' }).getByRole('button', { name: 'Increase' }).click();

  // Item with sizes and add-ons via the detail screen
  await page.getByRole('button', { name: 'Chicken Biryani', exact: true }).click();
  await page.getByRole('radio', { name: /Full/ }).check();
  await page.getByRole('checkbox', { name: /Extra raita/ }).check();
  await page.getByLabel('Add notes').fill('extra onions');
  await expect(page.getByRole('button', { name: /Add to cart · ₹315/ })).toBeVisible();
  await page.getByRole('button', { name: /Add to cart/ }).click();

  // Cart: 2 × ₹80 + ₹315 = ₹475, + 5% GST = ₹498.75
  await page.getByRole('link', { name: /Cart/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
  await expect(page.getByText('₹498.75').first()).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill('E2E Customer');

  const orderResponse = page.waitForResponse((r) => r.url() === `${API}/api/orders` && r.request().method() === 'POST');
  await page.getByRole('button', { name: /Place order/ }).click();
  const order = await (await orderResponse).json();
  expect(order.totalAmount).toBe(498.75);
  await expect(page.getByText('Order placed!')).toBeVisible();
  await expect(page.locator('.tracking-status')).toHaveText('Received');

  // Owner changes the status; the customer screen updates live
  await setOrderStatus(request, owner.token, order._id, 'process');
  await expect(page.locator('.tracking-status')).toHaveText('Preparing');
  await setOrderStatus(request, owner.token, order._id, 'ready');
  await expect(page.locator('.tracking-status')).toHaveText('Ready');

  // Reorder puts the same items back in the cart
  await page.getByRole('button', { name: 'Reorder' }).click();
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
  await expect(page.getByText('₹498.75').first()).toBeVisible();
});

test('price tampering through the API is rejected or re-priced', async ({ request }) => {
  const { restaurantId } = await demo(request);
  const menu = await (await request.get(`${API}/api/menu/${restaurantId}`)).json();
  const dosa = menu.find((i) => i.name === 'Masala Dosa');

  const res = await request.post(`${API}/api/orders`, {
    data: { restaurantId, tableNumber: 1, totalAmount: 0, items: [{ menuItem: dosa._id, quantity: 1, price: 0 }] }
  });
  expect(res.status()).toBe(201);
  expect((await res.json()).totalAmount).toBe(126); // ₹120 + 5% GST, not ₹0

  const tooMany = await request.post(`${API}/api/orders`, {
    data: { restaurantId, tableNumber: 1, items: [{ menuItem: dosa._id, quantity: 999 }] }
  });
  expect(tooMany.status()).toBe(400);
});
