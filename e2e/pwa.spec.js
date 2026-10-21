const { test, expect } = require('@playwright/test');
const { demo } = require('./helpers');

// Chrome's own installability check, through the DevTools protocol.
async function installability(page) {
  const cdp = await page.context().newCDPSession(page);
  const { url } = await cdp.send('Page.getAppManifest');
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  return { manifest: url, errors: installabilityErrors.map((e) => e.errorId) };
}

const swReady = (page) => page.evaluate(async () => (await navigator.serviceWorker.ready).active.scriptURL);

test('the dashboard and the customer menu are installable apps', async ({ page, request }) => {
  await page.goto('/login');
  expect(await swReady(page)).toMatch(/\/sw\.js$/);
  await expect.poll(async () => (await installability(page)).errors).toEqual([]);
  expect((await installability(page)).manifest).toMatch(/\/manifest\.webmanifest$/);
  const dashboard = await (await request.get('/manifest.webmanifest')).json();
  expect(dashboard).toMatchObject({ start_url: '/dashboard', display: 'standalone' });
  expect(dashboard.icons.map((i) => i.sizes)).toEqual(['192x192', '512x512', '512x512']);

  const { restaurantId } = await demo(request);
  await page.goto(`/menu/${restaurantId}/browse`);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/menu.webmanifest');
  await expect.poll(async () => (await installability(page)).manifest).toMatch(/\/menu\.webmanifest$/);
  expect((await installability(page)).errors).toEqual([]);

  // The installed menu opens on /menu/, which goes back to the last restaurant.
  await page.goto('/menu/');
  await expect(page).toHaveURL(new RegExp(`/menu/${restaurantId}/browse$`));
});

test('offline navigation shows the offline page instead of a browser error', async ({ page, context, request }) => {
  const { restaurantId } = await demo(request);
  await page.goto(`/menu/${restaurantId}`);
  await swReady(page);
  await page.reload(); // make sure the worker controls the page
  await context.setOffline(true);
  await page.goto(`/menu/${restaurantId}/browse`).catch(() => {});
  await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  // Back online: the page reloads itself.
  await context.setOffline(false);
  await expect(page.getByLabel('Search dishes')).toBeVisible();
});

test('real icons are served', async ({ request }) => {
  for (const [path, type] of [['/favicon.svg', 'image/svg+xml'], ['/logo192.png', 'image/png'], ['/logo512.png', 'image/png'], ['/maskable-512.png', 'image/png'], ['/apple-touch-icon.png', 'image/png']]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()['content-type']).toContain(type);
  }
});
