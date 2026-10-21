const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test('landing: "Try live demo" opens the seeded demo café at table 1', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your menu on every table');
  await page.getByRole('link', { name: 'Try live demo' }).first().click();
  await expect(page).toHaveURL(/\/menu\/[a-f0-9]{24}\?table=1$/);
  await expect(page.getByRole('heading', { name: 'Olive Leaf Café' })).toBeVisible();
  await expect(page.getByText('Table 1')).toBeVisible();
});

test('landing: the contact form sends an enquiry', async ({ page }) => {
  await page.goto('/#contact');
  const form = page.locator('#contact form');
  await form.getByLabel('Your name').fill('Playwright');
  await form.getByLabel('Email').fill('pw@example.com');
  await form.getByLabel('How can we help?').fill('Please share pricing for two outlets.');
  await form.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Message sent')).toBeVisible();
});

test('unknown pages show a friendly 404', async ({ page }) => {
  await page.goto('/this-does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
