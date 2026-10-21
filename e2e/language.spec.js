const { test, expect } = require('@playwright/test');
const { API, demo, ownerLogin } = require('./helpers');

test('guests switch dish names to Hindi or Marathi; search still finds English names', async ({ page, request }) => {
  const { restaurantId } = await demo(request);
  await page.goto(`/menu/${restaurantId}/browse`);
  const languages = page.getByRole('group', { name: 'Menu language' });
  await expect(languages.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Masala Dosa', exact: true })).toBeVisible();

  await languages.getByRole('button', { name: 'हिंदी' }).click();
  const dosa = page.getByRole('button', { name: 'मसाला डोसा', exact: true });
  await expect(dosa).toBeVisible();
  await expect(dosa).toHaveAttribute('lang', 'hi');
  await expect(page.getByText('मसालेदार आलू से भरा', { exact: false })).toBeVisible();

  // English search terms still match while reading Hindi.
  await page.getByLabel('Search dishes').fill('paneer tikka');
  await expect(page.getByRole('button', { name: 'पनीर टिक्का', exact: true })).toBeVisible();
  await page.getByLabel('Search dishes').fill('');

  // The choice is remembered and the dish page follows it.
  await page.reload();
  await expect(page.getByRole('group', { name: 'Menu language' }).getByRole('button', { name: 'हिंदी' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'मसाला डोसा', exact: true }).click();
  await expect(page.locator('.detail-name')).toHaveText('मसाला डोसा');
  await page.goBack();

  await page.getByRole('group', { name: 'Menu language' }).getByRole('button', { name: 'मराठी' }).click();
  await expect(page.getByRole('button', { name: 'मसाला चहा', exact: true })).toBeVisible();
  await page.getByRole('group', { name: 'Menu language' }).getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('button', { name: 'Masala Chai', exact: true })).toBeVisible();
});

test('the owner adds a Marathi name in the dish editor', async ({ page, request }) => {
  const { restaurantId } = await demo(request);
  const owner = await ownerLogin(request);
  await page.addInitScript(([token, userId]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('qr.alerts', JSON.stringify({ sound: false, voice: false, browser: false }));
  }, [owner.token, owner.userId]);
  const name = `Lang Test ${Date.now()}`;
  await page.goto('/dashboard/menu');
  await page.getByRole('button', { name: 'Add dish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a dish' });
  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog.getByLabel('Price (₹)').fill('70');
  await dialog.getByText('Hindi and Marathi').click();
  await dialog.getByRole('button', { name: /^Marathi/ }).click();
  await dialog.getByLabel('Name in Marathi').fill('साबुदाणा खिचडी');
  await expect(dialog.getByLabel('Name in Marathi')).toHaveAttribute('lang', 'mr');
  await dialog.getByRole('button', { name: 'Add dish' }).click();
  await expect(dialog).toHaveCount(0);

  const menu = await (await request.get(`${API}/api/menu/${restaurantId}`)).json();
  const created = menu.find((i) => i.name === name);
  expect(created.translations.mr).toEqual({ name: 'साबुदाणा खिचडी' });
  expect(created.translations.hi?.name).toBeUndefined();
});
