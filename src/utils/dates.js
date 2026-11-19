/**
 * Calendar-day helpers. Trips are booked in whole days in India time (Asia/Kolkata), whatever the
 * visitor's own time zone, and dates travel as 'YYYY-MM-DD' strings. Trip ranges are half-open
 * [pickup, return): a car returned on a day can be picked up by someone else that same day.
 */
const ZONE = 'Asia/Kolkata';
export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_DAYS_AHEAD = 180; // latest pickup, counted from today
export const MAX_TRIP_DAYS = 90;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayParts = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const utc = (day) => Date.parse(`${day}T00:00:00Z`);

/** True for a real 'YYYY-MM-DD' date. */
export const isDay = (s) => typeof s === 'string' && DAY_RE.test(s) && !Number.isNaN(utc(s));

/** The IST calendar day of an instant (Date, ISO string or timestamp), as 'YYYY-MM-DD'. */
export const istDay = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const p = Object.fromEntries(dayParts.formatToParts(d).map(({ type, value: v }) => [type, v]));
  return `${p.year}-${p.month}-${p.day}`;
};

/** Today in India, the earliest possible pickup day. */
export const todayIST = () => istDay(new Date());

export const addDays = (day, n) => new Date(utc(day) + n * DAY_MS).toISOString().slice(0, 10);

/** The same calendar day n years earlier (29 Feb falls back to 28 Feb). */
export const yearsBefore = (day, n) => {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y - n, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) dt.setUTCDate(0);
  return dt.toISOString().slice(0, 10);
};

/** Billed days for a trip: max(1, ceil(return - pickup)); 0 when the dates are missing or reversed. */
export const tripDays = (pickup, ret) => {
  if (!isDay(pickup) || !isDay(ret) || ret <= pickup) return 0;
  return Math.max(1, Math.ceil((utc(ret) - utc(pickup)) / DAY_MS));
};

/** Half-open overlap of two [start, end) day ranges. */
export const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && aEnd > bStart;

/** A stored date shown as its IST calendar day, e.g. "5 Dec 2026". */
export const formatDay = (value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!value) return '';
  const d = isDay(value) ? new Date(`${value}T00:00:00+05:30`) : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { timeZone: ZONE, ...opts });
};
