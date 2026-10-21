const Counter = require('../models/Counter');

// Indian financial year (1 April - 31 March) of a date, in India time: "2026-27".
function financialYear(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric' }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

const counterKey = (restaurantId, fy) => `${restaurantId}:invoice:${fy}`;
// "2026-27/000123" stays within GST's 16-character limit.
const formatInvoiceNumber = (fy, seq) => `${fy}/${String(seq).padStart(6, '0')}`;

// Consecutive per restaurant and financial year.
async function nextInvoiceNumber(restaurantId, date = new Date()) {
  const fy = financialYear(date);
  return formatInvoiceNumber(fy, await Counter.next(counterKey(restaurantId, fy)));
}

module.exports = { financialYear, nextInvoiceNumber, counterKey, formatInvoiceNumber };
