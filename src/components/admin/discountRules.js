/** Shared helpers for the admin promo-code screens. */

const hasLimit = (v) => v !== undefined && v !== null && v !== '';

// Calendar days are India time: "today" and the expiry day are IST dates
export const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
export const endOfDayIST = (ymd) => new Date(`${ymd}T23:59:59.999+05:30`).toISOString();
export const fmtDateIST = (d) => new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });

export const isExpired = (discount) => Boolean(discount.expiresAt) && new Date(discount.expiresAt).getTime() < Date.now();
export const isUsedUp = (discount) => hasLimit(discount.maxUses) && (Number(discount.usedCount) || 0) >= Number(discount.maxUses);
export const hasUseLimit = (discount) => hasLimit(discount.maxUses);
export const hasPerUserLimit = (discount) => hasLimit(discount.maxUsesPerUser);

/** Why a code cannot be broadcast right now, or '' when it can. */
export const broadcastBlockReason = (discount) => {
  if (!discount.isActive) return 'Activate this code before broadcasting it.';
  if (isExpired(discount)) return 'This code has expired.';
  if (isUsedUp(discount)) return 'This code has no uses left.';
  return '';
};

/** Reads a broadcast result ({ sent, failed, skipped }) from a response, or null if there is none. */
export const readBroadcastResult = (data) => {
  const r = data?.result || data?.broadcast || data;
  if (!r || r.sent === undefined) return null;
  return { sent: Number(r.sent) || 0, failed: Number(r.failed) || 0, skipped: Number(r.skipped) || 0 };
};

/** One-line summary of a broadcast result. */
export const broadcastSummary = (result) => {
  if (!result) return '';
  const parts = [`Sent to ${result.sent}`];
  if (result.failed) parts.push(`${result.failed} failed`);
  if (result.skipped) parts.push(`${result.skipped} skipped`);
  return parts.join(' · ');
};
