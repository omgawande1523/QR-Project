// Every screen at phone, tablet and desktop widths: no sideways scrolling, tap targets of at least 44 px,
// nothing hidden under the bottom navigation, no console errors or React warnings, and no axe-core
// WCAG 2.1 AA violations. Includes a dish with a very long English and Hindi name.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { API, demo, ownerLogin } = require('./helpers');

const WIDTHS = [375, 768, 1440];
const LONG_NAME = 'Grandmother’s Slow-Cooked Kolhapuri Mutton Rassa With Pandhra and Tambda Rassa, Bhakri and Onion';
const LONG_HINDI = 'दादी माँ का धीमी आँच पर पका कोल्हापुरी मटन रस्सा, पांढरा और तांबडा रस्सा, भाकरी और प्याज़ के साथ';

let ctx;

test.beforeAll(async ({ request }) => {
  const { restaurantId } = await demo(request);
  const owner = await ownerLogin(request);
  const headers = { Authorization: `Bearer ${owner.token}` };
  const created = await request.post(`${API}/api/menu`, {
    headers,
    data: { name: LONG_NAME, price: 450, category: 'Mains', description: 'A very long description. '.repeat(12).trim(), translations: { hi: { name: LONG_HINDI } } }
  });
  expect(created.ok()).toBeTruthy();
  const longDish = await created.json();
  const menu = await (await request.get(`${API}/api/menu/${restaurantId}`)).json();
  const biryani = menu.find((i) => i.name === 'Chicken Biryani');
  const dosa = menu.find((i) => i.name === 'Masala Dosa');
  const order = await (await request.post(`${API}/api/orders`, {
    data: { restaurantId, tableNumber: 2, customerName: 'Audit Guest', items: [{ menuItem: dosa._id, quantity: 2 }, { menuItem: longDish._id, quantity: 1 }] }
  })).json();
  ctx = { restaurantId, owner, headers, longDish, biryani, dosa, order };
});

test.afterAll(async ({ request }) => {
  if (ctx?.longDish) await request.delete(`${API}/api/menu/${ctx.longDish._id}`, { headers: ctx.headers });
});

// Collected in the page: overflow, small tap targets, content under the bottom nav.
async function layoutProblems(page) {
  return page.evaluate(() => {
    const problems = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth + 1) {
      const wide = [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1 && getComputedStyle(el).position !== 'fixed')
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
      problems.push(`horizontal scroll: ${doc.scrollWidth}px > ${doc.clientWidth}px (${wide.join(', ')})`);
    }

    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[aria-hidden="true"], [inert]');
    };
    const describe = (el) => {
      const name = el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30) || el.getAttribute('placeholder') || el.name || el.type;
      return `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''} "${name}"`;
    };
    const targets = document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=switch], [role=tab], [role=radio], [role=checkbox]');
    const small = new Set();
    for (const el of targets) {
      if (!visible(el)) continue;
      // WCAG 2.5.8 exceptions: links inside a sentence, and controls whose label is the real target.
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.closest('p, li, td, small, span')) continue;
      const label = el.closest('label');
      const r = (label && el.tagName === 'INPUT' ? label : el).getBoundingClientRect();
      if (Math.round(r.width) < 44 || Math.round(r.height) < 44) small.add(`${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    small.forEach((s) => problems.push(`small tap target: ${s}`));

    const nav = document.querySelector('.bottom-nav');
    if (nav && visible(nav)) {
      window.scrollTo(0, doc.scrollHeight);
      const navTop = nav.getBoundingClientRect().top;
      const main = document.querySelector('main');
      const lowest = [...(main?.querySelectorAll('*') || [])].filter(visible).reduce((max, el) => Math.max(max, el.getBoundingClientRect().bottom), 0);
      if (lowest > navTop + 1) problems.push(`content hidden under the bottom nav: content ends at ${Math.round(lowest)}px, nav starts at ${Math.round(navTop)}px`);
      window.scrollTo(0, 0);
    }
    return problems;
  });
}

const SCREENS = [
  { name: 'landing', path: () => '/' },
  { name: 'not found', path: () => '/no-such-page' },
  { name: 'login', path: () => '/login' },
  { name: 'register', path: () => '/register' },
  { name: 'forgot password', path: () => '/forgot-password' },
  { name: 'reset password', path: () => '/reset-password?email=a%40b.c&token=ABCD1234' },
  { name: 'customer welcome', path: () => `/menu/${ctx.restaurantId}?table=1`, ready: 'View Menu', customer: true },
  { name: 'customer menu', path: () => `/menu/${ctx.restaurantId}/browse`, ready: 'Breakfast', customer: true },
  { name: 'customer menu (Hindi)', path: () => `/menu/${ctx.restaurantId}/browse`, ready: 'Breakfast', customer: true, hindi: true },
  { name: 'customer item', path: () => `/menu/${ctx.restaurantId}/item/${ctx.biryani._id}`, ready: 'Add to cart', customer: true },
  { name: 'customer long item', path: () => `/menu/${ctx.restaurantId}/item/${ctx.longDish._id}`, ready: 'Add to cart', customer: true, hindi: true },
  { name: 'customer cart', path: () => `/menu/${ctx.restaurantId}/cart`, ready: 'Your cart', customer: true, cart: true },
  { name: 'customer orders', path: () => `/menu/${ctx.restaurantId}/orders`, ready: 'Your orders', customer: true },
  { name: 'customer order tracking', path: () => `/menu/${ctx.restaurantId}/orders/${ctx.order._id}`, ready: 'Received', customer: true },
  { name: 'dashboard home', path: () => '/dashboard', owner: true },
  { name: 'dashboard orders', path: () => '/dashboard/orders', ready: 'Audit Guest', owner: true },
  { name: 'dashboard menu', path: () => '/dashboard/menu', ready: 'Masala Dosa', owner: true },
  { name: 'dashboard tables', path: () => '/dashboard/tables', owner: true },
  { name: 'dashboard analytics', path: () => '/dashboard/analytics', ready: 'Top dishes', owner: true },
  { name: 'dashboard feedback', path: () => '/dashboard/feedback', owner: true },
  { name: 'dashboard staff', path: () => '/dashboard/staff', owner: true },
  { name: 'dashboard settings', path: () => '/dashboard/settings', owner: true },
  { name: 'kitchen display', path: () => '/kitchen', ready: 'Audit Guest', owner: true }
];

for (const screen of SCREENS) {
  test(`quality: ${screen.name}`, async ({ browser }) => {
    const problems = [];
    for (const width of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height: width < 768 ? 812 : 900 } });
      const page = await context.newPage();
      const messages = [];
      page.on('console', (msg) => {
        if (['error', 'warning'].includes(msg.type())) messages.push(`${msg.type()}: ${msg.text().split('\n')[0].slice(0, 200)}`);
      });
      page.on('pageerror', (err) => messages.push(`page error: ${err.message}`));
      await page.addInitScript(({ owner, restaurantId, order, dosa, screen: s }) => {
        localStorage.setItem('qr.alerts', JSON.stringify({ sound: false, voice: false, browser: false }));
        if (s.owner) {
          localStorage.setItem('token', owner.token);
          localStorage.setItem('userId', owner.userId);
        }
        localStorage.setItem('qr.language', JSON.stringify(s.hindi ? 'hi' : 'en'));
        localStorage.setItem(`qr.orders.${restaurantId}`, JSON.stringify([{ id: order._id, token: order.trackingToken }]));
        if (s.cart) {
          localStorage.setItem(`qr.cart.${restaurantId}`, JSON.stringify([{ itemId: dosa._id, addOnIds: [], notes: 'Less spicy please, and no onions at all', quantity: 2, key: `${dosa._id}||` }]));
        }
      }, { ...ctx, screen });
      await page.goto(screen.path());
      if (screen.ready) await expect(page.getByText(screen.ready).first()).toBeVisible();
      else await expect(page.locator('h1').first()).toBeVisible();
      await page.waitForLoadState('networkidle');

      for (const p of await layoutProblems(page)) problems.push(`${width}px ${p}`);
      if (width !== 768) {
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        for (const v of axe.violations) problems.push(`${width}px axe ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      }
      for (const m of messages) problems.push(`${width}px console ${m}`);
      await context.close();
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
