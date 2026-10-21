const { test, expect } = require('@playwright/test');
const { demo, ownerLogin } = require('./helpers');

test('landing page has a title, description and Open Graph tags with a 1200x630 image', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('QR Menu: QR code menu and table ordering for restaurants');
  const meta = (selector) => page.locator(selector).getAttribute('content');
  expect(await meta('meta[name="description"]')).toMatch(/QR code menu and table ordering/);
  expect(await meta('meta[property="og:title"]')).toMatch(/^QR Menu/);
  expect(await meta('meta[property="og:type"]')).toBe('website');
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
  const image = await meta('meta[property="og:image"]');
  expect(image).toMatch(/\/og-image\.jpg$/);

  const res = await request.get(image);
  expect(res.headers()['content-type']).toBe('image/jpeg');
  const body = await res.body();
  // JPEG SOF0/SOF2 frame header holds the size: height then width
  const sof = body.findIndex((b, i) => b === 0xff && (body[i + 1] === 0xc0 || body[i + 1] === 0xc2));
  expect([body.readUInt16BE(sof + 7), body.readUInt16BE(sof + 5)]).toEqual([1200, 630]);
});

test('robots.txt keeps staff screens out of search results', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /dashboard');
  expect(robots).toContain('Disallow: /kitchen');
});

test('each screen names itself in the browser tab', async ({ page, request }) => {
  const { restaurantId } = await demo(request);
  await page.goto(`/menu/${restaurantId}/browse`);
  await expect(page).toHaveTitle('Olive Leaf Café · QR Menu');

  const owner = await ownerLogin(request);
  await page.addInitScript(([token, userId]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('qr.alerts', JSON.stringify({ sound: false, voice: false, browser: false }));
  }, [owner.token, owner.userId]);
  await page.goto('/dashboard/orders');
  await expect(page).toHaveTitle('Orders · QR Menu');
  await page.goto('/dashboard/analytics');
  await expect(page).toHaveTitle('Analytics · QR Menu');
  await page.goto('/no-such-page');
  await expect(page).toHaveTitle('Page not found · QR Menu');
});
