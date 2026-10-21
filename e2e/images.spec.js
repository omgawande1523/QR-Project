const path = require('path');
const { test, expect } = require('@playwright/test');
const { PNG } = require('pngjs');
const { API, demo, ownerLogin } = require('./helpers');

// sharp is a server dependency; reuse it to inspect the images the server produced.
const sharp = require(path.join(__dirname, '..', 'server', 'node_modules', 'sharp'));

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

// 1600 x 600 PNG in three vertical bands: red | green | blue. A centred 4:3 crop is mostly green.
function bandsPng() {
  const png = new PNG({ width: 1600, height: 600 });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const i = (png.width * y + x) << 2;
      const band = x < 533 ? [220, 30, 30] : x < 1067 ? [30, 200, 60] : [30, 30, 220];
      [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]] = [...band, 255];
    }
  }
  return PNG.sync.write(png);
}

async function imageInfo(request, url) {
  const res = await request.get(url);
  expect(res.ok()).toBe(true);
  const buffer = await res.body();
  const meta = await sharp(buffer).metadata();
  const { channels } = await sharp(buffer).stats();
  return { width: meta.width, height: meta.height, mean: channels.slice(0, 3).map((c) => Math.round(c.mean)) };
}

async function asOwner(page, request) {
  const owner = await ownerLogin(request);
  await page.addInitScript(([token, userId]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('qr.alerts', JSON.stringify({ sound: false, voice: false, browser: false }));
  }, [owner.token, owner.userId]);
  return owner;
}

async function customerCardImage(browser, restaurantId, dishName) {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`/menu/${restaurantId}/browse`);
  const img = phone.getByRole('article').filter({ hasText: dishName }).locator('img').first();
  await expect(img).toBeVisible();
  // The card loads a resized copy (?w=) from srcset; it must actually decode (lazily, once on screen).
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  const src = await img.getAttribute('src');
  await phone.close();
  return src.replace(/\?w=\d+$/, '');
}

async function removeDish(request, token, restaurantId, name) {
  const menu = await (await request.get(`${API}/api/menu/${restaurantId}`)).json();
  for (const item of menu.filter((i) => i.name === name)) {
    await request.delete(`${API}/api/menu/${item._id}`, { headers: { Authorization: `Bearer ${token}` } });
  }
}

async function addDish(page, name, price) {
  await page.goto('/dashboard/menu');
  await page.getByRole('button', { name: 'Add dish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a dish' });
  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog.getByLabel('Price (₹)').fill(String(price));
  return dialog;
}

test('upload -> crop -> save: the customer menu shows the cropped image', async ({ page, browser, request }) => {
  const { restaurantId } = await demo(request);
  const owner = await asOwner(page, request);
  const name = `Crop Test ${Date.now()}`;
  const dialog = await addDish(page, name, 111);

  await dialog.locator('.image-picker input[type="file"]').setInputFiles({ name: 'bands.png', mimeType: 'image/png', buffer: bandsPng() });
  const crop = page.getByRole('dialog', { name: 'Crop dish photo' });
  await expect(crop.locator('.crop-area img')).toBeVisible();
  await expect(crop.locator('.crop-preview-card')).toContainText(name);

  const cropResponse = page.waitForResponse((r) => r.url().endsWith('/api/uploads/crop'));
  await crop.getByRole('button', { name: 'Use this crop' }).click();
  const { url } = await (await cropResponse).json();
  await expect(dialog.locator('.picker-zone img')).toHaveAttribute('src', url);

  await dialog.getByRole('button', { name: 'Add dish' }).click();
  await expect(page.getByText('Dish added')).toBeVisible();

  const info = await imageInfo(request, url);
  expect([info.width, info.height]).toEqual([1200, 900]);
  const [r, g, b] = info.mean;
  expect(g).toBeGreaterThan(r + 60); // the centred crop is mostly the green band
  expect(g).toBeGreaterThan(b + 60);

  expect(await customerCardImage(browser, restaurantId, name)).toBe(url);
  await removeDish(request, owner.token, restaurantId, name);
});

test('paste an image URL -> crop -> save (server downloads it; needs internet)', async ({ page, browser, request }) => {
  const { restaurantId } = await demo(request);
  const owner = await asOwner(page, request);
  const name = `Link Test ${Date.now()}`;
  const dialog = await addDish(page, name, 99);

  const link = 'https://raw.githubusercontent.com/omgawande1523/QR-Project/main/server/scripts/seed-assets/poha.webp';
  await dialog.getByLabel('Photo: image URL').fill(link);
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  const crop = page.getByRole('dialog', { name: 'Crop dish photo' });
  await expect(crop.locator('.crop-area img')).toBeVisible({ timeout: 20000 });
  await expect(crop.locator('.crop-area img')).toHaveAttribute('src', /\/uploads\/originals\//); // our copy, not a hotlink

  await crop.getByLabel('Rotation in degrees').fill('90');
  const cropResponse = page.waitForResponse((r) => r.url().endsWith('/api/uploads/crop'));
  await crop.getByRole('button', { name: 'Use this crop' }).click();
  const { url } = await (await cropResponse).json();
  await dialog.getByRole('button', { name: 'Add dish' }).click();
  await expect(page.getByText('Dish added')).toBeVisible();

  expect(url).toMatch(/\/uploads\/menu\/[0-9a-f-]{36}\.webp$/);
  expect(await customerCardImage(browser, restaurantId, name)).toBe(url);
  await removeDish(request, owner.token, restaurantId, name);
});

test('a link that is not an image gets a clear message', async ({ page, request }) => {
  await asOwner(page, request);
  const dialog = await addDish(page, 'Not saved', 1);
  await dialog.getByLabel('Photo: image URL').fill('https://github.com/omgawande1523/QR-Project');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText("This link isn't an image")).toBeVisible({ timeout: 20000 });
});

test('pasting an image from the clipboard opens the crop screen', async ({ page, request }) => {
  await asOwner(page, request);
  const dialog = await addDish(page, 'Clipboard Test', 50);
  const bytes = [...bandsPng()];
  // Same event Chrome fires for Ctrl+V after "Copy image" on Google.
  await page.evaluate((data) => {
    const file = new File([new Uint8Array(data)], 'image.png', { type: 'image/png' });
    const clipboardData = new DataTransfer();
    clipboardData.items.add(file);
    document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  }, bytes);
  await expect(page.getByRole('dialog', { name: 'Crop dish photo' }).locator('.crop-area img')).toBeVisible();
  await expect(dialog).toBeVisible();
});

test('Edit crop on an existing dish keeps the original and updates the customer menu', async ({ page, browser, request }) => {
  const { restaurantId } = await demo(request);
  await asOwner(page, request);
  const before = await customerCardImage(browser, restaurantId, 'Garlic Naan');

  await page.goto('/dashboard/menu');
  await page.getByRole('button', { name: 'Edit Garlic Naan' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Garlic Naan' });
  await dialog.getByRole('button', { name: 'Edit crop' }).click();
  const crop = page.getByRole('dialog', { name: 'Crop dish photo' });
  await expect(crop.locator('.crop-area img')).toHaveAttribute('src', /\/uploads\/originals\//);

  await crop.getByLabel('Zoom').fill('2');
  const cropResponse = page.waitForResponse((r) => r.url().endsWith('/api/uploads/crop'));
  await crop.getByRole('button', { name: 'Use this crop' }).click();
  const { url } = await (await cropResponse).json();
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Dish updated')).toBeVisible();

  expect(url).not.toBe(before);
  expect(await customerCardImage(browser, restaurantId, 'Garlic Naan')).toBe(url);
  const info = await imageInfo(request, url);
  expect([info.width, info.height]).toEqual([1200, 900]);

  // The new crop can itself be re-cropped from the same original.
  await page.getByRole('button', { name: 'Edit Garlic Naan' }).click();
  await page.getByRole('dialog', { name: 'Edit Garlic Naan' }).getByRole('button', { name: 'Edit crop' }).click();
  await expect(page.getByRole('dialog', { name: 'Crop dish photo' }).locator('.crop-area img')).toHaveAttribute('src', /\/uploads\/originals\//);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

  test('pinch with two fingers zooms the crop', async ({ page, request }) => {
    await asOwner(page, request);
    await page.goto('/dashboard/menu');
    await page.getByRole('button', { name: 'Edit Masala Dosa' }).click();
    await page.getByRole('dialog', { name: 'Edit Masala Dosa' }).getByRole('button', { name: 'Edit crop' }).click();
    const crop = page.getByRole('dialog', { name: 'Crop dish photo' });
    const area = crop.locator('.crop-area');
    await expect(area.locator('img')).toBeVisible();
    const box = await area.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Two fingers moving apart (real touch events via the DevTools protocol).
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, spread) => cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x: cx - spread, y: cy, id: 1 }, { x: cx + spread, y: cy, id: 2 }]
    });
    await touch('touchStart', 20);
    for (let spread = 30; spread <= 120; spread += 10) await touch('touchMove', spread);
    await touch('touchEnd', 0);

    const zoom = Number(await crop.getByLabel('Zoom').inputValue());
    expect(zoom).toBeGreaterThan(1.5);
  });
});
