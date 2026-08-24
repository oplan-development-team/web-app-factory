// Status thresholds and time/date formatting helpers.

export const ONE_HOUR_MS = 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;
export const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

// How long a DEPARTED row stays on the board (visible, struck through)
// before it flaps to blank and is removed for good.
export const DEPARTED_LINGER_MS = 20 * 1000;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function getStatus(msRemaining) {
  if (msRemaining <= 0) return { code: 'departed', label: 'DEPARTED' };
  if (msRemaining <= ONE_DAY_MS) return { code: 'final', label: 'FINAL CALL' };
  if (msRemaining <= SEVEN_DAYS_MS) return { code: 'boarding', label: 'BOARDING' };
  return { code: 'scheduled', label: 'SCHEDULED' };
}

export function formatRemaining(msRemaining) {
  if (msRemaining <= 0) return { days: 0, hours: 0 };
  const totalHours = Math.floor(msRemaining / ONE_HOUR_MS);
  const days = Math.min(Math.floor(totalHours / 24), 999);
  const hours = totalHours % 24;
  return { days, hours };
}

export function formatDue(dateObj) {
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = MONTHS[dateObj.getMonth()];
  const year = String(dateObj.getFullYear()).slice(-2);
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const mm = String(dateObj.getMinutes()).padStart(2, '0');
  return { day, month, year, hh, mm };
}
