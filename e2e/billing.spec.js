const { test, expect } = require('@playwright/test');
const { API, demo, ownerLogin, setOrderStatus } = require('./helpers');

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

test('bill a served order: GST invoice, PDF, UPI QR, then mark paid', async ({ page, request }) => {
  const { restaurantId } = await demo(request);
  const owner = await ownerLogin(request);
  await page.addInitScript(([token, userId]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('qr.alerts', JSON.stringify({ sound: false, voice: false, browser: false }));
  }, [owner.token, owner.userId]);

  const menu = await (await request.get(`${API}/api/menu/${restaurantId}`)).json();
  const dosa = menu.find((i) => i.name === 'Masala Dosa');
  const customer = `Bill ${Date.now()}`;
  const order = await (await request.post(`${API}/api/orders`, {
    data: { restaurantId, tableNumber: 4, customerName: customer, items: [{ menuItem: dosa._id, quantity: 2 }] }
  })).json();
  await setOrderStatus(request, owner.token, order._id, 'served');

  await page.goto('/dashboard/orders');
  const card = page.getByRole('article').filter({ hasText: customer });
  await card.getByRole('button', { name: 'Bill', exact: true }).click();

  const bill = page.getByRole('dialog');
  await expect(bill).toHaveAccessibleName('Tax Invoice · T4');
  await expect(bill).toContainText(/Invoice no\.\s*\d{4}-\d{2}\/\d{6}/);
  await expect(bill).toContainText('GSTIN 27AAACO1234F1Z5');
  await expect(bill).toContainText('27 - Maharashtra');
  await expect(bill).toContainText('CGST 2.5%');
  await expect(bill).toContainText('SGST 2.5%');
  await expect(bill.getByRole('img', { name: /UPI QR code/ })).toBeVisible();

  const download = page.waitForEvent('download');
  await bill.getByRole('button', { name: 'PDF' }).click();
  expect((await download).suggestedFilename()).toMatch(/^invoice-\d{4}-\d{2}-\d{6}\.pdf$/);

  await bill.getByRole('button', { name: 'UPI', exact: true }).click();
  await bill.getByLabel('UPI reference (optional)').fill('UTR 998877');
  await bill.getByRole('button', { name: /^Mark paid/ }).click();
  await expect(bill).toContainText('Paid by UPI');
  await expect(bill).toContainText('PAID · UPI · UTR 998877');
  await expect(bill.getByRole('img', { name: /UPI QR code/ })).toHaveCount(0);
  await bill.getByRole('button', { name: 'Close' }).last().click();
  await expect(card).toHaveCount(0);

  const status = await (await request.get(`${API}/api/orders/status/${order._id}?token=${order.trackingToken}`)).json();
  expect(status).toMatchObject({ status: 'complete', payment: { method: 'upi', reference: 'UTR 998877' } });

  // History shows the invoice number and how it was paid
  await page.getByRole('button', { name: 'History' }).click();
  const row = page.getByRole('row').filter({ hasText: status.invoiceNumber });
  await expect(row).toContainText('Paid');
  await expect(row).toContainText('UPI');
});
