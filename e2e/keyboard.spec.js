// Keyboard and screen-reader behaviour: a whole order placed with the keyboard only (with a visible focus
// ring at every stop), dialogs that keep Tab inside and give focus back, and spoken cart and status updates.
const { test, expect } = require('@playwright/test');
const { API, demo, ownerLogin, setOrderStatus } = require('./helpers');

// Presses Tab until `target` has focus, checking that every focused element shows a focus ring.
async function tabTo(page, target, { max = 60, shift = false } = {}) {
  await target.waitFor();
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press(shift ? 'Shift+Tab' : 'Tab');
    const ring = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return 'ok'; // between the page and the browser's own controls
      // Switches and radios draw it on the styled sibling of the hidden input, the search box on its bar.
      const shown = el.closest('.search-bar') || (el.matches('input[type=checkbox], input[type=radio]') ? el.nextElementSibling || el : el);
      const s = getComputedStyle(shown);
      return s.boxShadow !== 'none' || (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) ? 'ok' : `${el.tagName} ${el.className}`;
    });
    expect(ring, 'focused element has a visible focus ring').toBe('ok');
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
  }
  throw new Error(`Tab never reached ${target}`);
}

test('a guest orders with the keyboard only', async ({ page, request }) => {
  const { restaurantId } = await demo(request);
  await page.goto(`/menu/${restaurantId}?table=4`);

  await tabTo(page, page.getByRole('button', { name: /View Menu/ }));
  await page.keyboard.press('Enter');

  // Adding from the grid keeps focus (on the new stepper) and is announced.
  await tabTo(page, page.getByRole('button', { name: 'Add Idli Sambar', exact: true }));
  await page.keyboard.press('Enter');
  const stepper = page.getByRole('group', { name: 'Idli Sambar quantity' });
  await expect(stepper.getByRole('button', { name: 'Increase' })).toBeFocused();
  await expect(page.getByRole('status').filter({ hasText: 'Cart: 1 item' })).toBeAttached();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Cart: 2 items' })).toBeAttached();

  // A dish with sizes: choose one with the arrow keys.
  await tabTo(page, page.getByRole('button', { name: 'Chicken Biryani', exact: true }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('radio', { name: /Half/ }));
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: /Full/ })).toBeChecked();
  await tabTo(page, page.getByRole('button', { name: /Add to cart/ }));
  await page.keyboard.press('Enter');

  // The header's cart link comes before the dishes (the bottom bar's says "Cart, 3 items").
  await expect(page.getByRole('link', { name: 'Cart, 3 items' })).toBeVisible();
  await tabTo(page, page.getByRole('link', { name: 'Cart, 3', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
  await tabTo(page, page.getByLabel('Name', { exact: true }));
  await page.keyboard.type('Keyboard Guest');
  await tabTo(page, page.getByRole('button', { name: /Place order/ }));
  const placed = page.waitForResponse((r) => r.url() === `${API}/api/orders` && r.request().method() === 'POST');
  await page.keyboard.press('Enter');
  const order = await (await placed).json();

  // Status changes are read out from a live region.
  const status = (text) => page.getByRole('status').filter({ has: page.locator('.tracking-status', { hasText: text }) });
  await expect(status('Received')).toBeVisible();
  const owner = await ownerLogin(request);
  await setOrderStatus(request, owner.token, order._id, 'process');
  await expect(status('Preparing')).toBeVisible();
  await setOrderStatus(request, owner.token, order._id, 'cancelled');
});

test('a bottom sheet keeps Tab inside, closes with Escape and gives focus back', async ({ page, request }) => {
  const { restaurantId } = await demo(request);
  await page.goto(`/menu/${restaurantId}/browse`);
  const waiter = page.getByRole('button', { name: 'Waiter' });
  await expect(page.getByRole('heading', { name: 'Breakfast' })).toBeVisible();
  await waiter.focus();
  await page.keyboard.press('Enter');

  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  for (const key of [...Array(12).fill('Tab'), ...Array(12).fill('Shift+Tab')]) {
    await page.keyboard.press(key);
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(waiter).toBeFocused();
});

test('a modal keeps Tab inside and gives focus back', async ({ page, request }) => {
  const owner = await ownerLogin(request);
  await page.addInitScript(([token, userId]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('qr.alerts', JSON.stringify({ sound: false, voice: false, browser: false }));
  }, [owner.token, owner.userId]);
  await page.goto('/dashboard/menu');
  const add = page.getByRole('button', { name: 'Add dish' });
  await add.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Add a dish' });
  await expect(dialog.getByLabel('Name', { exact: true })).toBeFocused();
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(add).toBeFocused();
});
