/**
 * Booking dates are calendar days in India time (Asia/Kolkata).
 * A day is stored as UTC midnight of that calendar date ("2026-12-01" -> 2026-12-01T00:00:00Z),
 * which is how the date inputs have always been saved, so old and new bookings compare the same way.
 * Trips are half-open [pickup, return): the return day is free for the next customer.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const TIME_ZONE = 'Asia/Kolkata';
const MAX_LEAD_DAYS = 180;    // pickup at most this many days ahead
const MAX_DURATION_DAYS = 90; // longest trip

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const istParts = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "YYYY-MM-DD" of an instant, as the calendar date in India. */
const istDayOf = (date = new Date()) => {
  const parts = Object.fromEntries(istParts.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/** Today's date in India, "YYYY-MM-DD". */
const todayIST = () => istDayOf(new Date());

/** UTC midnight of a "YYYY-MM-DD" day (null when it is not a real date). */
const dayStart = (day) => {
  const m = DAY_RE.exec(day || '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
};

/**
 * Parse a booking date from the client. Accepts "YYYY-MM-DD" (what the date inputs send);
 * a full ISO timestamp is read as the India calendar date it falls on. Returns a Date or null.
 */
const parseDay = (value) => {
  if (typeof value !== 'string' || value.length > 40) return null;
  const trimmed = value.trim();
  if (DAY_RE.test(trimmed)) return dayStart(trimmed);
  const instant = new Date(trimmed);
  if (Number.isNaN(instant.getTime())) return null;
  return dayStart(istDayOf(instant));
};

/** The start of today (India date), in the stored form. */
const todayStart = () => dayStart(todayIST());

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

/** Days charged for a trip: at least one, part days round up. */
const billingDays = (pickup, ret) => Math.max(1, Math.ceil((ret - pickup) / DAY_MS));

module.exports = {
  DAY_MS,
  TIME_ZONE,
  MAX_LEAD_DAYS,
  MAX_DURATION_DAYS,
  istDayOf,
  todayIST,
  dayStart,
  parseDay,
  todayStart,
  addDays,
  billingDays,
};
