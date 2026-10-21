const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 });

// ₹120, ₹25.3 -> ₹25.30 (paise shown only when there are any)
export function formatPrice(rupees) {
  const value = Number(rupees) || 0;
  return Number.isInteger(value) ? inr.format(value) : inr.format(value).replace(/(\.\d)$/, '$10');
}

export function timeAgo(date, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(date).getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(date) {
  return new Date(date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

// Axis and chart labels: ₹950, ₹12.5K, ₹1.2L, ₹3.4Cr (Indian units)
export function formatCompactPrice(rupees) {
  return `₹${compact.format(Number(rupees) || 0)}`;
}
