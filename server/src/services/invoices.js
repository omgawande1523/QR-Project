const Counter = require('../models/Counter');

// Indian financial year (1 April - 31 March) of a date, in India time: "2026-27".
function financialYear(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric' }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

// Consecutive per restaurant and financial year; "2026-27/000123" stays within GST's 16-character limit.
async function nextInvoiceNumber(restaurantId, date = new Date()) {
  const fy = financialYear(date);
  const seq = await Counter.next(`${restaurantId}:invoice:${fy}`);
  return `${fy}/${String(seq).padStart(6, '0')}`;
}

module.exports = { financialYear, nextInvoiceNumber };
