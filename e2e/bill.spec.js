const { test, expect } = require('@playwright/test');
const { API, demo, ownerLogin, setOrderStatus } = require('./helpers');

// The guest's running bill on the welcome screen and the menu: open -> billed (UPI) -> paid, live.
test('the guest sees this visit\'s bill: running total, Ask for bill, then UPI when billed, then Paid', async ({ page, request }) => {
  const { restaurantId } = await demo(request);
  const owner = await ownerLogin(request);
  const staff = { Authorization: `Bearer ${owner.token}` };
  const placed = [];
  page.on('response', async (r) => {
    if (r.url() === `${API}/api/orders` && r.request().method() === 'POST' && r.ok()) placed.push(await r.json());
  });

  // No orders yet: no bill on the welcome screen
  await page.goto(`/menu/${restaurantId}?table=3`);
  await expect(page.getByRole('button', { name: /View Menu/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your bill' })).toHaveCount(0);

  // Two orders: Idli Sambar + Masala Chai, then another Masala Chai
  await page.getByRole('button', { name: /View Menu/ }).click();
  await page.getByRole('button', { name: 'Add Idli Sambar', exact: true }).click();
  await page.getByRole('button', { name: 'Add Masala Chai', exact: true }).click();
  await page.getByRole('link', { name: /Cart/ }).first().click();
  await page.getByRole('button', { name: /Place order/ }).click();
  await expect(page.getByText('Order placed!')).toBeVisible();
  await page.goto(`/menu/${restaurantId}/browse`);
  await page.getByRole('button', { name: 'Add Masala Chai', exact: true }).click();
  await page.getByRole('link', { name: /Cart/ }).first().click();
  await page.getByRole('button', { name: /Place order/ }).click();
  await expect(page.getByText('Order placed!')).toBeVisible();
  expect(placed).toHaveLength(2);

  // Menu: compact bar with the running total, opening the bill page
  await page.goto(`/menu/${restaurantId}/browse`);
  const bar = page.getByRole('link', { name: /Your bill/ });
  await expect(bar).toContainText('₹168'); // (80 + 40 + 40) + 5% GST
  await bar.click();
  await expect(page).toHaveURL(new RegExp(`/menu/${restaurantId}/bill$`));
  const card = page.locator('.visit-bill');
  await expect(card).toContainText('2 × Masala Chai');
  await expect(card).toContainText('1 × Idli Sambar');
  await expect(card).toContainText('GST (5%)');
  await expect(card).toContainText('Unpaid');

  // Welcome screen: the full card; Ask for bill reaches the restaurant
  await page.goto(`/menu/${restaurantId}?table=3`);
  await expect(page.getByRole('heading', { name: 'Your bill' })).toBeVisible();
  await page.getByRole('button', { name: 'Ask for bill' }).click();
  await expect(page.getByRole('button', { name: 'Bill requested' })).toBeDisabled();
  const requests = await (await request.get(`${API}/api/service-requests`, { headers: staff })).json();
  expect(requests.some((r) => r.type === 'Bill' && r.tableNumber === 3)).toBe(true);

  // Staff make the bills: the card switches live to "Ready to pay" with a UPI QR and pay link for the amount
  for (const order of placed) {
    await setOrderStatus(request, owner.token, order._id, 'served');
    expect((await request.post(`${API}/api/orders/${order._id}/invoice`, { headers: staff })).ok()).toBe(true);
  }
  await expect(card).toContainText('Ready to pay');
  await expect(card.getByRole('img', { name: /UPI QR code to pay ₹168/ })).toBeVisible();
  const pay = card.getByRole('link', { name: /Pay ₹168 with UPI/ });
  await expect(pay).toHaveAttribute('href', /^upi:\/\/pay\?pa=.+&am=168\.00&cu=INR/);
  await expect(card).toContainText(/Invoice \d{4}-\d{2}\/\d{6}, \d{4}-\d{2}\/\d{6}/);

  // Paid: the card says so and the QR goes away
  for (const order of placed) await request.post(`${API}/api/orders/${order._id}/pay`, { headers: staff, data: { method: 'upi' } });
  await expect(card).toContainText('Paid. Thank you, visit again!');
  await expect(card.getByRole('img', { name: /UPI QR code/ })).toHaveCount(0);
});
