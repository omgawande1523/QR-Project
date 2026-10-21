const { test, expect } = require('@playwright/test');
const { API, demo, ownerLogin, setOrderStatus } = require('./helpers');

// Staff screens on a desktop-sized window, logged in as the demo owner.
async function staffScreen(browser, owner, path) {
  const screen = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await screen.addInitScript(([token, userId]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('qr.alerts', JSON.stringify({ sound: false, voice: false, browser: false }));
  }, [owner.token, owner.userId]);
  await screen.goto(path);
  return screen;
}

test('scan -> menu -> item with size and add-on -> cart -> order -> dashboard and kitchen -> live status', async ({ page, browser, request }) => {
  // Unique per run: orders from earlier runs stay on today's board until the next seed.
  const guest = `E2E Customer ${Date.now()}`;
  const { restaurantId } = await demo(request);
  const owner = await ownerLogin(request);
  const desk = await staffScreen(browser, owner, '/dashboard/orders');
  await expect(desk.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible();
  const kitchen = await staffScreen(browser, owner, '/kitchen');
  await expect(kitchen.getByText('Live', { exact: true })).toBeVisible();

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
  await page.getByLabel('Name', { exact: true }).fill(guest);

  const orderResponse = page.waitForResponse((r) => r.url() === `${API}/api/orders` && r.request().method() === 'POST');
  await page.getByRole('button', { name: /Place order/ }).click();
  const order = await (await orderResponse).json();
  expect(order.totalAmount).toBe(498.75);
  await expect(page.getByText('Order placed!')).toBeVisible();
  await expect(page.locator('.tracking-status')).toHaveText('Received');

  // The order appears at once on the open dashboard board and the kitchen display.
  const board = desk.getByRole('article').filter({ hasText: guest });
  await expect(board).toBeVisible();
  await expect(board).toContainText('2×');
  const ticket = kitchen.getByRole('article').filter({ hasText: guest });
  await expect(ticket).toBeVisible();
  await expect(ticket).toContainText('extra onions');

  // Staff move it along in their own screens; the guest's page follows live.
  await board.getByRole('button', { name: 'Accept' }).click();
  await expect(page.locator('.tracking-status')).toHaveText('Preparing');
  await expect(ticket).toContainText('COOKING');
  await ticket.getByRole('button', { name: /Bump/ }).click();
  await expect(page.locator('.tracking-status')).toHaveText('Ready');
  await expect(desk.getByRole('region', { name: /^Ready/ }).getByRole('article').filter({ hasText: guest })).toBeVisible();
  await setOrderStatus(request, owner.token, order._id, 'served');
  await expect(page.locator('.tracking-status')).toHaveText('Served');

  // Reorder puts the same items back in the cart
  await page.getByRole('button', { name: 'Reorder' }).click();
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
  await expect(page.getByText('₹498.75').first()).toBeVisible();
  await desk.close();
  await kitchen.close();
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

  // Fake prices on sizes and add-ons, and a forged status, payment and totals, are all ignored.
  const biryani = menu.find((i) => i.name === 'Chicken Biryani');
  const full = biryani.variants.find((v) => v.name === 'Full');
  const raita = biryani.addOns.find((a) => a.name === 'Extra raita');
  const forged = await request.post(`${API}/api/orders`, {
    data: {
      restaurantId, tableNumber: 1, status: 'complete', subtotal: 1, taxAmount: 0, payment: { method: 'cash', paidAt: new Date() },
      items: [{ menuItem: biryani._id, quantity: 2, variantId: full._id, addOnIds: [raita._id], price: 1, lineTotal: 1, variant: { name: 'Full', price: 1 } }]
    }
  });
  expect(forged.status()).toBe(201);
  const order = await forged.json();
  expect(order).toMatchObject({ status: 'pending', subtotal: 630, taxAmount: 31.5, totalAmount: 661.5 }); // (290 + 25) x 2 + 5%
  expect(order.payment?.paidAt).toBeUndefined();
  expect(order.items[0]).toMatchObject({ price: 315, lineTotal: 630 });

  // Impossible quantities and options from another dish are refused.
  for (const quantity of [999, 0, -1, 1.5]) {
    const bad = await request.post(`${API}/api/orders`, { data: { restaurantId, tableNumber: 1, items: [{ menuItem: dosa._id, quantity }] } });
    expect(bad.status(), `quantity ${quantity}`).toBe(400);
  }
  const otherAddOn = await request.post(`${API}/api/orders`, {
    data: { restaurantId, tableNumber: 1, items: [{ menuItem: dosa._id, quantity: 1, addOnIds: [raita._id] }] }
  });
  expect(otherAddOn.status()).toBe(400);
  expect((await otherAddOn.json()).code).toBe('UNKNOWN_ADD_ON');
});
