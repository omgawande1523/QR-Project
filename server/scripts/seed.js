// Loads the demo restaurant "Olive Leaf Café" with a full menu, 5 tables and sample orders.
//
//   npm run seed            (from the repo root or server/)
//   Login: demo@qrmenu.test / Demo@1234
//
// With --review it loads "App Review Café" instead: the same menu and orders under the account Apple's
// reviewers sign in with (docs/APP_STORE.md). Its password comes from REVIEW_PASSWORD (required in production).
//
//   npm run seed:review     Login: appreview@qrmenu.app / REVIEW_PASSWORD
//
// Safe to re-run, also on a production database: it only replaces that one account's own data (its menu
// items, orders, service requests, staff logins and uploaded images). Nothing else is touched.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const sharp = require('sharp');
const config = require('../src/config');
const User = require('../src/models/User');
const MenuItem = require('../src/models/MenuItem');
const Order = require('../src/models/Order');
const ServiceRequest = require('../src/models/ServiceRequest');
const Counter = require('../src/models/Counter');
const TRANSLATIONS = require('./seed-translations');
const { nextInvoiceNumber, financialYear, counterKey, formatInvoiceNumber } = require('../src/services/invoices');
const { IMAGE_KINDS, saveOriginal, cropOriginal } = require('../src/services/images');
const Upload = require('../src/models/Upload');
const Staff = require('../src/models/Staff');
const { discardImage } = require('../src/services/storage');
const { priceOrder } = require('../src/services/pricing');

const DEMO = {
  email: 'demo@qrmenu.test',
  password: 'Demo@1234',
  restaurantName: 'Olive Leaf Café',
  phoneNumber: '+919800000001',
  tables: [1, 2, 3, 4, 5],
  taxPercent: 5,
  serviceChargePercent: 0,
  tagline: 'Fresh South & North Indian favourites, made to order.',
  address: 'Lane 7, Koregaon Park, Pune 411001',
  gstin: '27AAACO1234F1Z5',
  // Not a real UPI handle, so a scan of the demo bill cannot send money anywhere.
  upiId: 'qrmenu.demo@example',
  categories: ['Breakfast', 'Starters', 'Mains', 'Breads & Rice', 'Beverages', 'Desserts'],
  openingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '08:00', close: day === 5 || day === 6 ? '23:30' : '22:30', closed: false })),
  isDemo: true
};

// Demo staff logins, one per role (same password as the owner).
DEMO.staff = [
  { name: 'Asha (Manager)', email: 'manager@qrmenu.test', role: 'manager' },
  { name: 'Ravi (Waiter)', email: 'waiter@qrmenu.test', role: 'waiter' },
  { name: 'Meena (Kitchen)', email: 'kitchen@qrmenu.test', role: 'kitchen' }
];

// The App Store review account: a normal restaurant (not the read-only demo), so reviewers can try every
// feature, deleting the account included. Re-run the seed to bring it back.
const REVIEW = {
  ...DEMO,
  email: 'appreview@qrmenu.app',
  password: process.env.REVIEW_PASSWORD || 'Review@1234',
  restaurantName: 'App Review Café',
  phoneNumber: '+919800000099',
  isDemo: false,
  staff: [
    { name: 'Ravi (Waiter)', email: 'appreview.waiter@qrmenu.app', role: 'waiter' },
    { name: 'Meena (Kitchen)', email: 'appreview.kitchen@qrmenu.app', role: 'kitchen' }
  ]
};

const PROFILE = process.argv.includes('--review') ? REVIEW : DEMO;

const ASSETS = path.join(__dirname, 'seed-assets');

// image: file in seed-assets/ (without .webp). Prices in rupees.
const MENU = [
  { category: 'Breakfast', name: 'Masala Dosa', image: 'masala-dosa', price: 120, isVeg: true, tags: ['bestseller'], spiceLevel: 1, calories: 390,
    description: 'Crisp rice-lentil crepe filled with spiced potato, served with sambar and coconut chutney.',
    addOns: [{ name: 'Extra chutney', price: 15 }, { name: 'Cheese', price: 30 }] },
  { category: 'Breakfast', name: 'Idli Sambar', image: 'idli-sambar', price: 80, isVeg: true, calories: 310,
    description: 'Three steamed rice cakes with a medu vada, sambar and chutney.' },
  { category: 'Breakfast', name: 'Kanda Poha', image: 'poha', price: 60, isVeg: true, spiceLevel: 1, calories: 270,
    description: 'Flattened rice tempered with onion, peanuts, curry leaves and a squeeze of lime.' },
  { category: 'Breakfast', name: 'Aloo Paratha', image: 'aloo-paratha', price: 90, isVeg: true, spiceLevel: 1, calories: 450,
    description: 'Whole-wheat flatbread stuffed with spiced potato, with pickle and curd.',
    addOns: [{ name: 'White butter', price: 15 }, { name: 'Extra curd', price: 20 }] },

  { category: 'Starters', name: 'Paneer Tikka', image: 'paneer-tikka', price: 240, isVeg: true, tags: ['chefs_special'], spiceLevel: 2, calories: 420,
    description: 'Cottage cheese, peppers and onion marinated in yoghurt and spices, chargrilled in the tandoor.',
    variants: [{ name: 'Half', price: 150 }, { name: 'Full', price: 240 }] },
  { category: 'Starters', name: 'Chicken 65', image: 'chicken-65', price: 260, isVeg: false, tags: ['bestseller'], spiceLevel: 3, calories: 510,
    description: 'Fiery, curry-leaf fried chicken bites in the classic Chennai style.' },
  { category: 'Starters', name: 'Chicken Tikka', image: 'chicken-tikka', price: 280, isVeg: false, spiceLevel: 2, calories: 460,
    description: 'Boneless chicken marinated overnight in hung curd and spices, skewered and roasted.',
    variants: [{ name: 'Half', price: 170 }, { name: 'Full', price: 280 }] },
  { category: 'Starters', name: 'Veg Spring Rolls', image: 'spring-rolls', price: 160, isVeg: true, calories: 320,
    description: 'Crisp rolls stuffed with stir-fried vegetables and glass noodles, with sweet chilli sauce.' },
  { category: 'Starters', name: 'Hara Bhara Kebab', image: 'hara-bhara-kebab', price: 180, isVeg: true, tags: ['new'], spiceLevel: 1, calories: 290,
    description: 'Spinach, pea and potato patties studded with cashew, with mint chutney.' },

  { category: 'Mains', name: 'Home-style Chicken Curry', image: 'chicken-curry', price: 320, isVeg: false, tags: ['chefs_special'], spiceLevel: 2, calories: 620,
    description: 'Slow-cooked bone-in chicken in an onion-tomato gravy with whole spices.',
    variants: [{ name: 'Half', price: 200 }, { name: 'Full', price: 320 }] },
  { category: 'Mains', name: 'Paneer Butter Masala', image: 'paneer-butter-masala', price: 260, isVeg: true, tags: ['bestseller'], spiceLevel: 1, calories: 580,
    description: 'Soft paneer in a rich, mildly sweet tomato and cashew gravy finished with butter.',
    addOns: [{ name: 'Extra paneer', price: 60 }, { name: 'Extra butter', price: 20 }] },
  { category: 'Mains', name: 'Dal Makhani', image: 'dal-makhani', price: 210, isVeg: true, calories: 430,
    description: 'Black lentils and kidney beans simmered overnight with cream and butter.' },
  { category: 'Mains', name: 'Veg Biryani', image: 'veg-biryani', price: 230, isVeg: true, spiceLevel: 2, calories: 540,
    description: 'Fragrant basmati layered with vegetables, saffron and fried onions, with raita.' },
  { category: 'Mains', name: 'Chicken Biryani', image: 'chicken-biryani', price: 290, isVeg: false, tags: ['bestseller'], spiceLevel: 2, calories: 680,
    description: 'Dum-cooked basmati and marinated chicken with saffron, mint and caramelised onion.',
    variants: [{ name: 'Half', price: 190 }, { name: 'Full', price: 290 }],
    addOns: [{ name: 'Boiled egg', price: 20 }, { name: 'Extra raita', price: 25 }] },

  { category: 'Breads & Rice', name: 'Butter Naan', image: 'butter-naan', price: 50, isVeg: true, calories: 260,
    description: 'Soft leavened bread from the tandoor, brushed with butter.' },
  { category: 'Breads & Rice', name: 'Garlic Naan', image: 'garlic-naan', price: 60, isVeg: true, calories: 280,
    description: 'Tandoori naan topped with garlic and coriander.' },
  { category: 'Breads & Rice', name: 'Jeera Rice', image: 'jeera-rice', price: 140, isVeg: true, calories: 330,
    description: 'Basmati rice tempered with cumin and ghee.' },

  { category: 'Beverages', name: 'Masala Chai', image: 'masala-chai', price: 40, isVeg: true, calories: 110,
    description: 'Strong tea brewed with milk, ginger, cardamom and spices.' },
  { category: 'Beverages', name: 'Filter Coffee', image: 'filter-coffee', price: 50, isVeg: true, calories: 120,
    description: 'South Indian decoction coffee with frothy hot milk.' },
  { category: 'Beverages', name: 'Mango Lassi', image: 'mango-lassi', price: 90, isVeg: true, tags: ['new'], calories: 280,
    description: 'Thick yoghurt smoothie blended with Alphonso mango pulp.',
    variants: [{ name: 'Regular', price: 90 }, { name: 'Large', price: 130 }] },

  { category: 'Desserts', name: 'Gulab Jamun', image: 'gulab-jamun', price: 80, isVeg: true, calories: 300,
    description: 'Two warm milk dumplings soaked in rose and cardamom syrup.',
    addOns: [{ name: 'Vanilla ice cream', price: 40 }] },
  { category: 'Desserts', name: 'Rasmalai', image: 'rasmalai', price: 110, isVeg: true, calories: 250, available: false,
    description: 'Soft chenna discs in chilled saffron-pistachio milk.' }
];

// [minutes ago, table, status, customer, lines as [item name, quantity, variant?, add-ons?]]
const SAMPLE_ORDERS = [
  [6, 2, 'pending', 'Ananya', [['Masala Dosa', 2], ['Filter Coffee', 2]]],
  [14, 4, 'process', 'Rahul', [['Chicken Biryani', 1, 'Full', ['Extra raita']], ['Butter Naan', 2], ['Masala Chai', 1]]],
  [25, 1, 'ready', 'Priya', [['Paneer Tikka', 1, 'Half'], ['Mango Lassi', 2, 'Large']]],
  [48, 5, 'billed', 'Kabir', [['Paneer Butter Masala', 1, null, ['Extra butter']], ['Garlic Naan', 3], ['Jeera Rice', 1]]],
  [26 * 60, 3, 'complete', 'Meera', [['Idli Sambar', 2], ['Masala Chai', 2]]],
  [27 * 60, 2, 'complete', 'Arjun', [['Chicken Tikka', 1, 'Full'], ['Dal Makhani', 1], ['Butter Naan', 4]]],
  [50 * 60, 1, 'complete', 'Sana', [['Veg Biryani', 2], ['Gulab Jamun', 2, null, ['Vanilla ice cream']]]],
  [52 * 60, 4, 'cancelled', 'Dev', [['Chicken 65', 1]]]
];

// Eight weeks of past orders so analytics has something to show: breakfast, lunch, tea and dinner
// with dinner the busiest, busier weekends and a slow upward trend. A fixed seed keeps runs identical.
const HISTORY_DAYS = 56;
const MEALS = [
  { hours: [8, 11], weight: 2, pools: [['Masala Dosa', 'Idli Sambar', 'Kanda Poha', 'Aloo Paratha'], ['Masala Chai', 'Filter Coffee']] },
  { hours: [12, 15], weight: 4, pools: [['Paneer Butter Masala', 'Dal Makhani', 'Veg Biryani', 'Chicken Biryani', 'Home-style Chicken Curry'], ['Butter Naan', 'Garlic Naan', 'Jeera Rice'], ['Mango Lassi', 'Masala Chai']] },
  { hours: [16, 18], weight: 1.5, pools: [['Veg Spring Rolls', 'Hara Bhara Kebab', 'Chicken 65', 'Paneer Tikka'], ['Masala Chai', 'Filter Coffee']] },
  { hours: [19, 22], weight: 5, pools: [['Paneer Tikka', 'Chicken Tikka', 'Chicken 65'], ['Paneer Butter Masala', 'Dal Makhani', 'Chicken Biryani', 'Home-style Chicken Curry', 'Veg Biryani'], ['Butter Naan', 'Garlic Naan'], ['Gulab Jamun', 'Rasmalai']] }
];
const GUESTS = ['Aarav', 'Diya', 'Ishaan', 'Kavya', 'Rohan', 'Sneha', 'Vikram', 'Neha', 'Aditya', 'Pooja', 'Siddharth', 'Tanvi'];
const IST_OFFSET_MS = 330 * 60 * 1000;
const FEEDBACK_COMMENTS = {
  5: ['Best dosa in Pune!', 'Lovely food and very friendly staff.', 'The biryani was outstanding.', 'Quick service even on a busy night.'],
  4: ['Really good, will come again.', 'Tasty food, slightly slow at the start.', 'Paneer tikka was great.'],
  3: ['Food was fine, service could be faster.', 'Okay overall, naan was a bit cold.'],
  2: ['Waited almost 40 minutes for mains.', 'Curry was too salty today.'],
  1: ['Wrong order and it took ages to fix.']
};

function mulberry32(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function historyOrders(restaurant, pricingMenu, itemsByName) {
  const random = mulberry32(2026);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const weighted = (list, weightOf) => {
    let r = random() * list.reduce((sum, entry) => sum + weightOf(entry), 0);
    return list.find((entry) => (r -= weightOf(entry)) < 0) || list[list.length - 1];
  };
  const pad = (n) => String(n).padStart(2, '0');
  const today = new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
  const orders = [];
  for (let back = HISTORY_DAYS; back >= 2; back -= 1) {
    const date = new Date(Date.parse(`${today}T00:00:00Z`) - back * 86400000).toISOString().slice(0, 10);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekend = weekday === 0 || weekday === 5 || weekday === 6;
    const trend = 1 + ((HISTORY_DAYS - back) / HISTORY_DAYS) * 0.35;
    const count = Math.max(3, Math.round((weekend ? 14 : 8) * trend + random() * 5 - 2));
    for (let i = 0; i < count; i += 1) {
      const meal = weighted(MEALS, (m) => m.weight);
      const hour = meal.hours[0] + Math.floor(random() * (meal.hours[1] - meal.hours[0] + 1));
      const createdAt = new Date(`${date}T${pad(hour)}:${pad(Math.floor(random() * 60))}:00+05:30`);
      const party = 1 + Math.floor(random() * 4);
      const lines = meal.pools
        .filter((_, index) => index === 0 || random() < 0.7)
        .map((pool) => {
          const item = itemsByName.get(pick(pool));
          return [item.name, Math.max(1, Math.round(party * (0.5 + random() * 0.6))), item.variants.length ? pick(item.variants).name : null];
        });
      const cancelled = random() < 0.03;
      const invoicedAt = new Date(createdAt.getTime() + 45 * 60 * 1000);
      orders.push({
        ...priceOrder(restaurant, pricingMenu, buildLines(lines, itemsByName)),
        tableNumber: pick(restaurant.tables),
        customerName: random() < 0.6 ? pick(GUESTS) : undefined,
        status: cancelled ? 'cancelled' : 'complete',
        ...(cancelled ? {} : {
          invoicedAt,
          payment: { method: weighted([['upi', 55], ['cash', 30], ['card', 15]], (m) => m[1])[0], paidAt: new Date(invoicedAt.getTime() + 5 * 60 * 1000) }
        }),
        restaurantId: restaurant._id,
        trackingToken: crypto.randomBytes(24).toString('hex'),
        createdAt
      });
    }
  }
  // About a third of guests leave a rating, mostly happy ones.
  const rate = mulberry32(77);
  for (const order of orders.filter((o) => o.status === 'complete')) {
    if (rate() > 0.35) continue;
    const roll = rate();
    const rating = roll < 0.45 ? 5 : roll < 0.8 ? 4 : roll < 0.92 ? 3 : roll < 0.97 ? 2 : 1;
    const pool = rating >= 4 ? ['tasty', 'quick', 'friendly', 'value'] : ['slow', 'cold', 'wrong', 'tasty'];
    const tags = pool.filter(() => rate() < 0.4);
    const comments = FEEDBACK_COMMENTS[rating];
    order.feedback = { rating, tags, comment: rate() < 0.4 ? comments[Math.floor(rate() * comments.length)] : undefined, createdAt: new Date(order.createdAt.getTime() + 55 * 60 * 1000) };
  }
  // Invoice numbers in date order, per financial year.
  orders.sort((a, b) => a.createdAt - b.createdAt);
  const counters = new Map();
  for (const order of orders.filter((o) => o.invoicedAt)) {
    const fy = financialYear(order.invoicedAt);
    counters.set(fy, (counters.get(fy) || 0) + 1);
    order.invoiceNumber = formatInvoiceNumber(fy, counters.get(fy));
  }
  return { orders, counters };
}

async function logoBuffer() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <circle cx="256" cy="256" r="256" fill="#5b6b1f"/>
    <path d="M256 104c-86 52-118 140-74 212 22 36 52 52 74 92 22-40 52-56 74-92 44-72 12-160-74-212z" fill="#c6d36a"/>
    <path d="M256 150v250" stroke="#5b6b1f" stroke-width="14" stroke-linecap="round"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Stores an image the way the dashboard does: full-size original plus a centred crop at the field's
// ratio, so "Edit crop" works on demo images too.
async function addImage(buffer, kind, ownerId) {
  const original = await saveOriginal(buffer, ownerId);
  const { width, height } = IMAGE_KINDS[kind];
  const ratio = width / height;
  const cropWidth = Math.min(original.width, original.height * ratio);
  const cropHeight = cropWidth / ratio;
  const crop = { x: (original.width - cropWidth) / 2, y: (original.height - cropHeight) / 2, width: cropWidth, height: cropHeight };
  return cropOriginal({ ownerId, originalId: original._id, kind, crop, rotation: 0 });
}

async function removeExisting() {
  const existing = await User.findOne({ email: PROFILE.email });
  if (!existing) return;
  const items = await MenuItem.find({ owner: existing._id }).select('image');
  const uploads = await Upload.find({ owner: existing._id });
  await Promise.all([
    ...items.map((item) => discardImage(item.image)),
    ...uploads.map((upload) => discardImage(upload.url)),
    discardImage(existing.profilePicture),
    discardImage(existing.bannerImage),
    discardImage(existing.qrLogo)
  ]);
  await Upload.deleteMany({ owner: existing._id });
  await Staff.deleteMany({ restaurant: existing._id });
  await Promise.all([
    MenuItem.deleteMany({ owner: existing._id }),
    Order.deleteMany({ restaurantId: existing._id }),
    ServiceRequest.deleteMany({ restaurantId: existing._id }),
    Counter.deleteMany({ _id: { $regex: `^${existing._id}:` } })
  ]);
  await User.deleteOne({ _id: existing._id });
  console.log(`Replaced the existing ${PROFILE === DEMO ? 'demo restaurant' : `"${PROFILE.restaurantName}"`}.`);
}

function buildLines(lines, itemsByName) {
  return lines.map(([name, quantity, variantName, addOnNames = []]) => {
    const item = itemsByName.get(name);
    const variant = variantName ? item.variants.find((v) => v.name === variantName) : null;
    return {
      menuItem: String(item._id),
      quantity,
      variantId: variant ? String(variant._id) : undefined,
      addOnIds: addOnNames.map((addOn) => String(item.addOns.find((a) => a.name === addOn)._id))
    };
  });
}

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log(`Seeding database "${mongoose.connection.name}" on ${mongoose.connection.host}`);

  await removeExisting();

  const { staff: staffLogins, ...account } = PROFILE;
  const restaurant = await User.create({ ...account, password: await bcrypt.hash(PROFILE.password, 10) });
  const logoPng = await logoBuffer();
  const [banner, logo, qrLogo] = await Promise.all([
    addImage(fs.readFileSync(path.join(ASSETS, 'hero.webp')), 'banner', restaurant._id),
    addImage(logoPng, 'profile', restaurant._id),
    addImage(logoPng, 'logo', restaurant._id)
  ]);
  restaurant.set({ bannerImage: banner.url, profilePicture: logo.url, qrLogo: qrLogo.url });
  await restaurant.save();

  const items = [];
  for (const { image, ...fields } of MENU) {
    const { url } = await addImage(fs.readFileSync(path.join(ASSETS, `${image}.webp`)), 'menu', restaurant._id);
    items.push(await MenuItem.create({ ...fields, translations: TRANSLATIONS[fields.name], image: url, owner: restaurant._id }));
  }
  const itemsByName = new Map(items.map((item) => [item.name, item]));
  // Orders are priced from the menu; mark everything available while pricing sample orders.
  const pricingMenu = new Map(items.map((item) => [String(item._id), { ...item.toObject(), available: true }]));

  const history = historyOrders(restaurant, pricingMenu, itemsByName);
  await Order.insertMany(history.orders);
  for (const [fy, seq] of history.counters) await Counter.updateOne({ _id: counterKey(restaurant._id, fy) }, { $set: { seq } }, { upsert: true });
  // QR scans per table, roughly in line with the orders placed there
  const scans = {};
  for (const o of history.orders) scans[o.tableNumber] = (scans[o.tableNumber] || 0) + 1;
  await User.updateOne({ _id: restaurant._id }, { $set: { tableStats: Object.fromEntries(Object.entries(scans).map(([t, n]) => [t, Math.round(n * 1.4)])) } });

  // Oldest first, so billed and paid orders get invoice numbers in date order.
  const PAYMENT_METHODS = ['upi', 'cash', 'card'];
  const byAge = [...SAMPLE_ORDERS].sort((a, b) => b[0] - a[0]);
  for (const [index, [minutesAgo, tableNumber, status, customerName, lines]] of byAge.entries()) {
    const pricing = priceOrder(restaurant, pricingMenu, buildLines(lines, itemsByName));
    const createdAt = new Date(Date.now() - minutesAgo * 60 * 1000);
    const billedAt = new Date(createdAt.getTime() + 40 * 60 * 1000);
    const billing = ['billed', 'complete'].includes(status)
      ? { invoiceNumber: await nextInvoiceNumber(restaurant._id, billedAt), invoicedAt: billedAt }
      : {};
    if (status === 'complete') billing.payment = { method: PAYMENT_METHODS[index % 3], paidAt: new Date(billedAt.getTime() + 5 * 60 * 1000) };
    if (customerName === 'Meera') billing.feedback = { rating: 5, tags: ['tasty', 'quick'], comment: 'Soft idlis and perfect chai. Thank you!', createdAt: billedAt };
    await Order.create({
      ...pricing,
      ...billing,
      tableNumber,
      status,
      customerName,
      restaurantId: restaurant._id,
      trackingToken: crypto.randomBytes(24).toString('hex'),
      createdAt
    });
  }

  await ServiceRequest.create({ restaurantId: restaurant._id, tableNumber: 3, type: 'Water', customerName: 'Meera' });

  const staffPassword = await bcrypt.hash(PROFILE.password, 10);
  await Staff.deleteMany({ email: { $in: staffLogins.map((s) => s.email) } });
  await Staff.insertMany(staffLogins.map((member) => ({ ...member, restaurant: restaurant._id, password: staffPassword })));

  console.log(`Created "${PROFILE.restaurantName}": ${items.length} menu items, ${PROFILE.tables.length} tables, ${SAMPLE_ORDERS.length} live orders, ${history.orders.length} past orders.`);
  console.log(`Login: ${PROFILE.email} / ${PROFILE === DEMO ? PROFILE.password : '(REVIEW_PASSWORD)'}`);
  console.log(`Staff logins (same password): ${staffLogins.map((m) => `${m.email} (${m.role})`).join(', ')}`);
  console.log(`Customer menu: ${config.frontendUrl || 'http://localhost:3000'}/menu/${restaurant._id}?table=1`);
  await mongoose.disconnect();
}

// A guessable password would let anyone into the review account on a live server.
if (PROFILE === REVIEW && config.env === 'production' && (process.env.REVIEW_PASSWORD || '').length < 10) {
  console.error('Set REVIEW_PASSWORD (at least 10 characters) to create the App Store review account in production.');
  process.exit(1);
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
