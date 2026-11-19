/**
 * ============================================================================
 * ADMIN DISCOUNTS & PROMOTIONAL ALERTS PAGE
 * ============================================================================
 * Allows administrative staff to:
 *  1. View high-level metrics (active promo codes, newsletter subscribers, users)
 *  2. Create new discount coupons with percentage caps, minimum spend, usage limits,
 *     expiry and an optional immediate broadcast
 *  3. Toggle coupon activation status (Active / Inactive)
 *  4. Broadcast promotional email campaigns to all users & subscribers
 *  5. Copy codes with a single click and delete expired coupons
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, LayoutGroup, m } from 'framer-motion';
import { Tag, Send, Plus, Trash2, Users, Bell, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import CountUp from '../../components/ui/CountUp';
import { ERROR_IN } from '../../components/booking/FieldError';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import LoadError from '../../components/admin/LoadError';
import CreateDiscountForm from '../../components/admin/CreateDiscountForm';
import IconSwap from '../../components/layout/IconSwap';
import { TableSkeleton } from '../../components/ui/Skeletons';
import { EASE, LAYOUT, listItem } from '../../theme/motion';
import {
  fmtDateIST, isExpired, isUsedUp, hasUseLimit, hasPerUserLimit,
  broadcastBlockReason, readBroadcastResult, broadcastSummary,
} from '../../components/admin/discountRules';

const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

// Promo rows: a deleted code fades away and the rest close up; a new code fades in where it lands
const ROW_TRANSITION = { layout: { duration: 0.3, ease: EASE.out } };
// Skeleton → table: the loaded codes fade in where the skeleton was
const viewIn = { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2, ease: EASE.out } } };
// Small row buttons give a little under the press (colour still answers hover): labelled buttons as
// much as any button, the icon buttons a touch more
const press = 'duration-150 ease-out active:scale-[0.98]';
const iconPress = 'duration-150 ease-out active:scale-[0.96]';
// Broadcast dialog: the note form steps out and the result comes into focus (the counts are shown
// as they are: a send result never ticks through made-up figures)
const composeOut = { opacity: 0, transition: { duration: 0.15, ease: EASE.in } };
const resultIn = {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.36, ease: EASE.out } },
};

export default function AdminDiscountsPage() {

  const [discounts, setDiscounts] = useState([]);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  // Distinct addresses a broadcast reaches (after de-duplication and opt-outs), and whether email is set up
  const [audienceCount, setAudienceCount] = useState(null);
  const [emailReady, setEmailReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const copyTimer = useRef(null);

  // New discount form
  const [showForm, setShowForm] = useState(false);

  // Broadcast modal
  const [broadcastTarget, setBroadcastTarget] = useState(null);
  const [customBroadcastMsg, setCustomBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastError, setBroadcastError] = useState('');
  const [broadcastResult, setBroadcastResult] = useState(null); // { sent, failed, skipped, message }

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchDiscounts = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/discount');
      setDiscounts(data.discounts || []);
      setSubscriberCount(data.subscriberCount || 0);
      setUserCount(data.userCount || 0);
      setAudienceCount(typeof data.audienceCount === 'number' ? data.audienceCount : null);
      setEmailReady(data.emailReady !== false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load discounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiscounts();
    return () => clearTimeout(copyTimer.current);
  }, [fetchDiscounts]);

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedCode(''), 2000);
    } catch {
      toast.error('Could not copy. Select the code and copy it instead.');
    }
  };

  const handleToggle = async (id) => {
    try {
      const { data } = await api.patch(`/discount/${id}/toggle`);
      toast.success(data.message || 'Status updated');
      fetchDiscounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error updating status.');
    }
  };

  const openDelete = (discount) => { setDeleteError(''); setDeleteTarget(discount); };
  const closeDelete = useCallback(() => setDeleteTarget(null), []);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const { data } = await api.delete(`/discount/${deleteTarget._id}`);
      toast.success(data.message || 'Promo code deleted');
      setDeleteTarget(null);
      fetchDiscounts();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Error deleting promo code.');
    } finally {
      setDeleting(false);
    }
  };

  const openBroadcast = (discount) => {
    setBroadcastTarget(discount);
    setCustomBroadcastMsg('');
    setBroadcastError('');
    setBroadcastResult(null);
  };
  const closeBroadcast = useCallback(() => {
    if (!broadcasting) setBroadcastTarget(null);
  }, [broadcasting]);

  const handleBroadcast = async () => {
    if (!broadcastTarget) return;
    setBroadcasting(true);
    setBroadcastError('');
    try {
      const { data } = await api.post(`/discount/broadcast/${broadcastTarget._id}`, {
        customMessage: customBroadcastMsg.trim() || undefined,
      });
      const result = readBroadcastResult(data);
      setBroadcastResult({ ...(result || {}), message: data?.message || '' });
      toast.success(result ? `Broadcast: ${broadcastSummary(result)}` : data?.message || 'Broadcast sent');
    } catch (err) {
      // 503: email is not set up on the server; 400: the code is inactive, expired or used up;
      // 502: every send failed (the body still carries the counts)
      const failedResult = readBroadcastResult(err.response?.data);
      if (failedResult) setBroadcastResult({ ...failedResult, message: err.response.data.message || '' });
      else setBroadcastError(err.response?.data?.message || 'Failed to broadcast discount.');
    } finally {
      setBroadcasting(false);
    }
  };

  const tileKey = loading ? 'loading' : 'ready';
  const activeCount = discounts.filter(d => d.isActive && !isExpired(d) && !isUsedUp(d)).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-wide font-black uppercase tracking-tight text-2xl sm:text-3xl">
            Offers and alerts
          </h1>
          <p className="text-muted text-sm mt-1">
            Manage promotional coupon codes and broadcast discount notifications to users & subscribers.
          </p>
        </div>

        <Button
          variant={showForm ? 'secondary' : 'primary'}
          icon={showForm ? undefined : Plus}
          onClick={() => setShowForm(!showForm)}
          aria-expanded={showForm}
          className="font-extrabold"
        >
          {showForm ? 'Cancel' : 'Create Promo Code'}
        </Button>
      </div>

      {/* Metric Cards: each figure shows its real value at once and only glides when a refresh changes
          it. While the first fetch runs the tiles read 0; keying on `loading` mounts the loaded figure
          fresh, so it lands as-is instead of counting up from that placeholder. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-line rounded-chip p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Total Promo Codes</span>
            <Tag className="w-4 h-4 text-muted" aria-hidden="true" />
          </div>
          <div className="text-2xl font-black text-ink mt-2"><CountUp key={tileKey} value={discounts.length} duration={700} fromZero={false} /></div>
          <p className="text-[11px] text-muted mt-0.5">
            {activeCount} usable right now
          </p>
        </div>

        <div className="bg-surface border border-line rounded-chip p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Discount Subscribers</span>
            <Bell className="w-4 h-4 text-muted" aria-hidden="true" />
          </div>
          <div className="text-2xl font-black text-ink mt-2"><CountUp key={tileKey} value={subscriberCount} duration={700} fromZero={false} /></div>
          <p className="text-[11px] text-muted mt-0.5">Opted-in for discount emails</p>
        </div>

        <div className="bg-surface border border-line rounded-chip p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Registered Users</span>
            <Users className="w-4 h-4 text-muted" aria-hidden="true" />
          </div>
          <div className="text-2xl font-black text-ink mt-2"><CountUp key={tileKey} value={userCount} duration={700} fromZero={false} /></div>
          <p className="text-[11px] text-muted mt-0.5">Eligible for discount broadcasts</p>
        </div>
      </div>

      {/* Opening the form: it fades in under the bar while the list below glides down to make room.
          Closing: the form fades out, then the list glides back up (LayoutGroup tells the list when
          the form has gone). Reduced motion: both simply appear and disappear. */}
      <LayoutGroup>
      {/* Create Promo Code Form */}
      <AnimatePresence>
        {showForm && (
          <CreateDiscountForm
            onCreated={() => { setShowForm(false); fetchDiscounts(); }}
            onRefresh={fetchDiscounts}
            onCancel={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      {error && discounts.length > 0 && <LoadError message={error} onRetry={fetchDiscounts} />}

      {/* Discounts List */}
      <m.div layout="position" transition={{ layout: LAYOUT }} className="bg-surface border border-line rounded-chip overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">Promo Codes</h2>
          <span className="text-xs text-muted">{discounts.length} codes registered</span>
        </div>

        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : error && discounts.length === 0 ? (
          <div className="p-4"><LoadError message={error} onRetry={fetchDiscounts} /></div>
        ) : discounts.length === 0 ? (
          <div className="py-16 text-center text-muted">
            No promo codes created yet. Click "Create Promo Code" to get started!
          </div>
        ) : (
          <m.div {...viewIn} className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-raised text-xs font-bold uppercase tracking-wider text-muted border-b border-line">
                <tr>
                  <th scope="col" className="py-3.5 px-5">Promo Code</th>
                  <th scope="col" className="py-3.5 px-5">Discount</th>
                  <th scope="col" className="py-3.5 px-5">Rules</th>
                  <th scope="col" className="py-3.5 px-5">Uses</th>
                  <th scope="col" className="py-3.5 px-5">Expires</th>
                  <th scope="col" className="py-3.5 px-5">Status</th>
                  <th scope="col" className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <AnimatePresence initial={false}>
                {discounts.map((discount) => {
                  const expired = isExpired(discount);
                  const usedUp = isUsedUp(discount);
                  const blocked = broadcastBlockReason(discount)
                    || (emailReady ? '' : 'Email is not set up on the server, so offer emails cannot be sent.');
                  const used = Number(discount.usedCount) || 0;
                  return (
                    <m.tr key={discount._id} layout="position" {...listItem} transition={ROW_TRANSITION} className="hover:bg-ground/50 transition-colors">
                      {/* Code */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-base text-ink tracking-wide bg-ink/[0.06] px-2.5 py-1 rounded-lg border border-line">
                            {discount.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(discount.code)}
                            className={`hit-area p-1.5 text-muted hover:text-ink rounded-lg hover:bg-ink/5 transition-[color,background-color,transform] ${iconPress}`}
                            title="Copy code"
                            aria-label={copiedCode === discount.code ? `Copied ${discount.code}` : `Copy code ${discount.code}`}
                          >
                            {/* Copy → tick: the confirmation cross-fades in place, and back after two seconds */}
                            <IconSwap swapKey={copiedCode === discount.code ? 'copied' : 'copy'} turn={0}>
                              {copiedCode === discount.code ? <Check className="w-4 h-4 text-ok" /> : <Copy className="w-4 h-4" />}
                            </IconSwap>
                          </button>
                        </div>
                        {discount.createdAt && (
                          <p className="text-[11px] text-muted mt-1.5">Added {fmtDateIST(discount.createdAt)}</p>
                        )}
                      </td>

                      {/* Discount */}
                      <td className="py-4 px-5">
                        <p className="font-bold text-ink whitespace-nowrap">{discount.percentageOff}% OFF</p>
                        <p className="text-xs text-muted whitespace-nowrap">
                          {discount.maxDiscount ? `Up to ${money(discount.maxDiscount)}` : 'No cap'}
                        </p>
                      </td>

                      {/* Rules */}
                      <td className="py-4 px-5 text-xs text-muted">
                        <p className="whitespace-nowrap">{Number(discount.minAmount) > 0 ? `Min booking ${money(discount.minAmount)}` : 'Any amount'}</p>
                        <p className="whitespace-nowrap">
                          {hasPerUserLimit(discount)
                            ? `${discount.maxUsesPerUser} per customer`
                            : 'No per-customer limit'}
                        </p>
                      </td>

                      {/* Uses */}
                      <td className="py-4 px-5 text-xs">
                        <p className={`font-bold whitespace-nowrap ${usedUp ? 'text-danger' : 'text-ink'}`}>
                          {hasUseLimit(discount) ? `${used} / ${discount.maxUses}` : `${used} used`}
                        </p>
                        <p className="text-muted whitespace-nowrap">{hasUseLimit(discount) ? 'used / total' : 'Unlimited'}</p>
                      </td>

                      {/* Expiry */}
                      <td className="py-4 px-5 text-xs whitespace-nowrap">
                        {discount.expiresAt ? (
                          <span className={expired ? 'font-bold text-danger' : 'text-ink'}>
                            {expired ? 'Expired ' : ''}{fmtDateIST(discount.expiresAt)}
                          </span>
                        ) : (
                          <span className="text-muted">No expiry</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5">
                        <div className="flex flex-col items-start gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggle(discount._id)}
                            aria-label={`${discount.code} is ${discount.isActive ? 'active' : 'inactive'}. ${discount.isActive ? 'Deactivate' : 'Activate'} it`}
                            className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer border transition-[color,background-color,border-color,opacity,box-shadow,transform] ${press} ${
 discount.isActive
 ? 'bg-ok/10 text-ok border-ok/25 hover:bg-ok/20'
 : 'bg-ink/5 text-muted border-line hover:bg-ink/10'
 }`}
                            title="Click to toggle status"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ease-out ${discount.isActive ? 'bg-ok' : 'bg-muted'}`} aria-hidden="true" />
                            {discount.isActive ? 'Active' : 'Inactive'}
                          </button>
                          {(expired || usedUp) && (
                            <span className="code-label text-[11px] text-danger">{expired ? 'Expired' : 'Used up'}</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Broadcast Button: only for codes customers can actually use */}
                          <span title={blocked || 'Broadcast email notification to users'}>
                            <button
                              type="button"
                              onClick={() => openBroadcast(discount)}
                              disabled={!!blocked}
                              aria-label={blocked ? `Broadcast ${discount.code} (unavailable: ${blocked})` : `Broadcast ${discount.code}`}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border border-line hover:border-ink text-ink rounded-lg text-xs font-extrabold transition-[color,background-color,border-color,opacity,box-shadow,transform] ${press} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-line disabled:active:scale-100`}
                            >
                              <Send className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Broadcast</span>
                            </button>
                          </span>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => openDelete(discount)}
                            className={`hit-area p-1.5 text-muted hover:text-danger rounded-lg hover:bg-danger/10 transition-[color,background-color,transform] ${iconPress}`}
                            title="Delete code"
                            aria-label={`Delete code ${discount.code}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </m.tr>
                  );
                })}
                </AnimatePresence>
              </tbody>
            </table>
          </m.div>
        )}
      </m.div>
      </LayoutGroup>

      {/* Broadcast Modal */}
      <Modal isOpen={!!broadcastTarget} onClose={closeBroadcast} title="Broadcast Promo Code" size="md">
        {broadcastTarget && (
          <div className="space-y-4 text-sm">
            <div className="p-4 bg-ink/[0.06] border border-line rounded-chip">
              <div className="flex items-center justify-between">
                <span className="font-mono font-black text-lg text-ink">{broadcastTarget.code}</span>
                <span className="font-extrabold text-sm text-ink">{broadcastTarget.percentageOff}% OFF</span>
              </div>
              <p className="text-xs text-muted mt-1">
                Goes to up to <strong className="text-ink">{audienceCount ?? userCount + subscriberCount}</strong> people: registered customers and discount subscribers, each address once.
              </p>
            </div>

            <AnimatePresence mode="wait" initial={false}>
            {broadcastResult ? (
              <m.div key="result" {...resultIn} className="space-y-4" role="status">
                {broadcastResult.sent !== undefined ? (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[['Sent', broadcastResult.sent], ['Failed', broadcastResult.failed], ['Skipped', broadcastResult.skipped]].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-line bg-raised p-3">
                        <p className={`font-wide font-black text-xl ${label === 'Failed' && value > 0 ? 'text-danger' : 'text-ink'}`}>
                          <CountUp value={value} duration={600} fromZero={false} />
                        </p>
                        <p className="code-label text-[11px] text-muted mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {broadcastResult.message && <p className="text-muted">{broadcastResult.message}</p>}
                <div className="flex justify-end">
                  <Button onClick={closeBroadcast}>Done</Button>
                </div>
              </m.div>
            ) : (
              <m.div key="compose" exit={composeOut} className="space-y-4">
                <div>
                  <label htmlFor="broadcast-message" className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
                    Custom Headline or Note (Optional)
                  </label>
                  <textarea
                    id="broadcast-message"
                    rows="3"
                    maxLength={500}
                    value={customBroadcastMsg}
                    onChange={(e) => setCustomBroadcastMsg(e.target.value)}
                    placeholder="e.g. Grab 20% off all supercars and SUVs this weekend! Book now before vehicles run out."
                    className="w-full bg-raised border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-ink/30"
                  />
                </div>

                {broadcastError && (
                  <p
                    key={broadcastError}
                    role="alert"
                    className={`rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 font-semibold text-danger ${ERROR_IN}`}
                  >
                    {broadcastError}
                  </p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="ghost" onClick={closeBroadcast} disabled={broadcasting}>Cancel</Button>
                  <Button icon={Send} onClick={handleBroadcast} loading={broadcasting} className="font-extrabold">
                    Send Broadcast Now
                  </Button>
                </div>
              </m.div>
            )}
            </AnimatePresence>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title="Delete Promo Code"
        confirmLabel="Delete code"
        cancelLabel="Cancel"
        danger
        loading={deleting}
        error={deleteError}
      >
        <p className="text-muted">
          Delete promo code <span className="font-mono font-bold text-ink">{deleteTarget?.code}</span>? Customers can no longer use it.
          Bookings that already used it keep their discount. To pause a code instead, set it to Inactive.
        </p>
      </ConfirmDialog>
    </div>
  );
}
