// iPhone and iPad concerns, run on every app project (Android sizes too, where they also hold):
// screens, dialogs, sheets and the menu drawer keep clear of a notch and the home indicator; every dialog and
// sheet has a visible close button (iPhones have no back button); the account can be deleted from inside the
// app (an App Store rule); the privacy policy is one tap away in Settings.
const { test, expect } = require('@playwright/test');
const { API } = require('../helpers');
const { platformOf, signedIn } = require('./session');

// Stands in for an iPhone's Dynamic Island and home indicator: the app reads the insets from these variables
// (client/src/app/app.css), which on a phone come from env(safe-area-inset-*).
const NOTCH = 59;
const HOME_INDICATOR = 34;
const withNotch = (page) => page.addStyleTag({ content: `:root { --safe-top: ${NOTCH}px !important; --safe-bottom: ${HOME_INDICATOR}px !important; }` });
// Measured once the dialog has finished sliding or popping in.
const box = async (locator) => {
  await locator.evaluate((el) => Promise.all(el.closest('[role=dialog]')?.getAnimations({ subtree: true }).map((a) => a.finished) || []));
  return locator.boundingBox();
};

test('screens, dialogs, sheets and the menu drawer keep clear of the notch and the home indicator', async ({ page }, testInfo) => {
  await signedIn(page, 'owner', testInfo);
  await page.goto('/dashboard/orders');
  await expect(page.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible();
  await withNotch(page);
  const { height } = page.viewportSize();

  expect((await box(page.locator('.topbar'))).y).toBeGreaterThanOrEqual(NOTCH);

  // Bottom sheet: its content ends above the home indicator, and it has a visible Close button.
  await page.getByRole('button', { name: /^Table requests/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Table requests' });
  await expect(sheet).toBeVisible();
  await sheet.evaluate((el) => { el.scrollTop = el.scrollHeight; }); // scrolled to its end, if it scrolls
  const lastChild = await box(sheet.locator(':scope > *').last());
  expect(lastChild.y + lastChild.height).toBeLessThanOrEqual(height - HOME_INDICATOR);
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();

  // A tall dialog (the dish editor) stays between the notch and the home indicator, and closes with its button.
  await page.goto('/dashboard/menu');
  await withNotch(page);
  await page.getByRole('button', { name: 'Add dish' }).click();
  const editor = page.getByRole('dialog', { name: 'Add a dish' });
  await expect(editor).toBeVisible();
  const modal = await box(editor);
  expect(modal.y).toBeGreaterThanOrEqual(NOTCH);
  expect(modal.y + modal.height).toBeLessThanOrEqual(height - HOME_INDICATOR);
  await editor.getByRole('button', { name: 'Close' }).click();
  await expect(editor).toBeHidden();

  // Phones: the menu drawer's first link sits below the notch.
  const openMenu = page.getByRole('button', { name: 'Open menu' });
  if (await openMenu.isVisible()) {
    await openMenu.click();
    expect((await box(page.locator('.sidebar-nav a').first())).y).toBeGreaterThanOrEqual(NOTCH);
  }
});

test('the kitchen display keeps its controls below the notch', async ({ page }, testInfo) => {
  await signedIn(page, 'kitchen', testInfo);
  await page.goto('/kitchen');
  await expect(page.locator('.kitchen-board')).toBeVisible();
  await withNotch(page);
  expect((await box(page.locator('.kitchen-bar'))).y).toBeGreaterThanOrEqual(NOTCH);
  expect((await box(page.getByRole('button', { name: 'Log out' }))).y).toBeGreaterThanOrEqual(NOTCH);
});

test('Settings has the privacy policy and the app version', async ({ page }, testInfo) => {
  await signedIn(page, 'waiter', testInfo);
  await page.goto('/dashboard/settings');
  const about = page.locator('section', { has: page.getByRole('heading', { name: 'Privacy and about' }) });
  await expect(about.getByRole('button', { name: /Privacy policy/ })).toBeVisible();
  await expect(about.getByText(/QR Menu Staff \d+\.\d+\.\d+/)).toBeVisible();
});

// Phones only: deleting goes through the rate-limited account endpoints (register, delete, login).
test('an owner deletes the restaurant from inside the app, after typing DELETE', async ({ page, request }, testInfo) => {
  test.skip(!['app-phone', 'ios-iphone'].includes(testInfo.project.name), 'runs at phone sizes');
  const email = `delete.${testInfo.project.name}.${Date.now()}@test.local`;
  const password = 'Delete@12345';
  const res = await request.post(`${API}/api/users/register`, {
    data: { email, password, restaurantName: 'Delete Me Café' },
    headers: { 'X-Client': 'app', 'X-Platform': platformOf(testInfo) }
  });
  expect(res.ok()).toBeTruthy();
  const session = await res.json();
  await page.addInitScript((s) => {
    localStorage.setItem('token', s.token);
    localStorage.setItem('userId', s.userId);
    localStorage.setItem('role', s.role);
  }, session);

  await page.goto('/dashboard/settings');
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Delete account' }) });
  const button = section.getByRole('button', { name: 'Delete restaurant account' });
  await section.getByLabel('Your password').fill(password);
  await expect(button).toBeDisabled(); // not without DELETE
  await section.getByLabel('Type DELETE to confirm').fill('delete');
  await button.click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('Your restaurant account has been deleted')).toBeVisible();

  const login = await request.post(`${API}/api/users/login`, { data: { identifier: email, password } });
  expect(login.ok()).toBeFalsy();
  expect((await request.get(`${API}/api/users/me`, { headers: { Authorization: `Bearer ${session.token}` } })).status()).toBe(401);
});
