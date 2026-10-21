const { test, expect } = require('@playwright/test');
const { API, ownerLogin } = require('./helpers');

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

async function logIn(page, email, password = 'Demo@1234') {
  await page.goto('/login');
  await page.getByLabel('Email or phone').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

const navLinks = (page) => page.getByRole('complementary', { name: 'Dashboard navigation' }).getByRole('link');

test('the owner adds a waiter, who logs in and only sees orders and settings', async ({ page, browser, request }) => {
  const owner = await ownerLogin(request);
  await page.addInitScript(([token, userId]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('role', 'owner');
  }, [owner.token, owner.userId]);

  await page.goto('/dashboard/staff');
  await page.getByRole('button', { name: 'Add staff' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a staff member' });
  const email = `waiter${Date.now()}@staff.test`;
  await dialog.getByLabel('Name').fill('Playwright Waiter');
  await dialog.getByLabel('Email').fill(email);
  await dialog.getByLabel('Role').selectOption('waiter');
  const password = await dialog.getByLabel('Temporary password').inputValue();
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('.staff-row').filter({ hasText: email })).toBeVisible();

  const waiterContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const waiter = await waiterContext.newPage();
  await logIn(waiter, email, password);
  await expect(waiter).toHaveURL(/\/dashboard\/orders$/);
  await expect(navLinks(waiter)).toHaveText([/QR Menu/, /Orders/, /Settings/, /Kitchen display/, /Customer menu/]);
  await expect(waiter.getByText('Waiter', { exact: true })).toBeVisible();

  await waiter.goto('/dashboard/menu');
  await expect(waiter).toHaveURL(/\/dashboard\/orders$/);

  // Deactivating the waiter signs them out on their next request.
  await page.locator('.staff-row').filter({ hasText: email }).getByRole('switch').uncheck();
  await waiter.goto('/dashboard/orders');
  await expect(waiter).toHaveURL(/\/login/);
  await waiterContext.close();

  const list = await (await request.get(`${API}/api/staff`, { headers: { Authorization: `Bearer ${owner.token}` } })).json();
  const created = list.find((s) => s.email === email);
  await request.delete(`${API}/api/staff/${created._id}`, { headers: { Authorization: `Bearer ${owner.token}` } });
});

test('a kitchen login lands on the kitchen display and cannot open the dashboard', async ({ page }) => {
  await logIn(page, 'kitchen@qrmenu.test');
  await expect(page).toHaveURL(/\/kitchen$/);
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/kitchen$/);
});

test('a manager sees the menu and settings but not staff', async ({ page }) => {
  await logIn(page, 'manager@qrmenu.test');
  await expect(page).toHaveURL(/\/dashboard$/);
  const nav = page.getByRole('complementary', { name: 'Dashboard navigation' });
  await expect(nav.getByRole('link', { name: 'Menu', exact: true })).toHaveCount(1);
  await expect(nav.getByRole('link', { name: 'Staff', exact: true })).toHaveCount(0);
  await page.goto('/dashboard/staff');
  await expect(page).toHaveURL(/\/dashboard$/);
});
