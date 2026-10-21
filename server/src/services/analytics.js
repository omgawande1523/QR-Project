const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');

// Restaurants are in India: days, weeks and hours are counted in India time.
const TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Rupee amounts are summed as whole paise so totals never drift.
const paise = (field) => ({ $round: [{ $multiply: [{ $ifNull: [field, 0] }, 100] }, 0] });
const rupees = (p) => Math.round(p) / 100;

// "2026-10-21" (an India date) -> the UTC instant of its midnight in India.
const startOfIndiaDay = (date) => new Date(Date.parse(`${date}T00:00:00Z`) - IST_OFFSET_MS);
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
// Monday of the week a date falls in.
const weekStart = (date) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));

function indiaToday(now = new Date()) {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

async function totalsFor(restaurantId, start, end) {
  const [row] = await Order.aggregate([
    { $match: { restaurantId, createdAt: { $gte: start, $lt: end }, status: { $ne: 'cancelled' } } },
    { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: paise('$totalAmount') } } }
  ]);
  const orders = row?.orders || 0;
  const revenue = row?.revenue || 0;
  return { orders, revenue: rupees(revenue), averageOrder: orders ? rupees(revenue / orders) : 0 };
}

/**
 * Sales report for one restaurant between two India dates (inclusive). Cancelled orders are left
 * out of every figure except `cancelled`.
 */
async function salesReport(restaurantIdString, { from, to }) {
  const restaurantId = new mongoose.Types.ObjectId(restaurantIdString);
  const start = startOfIndiaDay(from);
  const end = startOfIndiaDay(addDays(to, 1));
  const length = daysBetween(from, to);
  const previousFrom = addDays(from, -length);

  const [facets] = await Order.aggregate([
    { $match: { restaurantId, createdAt: { $gte: start, $lt: end } } },
    {
      $facet: {
        cancelled: [{ $match: { status: 'cancelled' } }, { $count: 'n' }],
        days: [
          { $match: { status: { $ne: 'cancelled' } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIME_ZONE } }, orders: { $sum: 1 }, revenue: { $sum: paise('$totalAmount') } } }
        ],
        hours: [
          { $match: { status: { $ne: 'cancelled' } } },
          {
            $group: {
              _id: { day: { $dayOfWeek: { date: '$createdAt', timezone: TIME_ZONE } }, hour: { $hour: { date: '$createdAt', timezone: TIME_ZONE } } },
              orders: { $sum: 1 },
              revenue: { $sum: paise('$totalAmount') }
            }
          }
        ],
        tables: [
          { $match: { status: { $ne: 'cancelled' } } },
          { $group: { _id: '$tableNumber', orders: { $sum: 1 }, revenue: { $sum: paise('$totalAmount') } } }
        ],
        payments: [
          { $match: { 'payment.paidAt': { $exists: true } } },
          { $group: { _id: '$payment.method', orders: { $sum: 1 }, revenue: { $sum: paise('$totalAmount') } } }
        ],
        items: [
          { $match: { status: { $ne: 'cancelled' } } },
          { $unwind: '$items' },
          { $group: { _id: { id: '$items.menuItem', name: '$items.menuItemName' }, quantity: { $sum: '$items.quantity' }, revenue: { $sum: paise('$items.lineTotal') } } }
        ]
      }
    }
  ]);

  // Item categories come from the current menu; dishes deleted since are "Uncategorised".
  const itemIds = facets.items.map((i) => i._id.id).filter(Boolean);
  const menu = await mongoose.model('MenuItem').find({ _id: { $in: itemIds } }).select('category').lean();
  const categoryOf = new Map(menu.map((m) => [String(m._id), m.category || 'Uncategorised']));

  const itemsByName = new Map();
  const categories = new Map();
  for (const row of facets.items) {
    const name = row._id.name || 'Unnamed dish';
    const category = categoryOf.get(String(row._id.id)) || 'Uncategorised';
    const item = itemsByName.get(name) || { name, category, quantity: 0, revenue: 0 };
    item.quantity += row.quantity;
    item.revenue += row.revenue;
    itemsByName.set(name, item);
    const cat = categories.get(category) || { category, quantity: 0, revenue: 0 };
    cat.quantity += row.quantity;
    cat.revenue += row.revenue;
    categories.set(category, cat);
  }
  const byRevenue = (a, b) => b.revenue - a.revenue || b.quantity - a.quantity;
  const finish = (row) => ({ ...row, revenue: rupees(row.revenue) });

  // Every day in the range, including days without orders, then grouped into Monday weeks.
  const dayRows = new Map(facets.days.map((d) => [d._id, d]));
  const days = Array.from({ length }, (_, i) => {
    const date = addDays(from, i);
    return { date, orders: dayRows.get(date)?.orders || 0, revenue: dayRows.get(date)?.revenue || 0 };
  });
  const weeks = new Map();
  for (const day of days) {
    const key = weekStart(day.date);
    const week = weeks.get(key) || { weekStart: key, orders: 0, revenue: 0 };
    week.orders += day.orders;
    week.revenue += day.revenue;
    weeks.set(key, week);
  }

  const owner = await User.findById(restaurantId).select('tables tableStats').lean();
  const tableRows = new Map(facets.tables.map((t) => [t._id, t]));
  const tableNumbers = [...new Set([...(owner?.tables || []), ...tableRows.keys()])].filter((n) => n != null).sort((a, b) => a - b);
  const scans = owner?.tableStats || {};

  const totalRevenue = days.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = days.reduce((sum, d) => sum + d.orders, 0);

  return {
    range: { from, to, days: length, timeZone: TIME_ZONE },
    totals: {
      orders: totalOrders,
      revenue: rupees(totalRevenue),
      averageOrder: totalOrders ? rupees(totalRevenue / totalOrders) : 0,
      itemsSold: [...itemsByName.values()].reduce((sum, i) => sum + i.quantity, 0),
      cancelled: facets.cancelled[0]?.n || 0
    },
    previous: { from: previousFrom, to: addDays(from, -1), ...(await totalsFor(restaurantId, startOfIndiaDay(previousFrom), start)) },
    days: days.map(finish),
    weeks: [...weeks.values()].map(finish),
    // day: 0 = Sunday, as in the rest of the app
    hours: facets.hours.map((h) => ({ day: h._id.day - 1, hour: h._id.hour, orders: h.orders, revenue: rupees(h.revenue) })),
    items: [...itemsByName.values()].sort(byRevenue).map(finish),
    categories: [...categories.values()].sort(byRevenue).map(finish),
    tables: tableNumbers.map((table) => ({
      table,
      orders: tableRows.get(table)?.orders || 0,
      revenue: rupees(tableRows.get(table)?.revenue || 0),
      scans: Number(scans[String(table)] || 0)
    })),
    payments: facets.payments.map((p) => ({ method: p._id, orders: p.orders, revenue: rupees(p.revenue) }))
  };
}

module.exports = { salesReport, indiaToday, addDays, daysBetween, TIME_ZONE };
