// Opening hours: [{ day: 0-6 (0 = Sunday), open: 'HH:MM', close: 'HH:MM', closed }].
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function formatClock(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const date = new Date(2000, 0, 1, h, m);
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: m ? '2-digit' : undefined });
}

// { open: boolean, label: string } for "now", or null when no hours are set.
export function openStatus(openingHours, now = new Date()) {
  if (!openingHours?.length) return null;
  const today = openingHours.find((d) => d.day === now.getDay());
  if (!today || today.closed) return { open: false, label: 'Closed today' };
  const minutes = now.getHours() * 60 + now.getMinutes();
  const open = toMinutes(today.open);
  let close = toMinutes(today.close);
  if (close <= open) close += 24 * 60; // closes after midnight
  if (minutes >= open && minutes < close) return { open: true, label: `Open now · until ${formatClock(today.close)}` };
  if (minutes < open) return { open: false, label: `Opens at ${formatClock(today.open)}` };
  return { open: false, label: 'Closed for today' };
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
