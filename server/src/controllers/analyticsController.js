const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { salesReport, indiaToday, addDays, daysBetween } = require('../services/analytics');

const MAX_DAYS = 366;

// GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD (India dates, inclusive; default the last 7 days)
exports.sales = asyncHandler(async (req, res) => {
  const to = req.query.to || indiaToday();
  const from = req.query.from || addDays(to, -6);
  const length = daysBetween(from, to);
  if (length < 1) throw AppError.badRequest('The start date must be on or before the end date', 'INVALID_RANGE');
  if (length > MAX_DAYS) throw AppError.badRequest(`Choose at most ${MAX_DAYS} days`, 'RANGE_TOO_LONG');
  res.json(await salesReport(req.user.userId, { from, to }));
});
