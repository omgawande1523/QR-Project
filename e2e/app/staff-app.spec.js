// The staff app build (vite --mode app) at phone and tablet sizes: each role sees exactly its own screens
// (the same rules as the website, also enforced by the server), guest screens are not in the app, and an
// order placed on the website's customer menu arrives in the app and its status reaches the guest.
const { test, expect } = require('@playwright/test');
const { API, demo } = require('../helpers');

const WEB = 'http://localhost:3000';
const PASSWORD = 'Demo@1234';
const ACCOUNTS = {
  owner: 'demo@qrmenu.test',
  manager: 'manager@qrmenu.test',
  waiter: 'waiter@qrmenu.test',
  kitchen: 'kitchen@qrmenu.test'
};
const NAV = {
  owner: ['Home', 'Orders', 'Menu', 'Tables & QR', 'Analytics', 'Feedback', 'Staff', 'Settings'],
  manager: ['Home', 'Orders', 'Menu', 'Tables & QR', 'Analytics', 'Feedback', 'Settings'],
  waiter: ['Orders', 'Settings']
};

// One API login per role per test run (the login endpoint is rate limited); the app sends X-Client: app.
const logins = {};
async function login(request, role) {
  if (!logins[role]) {
    const res = await request.post(`${API}/api/users/login`, { data: { identifier: ACCOUNTS[role], password: PASSWORD }, headers: { 'X-Client': 'app' } });
    expect(res.ok(), `login ${role}`).toBeTruthy();
    logins[role] = await res.json();
  }
  return logins[role];
}

// The app build in a browser keeps the session where the phone would use secure storage: localStorage.
async function signedIn(page, request, role) {
  const session = await login(request, role);
  await page.addInitScript((s) => {
    localStorage.setItem('token', s.token);
    localStorage.setItem('userId', s.userId);
    localStorage.setItem('role', s.role);
    localStorage.setItem('qr.alerts', JSON.stringify({ sound: false, voice: false, browser: false }));
  }, session);
  return session;
}

const watchConsole = (page) => {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
};

test('opens on Login, and signing in lands on the role\'s start screen', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle(/QR Menu Staff|Welcome back/);
  // No demo link: the demo is a guest menu, which is not in the app.
  await expect(page.getByRole('link', { name: /live demo/i })).toHaveCount(0);

  await page.getByLabel('Email or phone').fill(ACCOUNTS.kitchen);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/kitchen$/);
  await expect(page.getByText('Kitchen', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const role of ['owner', 'manager', 'waiter']) {
  test(`${role}: sees exactly the website's screens for the role`, async ({ page, request }) => {
    const session = await signedIn(page, request, role);
    await page.goto('/');
    await expect(page).toHaveURL(role === 'waiter' ? /\/dashboard\/orders$/ : /\/dashboard$/);
    await expect(page.locator('.sidebar-nav a')).toHaveText(NAV[role]);

    // Screens outside the role send it back to its start screen, and the server refuses the data.
    const forbidden = { owner: [], manager: ['/dashboard/staff'], waiter: ['/dashboard/analytics', '/dashboard/staff', '/dashboard/menu', '/dashboard'] }[role];
    for (const path of forbidden) {
      await page.goto(path);
      await expect(page).toHaveURL(role === 'waiter' ? /\/dashboard\/orders$/ : /\/dashboard$/);
    }
    const auth = { Authorization: `Bearer ${session.token}` };
    expect((await request.get(`${API}/api/analytics`, { headers: auth })).status()).toBe(role === 'waiter' ? 403 : 200);
    expect((await request.get(`${API}/api/staff`, { headers: auth })).status()).toBe(role === 'owner' ? 200 : 403);
  });
}

test('kitchen: only the kitchen display', async ({ page, request }) => {
  await signedIn(page, request, 'kitchen');
  for (const path of ['/', '/dashboard', '/dashboard/orders', '/dashboard/settings', '/dashboard/menu']) {
    await page.goto(path);
    await expect(page).toHaveURL(path === '/dashboard/settings' ? /\/dashboard\/settings$/ : /\/kitchen$/);
  }
});

test('guest screens are not part of the app', async ({ page, request }) => {
  const { restaurantId } = await demo(request);
  await page.goto(`/menu/${restaurantId}?table=1`);
  await expect(page).toHaveURL(/\/login$/);
  await signedIn(page, request, 'owner');
  for (const path of [`/menu/${restaurantId}/browse`, '/demo', '/privacy']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard$/);
  }
  await expect(page.getByText('View Menu')).toHaveCount(0);
});

test('an order from the website menu arrives in the app; its status reaches the guest', async ({ page, browser, request }) => {
  const { restaurantId } = await demo(request);
  const errors = watchConsole(page);
  await signedIn(page, request, 'owner');
  await page.goto('/dashboard/orders');
  await expect(page.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible();

  // The guest, on the website
  const guestName = `App Guest ${Date.now()}`;
  const guest = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await guest.goto(`${WEB}/menu/${restaurantId}?table=2`); // as if the table's QR code was scanned
  await guest.getByRole('button', { name: /View Menu/ }).click();
  await guest.getByRole('button', { name: 'Add Idli Sambar', exact: true }).click();
  await guest.getByRole('link', { name: /^Cart/ }).first().click();
  await guest.getByLabel('Name', { exact: true }).fill(guestName);
  await guest.getByRole('button', { name: /Place order/ }).click();
  await expect(guest.locator('.tracking-status')).toHaveText('Received');

  // ...appears live in the app, which moves it along
  const card = page.getByRole('article').filter({ hasText: guestName });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(guest.locator('.tracking-status')).toHaveText('Preparing');
  await card.getByRole('button', { name: 'Mark ready' }).click();
  await expect(guest.locator('.tracking-status')).toHaveText('Ready');
  await guest.close();
  expect(errors).toEqual([]);
});

test('Settings lists this device as a staff app session', async ({ page, request }) => {
  await signedIn(page, request, 'manager');
  await page.goto('/dashboard/settings');
  const devices = page.getByRole('region', { name: 'Signed-in devices' }).or(page.locator('section', { has: page.getByRole('heading', { name: 'Signed-in devices' }) }));
  await expect(devices.getByText('This device')).toBeVisible();
  await expect(devices.getByText(/Staff app · active/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Delete account' })).toBeVisible();
});

test('kitchen display fills the screen without sideways scrolling', async ({ page, request }) => {
  await signedIn(page, request, 'kitchen');
  await page.goto('/kitchen');
  await expect(page.locator('.kitchen-board')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
