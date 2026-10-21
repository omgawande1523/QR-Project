// Loads the demo restaurant "Olive Leaf Café" with a full menu, 5 tables and sample orders.
//
//   npm run seed            (from the repo root or server/)
//   Login: demo@qrmenu.test / Demo@1234
//
// Safe to re-run: it only replaces the demo account's own data (its menu items, orders,
// service requests and uploaded images). Nothing else in the database is touched.

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
const { saveImage } = require('../src/services/images');
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
  qrColor: '#5b6b1f'
};

const ASSETS = path.join(__dirname, 'seed-assets');

// image: file in seed-assets/ (without .webp). Prices in rupees.
const MENU = [
  { category: 'Breakfast', name: 'Masala Dosa', image: 'masala-dosa', price: 120, isVeg: true,
    description: 'Crisp rice-lentil crepe filled with spiced potato, served with sambar and coconut chutney.',
    addOns: [{ name: 'Extra chutney', price: 15 }, { name: 'Cheese', price: 30 }] },
  { category: 'Breakfast', name: 'Idli Sambar', image: 'idli-sambar', price: 80, isVeg: true,
    description: 'Three steamed rice cakes with a medu vada, sambar and chutney.' },
  { category: 'Breakfast', name: 'Kanda Poha', image: 'poha', price: 60, isVeg: true,
    description: 'Flattened rice tempered with onion, peanuts, curry leaves and a squeeze of lime.' },
  { category: 'Breakfast', name: 'Aloo Paratha', image: 'aloo-paratha', price: 90, isVeg: true,
    description: 'Whole-wheat flatbread stuffed with spiced potato, with pickle and curd.',
    addOns: [{ name: 'White butter', price: 15 }, { name: 'Extra curd', price: 20 }] },

  { category: 'Starters', name: 'Paneer Tikka', image: 'paneer-tikka', price: 240, isVeg: true,
    description: 'Cottage cheese, peppers and onion marinated in yoghurt and spices, chargrilled in the tandoor.',
    variants: [{ name: 'Half', price: 150 }, { name: 'Full', price: 240 }] },
  { category: 'Starters', name: 'Chicken 65', image: 'chicken-65', price: 260, isVeg: false,
    description: 'Fiery, curry-leaf fried chicken bites in the classic Chennai style.' },
  { category: 'Starters', name: 'Chicken Tikka', image: 'chicken-tikka', price: 280, isVeg: false,
    description: 'Boneless chicken marinated overnight in hung curd and spices, skewered and roasted.',
    variants: [{ name: 'Half', price: 170 }, { name: 'Full', price: 280 }] },
  { category: 'Starters', name: 'Veg Spring Rolls', image: 'spring-rolls', price: 160, isVeg: true,
    description: 'Crisp rolls stuffed with stir-fried vegetables and glass noodles, with sweet chilli sauce.' },
  { category: 'Starters', name: 'Hara Bhara Kebab', image: 'hara-bhara-kebab', price: 180, isVeg: true,
    description: 'Spinach, pea and potato patties studded with cashew, with mint chutney.' },

  { category: 'Mains', name: 'Home-style Chicken Curry', image: 'chicken-curry', price: 320, isVeg: false,
    description: 'Slow-cooked bone-in chicken in an onion-tomato gravy with whole spices.',
    variants: [{ name: 'Half', price: 200 }, { name: 'Full', price: 320 }] },
  { category: 'Mains', name: 'Paneer Butter Masala', image: 'paneer-butter-masala', price: 260, isVeg: true,
    description: 'Soft paneer in a rich, mildly sweet tomato and cashew gravy finished with butter.',
    addOns: [{ name: 'Extra paneer', price: 60 }, { name: 'Extra butter', price: 20 }] },
  { category: 'Mains', name: 'Dal Makhani', image: 'dal-makhani', price: 210, isVeg: true,
    description: 'Black lentils and kidney beans simmered overnight with cream and butter.' },
  { category: 'Mains', name: 'Veg Biryani', image: 'veg-biryani', price: 230, isVeg: true,
    description: 'Fragrant basmati layered with vegetables, saffron and fried onions, with raita.' },
  { category: 'Mains', name: 'Chicken Biryani', image: 'chicken-biryani', price: 290, isVeg: false,
    description: 'Dum-cooked basmati and marinated chicken with saffron, mint and caramelised onion.',
    variants: [{ name: 'Half', price: 190 }, { name: 'Full', price: 290 }],
    addOns: [{ name: 'Boiled egg', price: 20 }, { name: 'Extra raita', price: 25 }] },

  { category: 'Breads & Rice', name: 'Butter Naan', image: 'butter-naan', price: 50, isVeg: true,
    description: 'Soft leavened bread from the tandoor, brushed with butter.' },
  { category: 'Breads & Rice', name: 'Garlic Naan', image: 'garlic-naan', price: 60, isVeg: true,
    description: 'Tandoori naan topped with garlic and coriander.' },
  { category: 'Breads & Rice', name: 'Jeera Rice', image: 'jeera-rice', price: 140, isVeg: true,
    description: 'Basmati rice tempered with cumin and ghee.' },

  { category: 'Beverages', name: 'Masala Chai', image: 'masala-chai', price: 40, isVeg: true,
    description: 'Strong tea brewed with milk, ginger, cardamom and spices.' },
  { category: 'Beverages', name: 'Filter Coffee', image: 'filter-coffee', price: 50, isVeg: true,
    description: 'South Indian decoction coffee with frothy hot milk.' },
  { category: 'Beverages', name: 'Mango Lassi', image: 'mango-lassi', price: 90, isVeg: true,
    description: 'Thick yoghurt smoothie blended with Alphonso mango pulp.',
    variants: [{ name: 'Regular', price: 90 }, { name: 'Large', price: 130 }] },

  { category: 'Desserts', name: 'Gulab Jamun', image: 'gulab-jamun', price: 80, isVeg: true,
    description: 'Two warm milk dumplings soaked in rose and cardamom syrup.',
    addOns: [{ name: 'Vanilla ice cream', price: 40 }] },
  { category: 'Desserts', name: 'Rasmalai', image: 'rasmalai', price: 110, isVeg: true, available: false,
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

async function logoBuffer() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <circle cx="256" cy="256" r="256" fill="#5b6b1f"/>
    <path d="M256 104c-86 52-118 140-74 212 22 36 52 52 74 92 22-40 52-56 74-92 44-72 12-160-74-212z" fill="#c6d36a"/>
    <path d="M256 150v250" stroke="#5b6b1f" stroke-width="14" stroke-linecap="round"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function removeExistingDemo() {
  const existing = await User.findOne({ email: DEMO.email });
  if (!existing) return;
  const items = await MenuItem.find({ owner: existing._id }).select('image');
  await Promise.all([
    ...items.map((item) => discardImage(item.image)),
    discardImage(existing.profilePicture),
    discardImage(existing.bannerImage),
    discardImage(existing.qrLogo)
  ]);
  await Promise.all([
    MenuItem.deleteMany({ owner: existing._id }),
    Order.deleteMany({ restaurantId: existing._id }),
    ServiceRequest.deleteMany({ restaurantId: existing._id })
  ]);
  await User.deleteOne({ _id: existing._id });
  console.log('Replaced the existing demo restaurant.');
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

  await removeExistingDemo();

  const [banner, logo] = await Promise.all([
    saveImage(fs.readFileSync(path.join(ASSETS, 'hero.webp')), 'banner'),
    logoBuffer().then((buffer) => saveImage(buffer, 'logo'))
  ]);

  const restaurant = await User.create({
    ...DEMO,
    password: await bcrypt.hash(DEMO.password, 10),
    bannerImage: banner.url,
    profilePicture: logo.url,
    qrLogo: logo.url
  });

  const items = [];
  for (const { image, ...fields } of MENU) {
    const { url } = await saveImage(fs.readFileSync(path.join(ASSETS, `${image}.webp`)), 'menu');
    items.push(await MenuItem.create({ ...fields, image: url, owner: restaurant._id }));
  }
  const itemsByName = new Map(items.map((item) => [item.name, item]));
  // Orders are priced from the menu; mark everything available while pricing sample orders.
  const pricingMenu = new Map(items.map((item) => [String(item._id), { ...item.toObject(), available: true }]));

  for (const [minutesAgo, tableNumber, status, customerName, lines] of SAMPLE_ORDERS) {
    const pricing = priceOrder(restaurant, pricingMenu, buildLines(lines, itemsByName));
    await Order.create({
      ...pricing,
      tableNumber,
      status,
      customerName,
      restaurantId: restaurant._id,
      trackingToken: crypto.randomBytes(24).toString('hex'),
      createdAt: new Date(Date.now() - minutesAgo * 60 * 1000)
    });
  }

  await ServiceRequest.create({ restaurantId: restaurant._id, tableNumber: 3, type: 'Water', customerName: 'Meera' });

  console.log(`Created "${DEMO.restaurantName}": ${items.length} menu items, ${DEMO.tables.length} tables, ${SAMPLE_ORDERS.length} orders.`);
  console.log(`Login: ${DEMO.email} / ${DEMO.password}`);
  console.log(`Customer menu: ${config.frontendUrl || 'http://localhost:3000'}/menu/${restaurant._id}?table=1`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
