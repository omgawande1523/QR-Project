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
  await page.getByRole('button', { name: /^Table requests, \d+$/ }).click();
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
  await expect(poha.getByRole('button', { name: 'Sold out Kanda Poha' })).toBeDisabled();

  await toggle.check();
  await expect(poha.getByRole('button', { name: 'Add Kanda Poha', exact: true })).toBeEnabled();
  await phone.close();
});

test('table QR downloads: PNG decodes to the table URL and the A4 PDF has a page per four tables', async ({ page, request }) => {
  const fs = require('fs');
  const { PNG } = require('pngjs');
  const jsQR = require('jsqr');
  const { restaurantId } = await demo(request);
  const owner = await ownerLogin(request);
  await page.addInitScript(([token, userId]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
  }, [owner.token, owner.userId]);

  await page.goto('/dashboard/tables');
  const card = page.locator('.table-card').filter({ hasText: 'Table 2' });
  await expect(card.locator('img.qr-img')).toBeVisible();

  const [png] = await Promise.all([page.waitForEvent('download'), card.getByRole('button', { name: 'PNG' }).click()]);
  expect(png.suggestedFilename()).toBe('table-2-qr.png');
  const image = PNG.sync.read(fs.readFileSync(await png.path()));
  const code = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
  expect(code?.data).toBe(`http://localhost:3000/menu/${restaurantId}?table=2`);

  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download all/ }).click()]);
  const bytes = fs.readFileSync(await pdf.path()).toString('latin1');
  expect(bytes.startsWith('%PDF')).toBe(true);
  expect((bytes.match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(2); // 5 tables, 4 per A4 page
});

test('settings: changing the GST rate is used for customer pricing', async ({ page, request }) => {
  const { restaurantId } = await demo(request);
  const owner = await ownerLogin(request);
  await page.addInitScript(([token, userId]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
  }, [owner.token, owner.userId]);

  await page.goto('/dashboard/settings');
  const billing = page.locator('section').filter({ hasText: 'Billing and tax' });
  await billing.getByLabel('GST rate').selectOption('12');
  await expect(billing.getByText('₹1,120')).toBeVisible(); // live example bill
  await billing.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved')).toBeVisible();
  expect((await (await request.get(`${API}/api/users/${restaurantId}/public`)).json()).taxPercent).toBe(12);

  await billing.getByLabel('GST rate').selectOption('5');
  await billing.getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await (await request.get(`${API}/api/users/${restaurantId}/public`)).json()).taxPercent).toBe(5);
});
