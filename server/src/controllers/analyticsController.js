const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { salesReport, feedbackReport, indiaToday, addDays, daysBetween } = require('../services/analytics');

const MAX_DAYS = 366;

// India dates, inclusive; default the last `defaultDays` days.
function rangeFrom(query, defaultDays) {
  const to = query.to || indiaToday();
  const from = query.from || addDays(to, -(defaultDays - 1));
  const length = daysBetween(from, to);
  if (length < 1) throw AppError.badRequest('The start date must be on or before the end date', 'INVALID_RANGE');
  if (length > MAX_DAYS) throw AppError.badRequest(`Choose at most ${MAX_DAYS} days`, 'RANGE_TOO_LONG');
  return { from, to };
}

// GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD (default the last 7 days)
exports.sales = asyncHandler(async (req, res) => {
  res.json(await salesReport(req.user.userId, rangeFrom(req.query, 7)));
});

// GET /api/analytics/feedback?from&to (default the last 30 days)
exports.feedback = asyncHandler(async (req, res) => {
  res.json(await feedbackReport(req.user.userId, rangeFrom(req.query, 30)));
});
