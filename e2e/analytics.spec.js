const { test, expect } = require('@playwright/test');
const { ownerLogin } = require('./helpers');

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test('analytics: KPIs, sales chart with keyboard tooltip, table view and date range', async ({ page, request }) => {
  const owner = await ownerLogin(request);
  await page.addInitScript(([token, userId]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('qr.alerts', JSON.stringify({ sound: false, voice: false, browser: false }));
  }, [owner.token, owner.userId]);

  await page.goto('/dashboard');
  await page.getByRole('complementary', { name: 'Dashboard navigation' }).getByRole('link', { name: 'Analytics' }).click();
  await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: '30 days' }).click();
  const sales = page.locator('.kpi').filter({ hasText: 'Sales' });
  await expect(sales).toContainText('₹');
  await expect(sales).toContainText(/vs previous 30 days/);

  // Arrow keys walk the columns and show a tooltip with sales and orders.
  const chart = page.getByRole('img', { name: /Sales per day/ });
  await chart.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.chart-tooltip')).toContainText(/₹[\d,]+/);
  await expect(page.locator('.chart-tooltip')).toContainText(/\d+ orders?/);

  // The same numbers are available as a table.
  const card = page.getByRole('region', { name: 'Sales by day' });
  await card.getByRole('button', { name: 'Table' }).click();
  await expect(card.getByRole('row')).toHaveCount(31); // header + 30 days
  await card.getByRole('button', { name: 'Chart' }).click();

  // Longer ranges group by week automatically.
  await page.getByRole('button', { name: '90 days' }).click();
  await expect(page.getByRole('heading', { name: 'Sales by week' })).toBeVisible();

  const dishes = page.getByRole('region', { name: 'Top dishes' });
  await expect(dishes.locator('.bar-list li')).toHaveCount(8);

  // A custom day with no sales shows the empty state.
  await page.getByLabel('From', { exact: true }).fill('2026-01-01');
  await page.getByLabel('To', { exact: true }).fill('2026-01-02');
  await expect(page.getByText('No sales in this period')).toBeVisible();
});
