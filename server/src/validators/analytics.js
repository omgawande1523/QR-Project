const { z } = require('./common');

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const indiaDate = z.string().regex(DATE, 'Use YYYY-MM-DD dates').refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Not a real date');

exports.sales = {
  query: z.object({ from: indiaDate.optional(), to: indiaDate.optional() })
};
