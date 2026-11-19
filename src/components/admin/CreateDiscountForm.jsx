import React, { useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Send, Plus, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Button from '../ui/Button';
import { panelMotion } from '../../theme/motion';
import { ERROR_IN } from '../booking/FieldError';
import { todayIST, endOfDayIST, readBroadcastResult, broadcastSummary } from './discountRules';

const EMPTY_FORM = {
  code: '',
  percentageOff: '',
  maxDiscount: '',
  minAmount: '',
  maxUses: '',
  maxUsesPerUser: '',
  expiresAt: '',
  isActive: true,
  notifyUsers: false,
  customMessage: '',
};

const inputClass = 'w-full bg-raised border border-line rounded-xl px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/30 placeholder:text-muted/70';
const labelClass = 'block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider';

function validate(form) {
  const errors = {};
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(form.code.trim())) errors.code = 'Use 3-20 letters, numbers, - or _.';
  const pct = Number(form.percentageOff);
  if (form.percentageOff === '' || !Number.isFinite(pct) || pct < 1 || pct > 90) errors.percentageOff = 'Enter a percentage from 1 to 90.';
  if (form.maxDiscount !== '' && (!Number.isFinite(Number(form.maxDiscount)) || Number(form.maxDiscount) <= 0)) errors.maxDiscount = 'Enter an amount above ₹0, or leave it empty.';
  if (form.minAmount !== '' && (!Number.isFinite(Number(form.minAmount)) || Number(form.minAmount) < 0)) errors.minAmount = 'Enter ₹0 or more, or leave it empty.';
  ['maxUses', 'maxUsesPerUser'].forEach((k) => {
    if (form[k] !== '' && (!Number.isInteger(Number(form[k])) || Number(form[k]) < 1)) errors[k] = 'Enter a whole number of 1 or more, or leave it empty.';
  });
  if (form.maxUses !== '' && form.maxUsesPerUser !== '' && !errors.maxUses && !errors.maxUsesPerUser && Number(form.maxUsesPerUser) > Number(form.maxUses)) {
    errors.maxUsesPerUser = 'Cannot be more than the total uses.';
  }
  if (form.expiresAt && form.expiresAt < todayIST()) errors.expiresAt = 'Pick today or a later date.';
  return errors;
}

/**
 * Admin form for a new promo code: percentage, optional cap, minimum booking amount, usage limits
 * and expiry, with an optional immediate email broadcast.
 */
export default function CreateDiscountForm({ onCreated, onRefresh, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error(Object.values(found)[0]);
      return;
    }

    // Empty optional fields are left out, so the server applies its defaults (no cap, no limit, no expiry)
    const payload = {
      code: form.code.trim().toUpperCase(),
      percentageOff: Number(form.percentageOff),
      isActive: form.isActive,
      notifyUsers: form.notifyUsers,
    };
    if (form.maxDiscount !== '') payload.maxDiscount = Number(form.maxDiscount);
    if (form.minAmount !== '') payload.minAmount = Number(form.minAmount);
    if (form.maxUses !== '') payload.maxUses = Number(form.maxUses);
    if (form.maxUsesPerUser !== '') payload.maxUsesPerUser = Number(form.maxUsesPerUser);
    if (form.expiresAt) payload.expiresAt = endOfDayIST(form.expiresAt);
    if (form.notifyUsers && form.customMessage.trim()) payload.customMessage = form.customMessage.trim();

    setSaving(true);
    try {
      const { data } = await api.post('/discount', payload);
      toast.success(data?.message || 'Promo code created successfully!');
      // Only a create that also broadcast carries a { sent, failed, skipped } result
      const summary = form.notifyUsers ? broadcastSummary(readBroadcastResult(data)) : '';
      if (summary) toast(`Broadcast: ${summary}`);
      setForm(EMPTY_FORM);
      onCreated?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error creating promo code.');
      // The code may have been saved even if the broadcast step failed (e.g. email not set up)
      onRefresh?.();
    } finally {
      setSaving(false);
    }
  };

  const fieldProps = (key) => ({
    id: `discount-${key}`,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': [errors[key] ? `discount-${key}-error` : '', `discount-${key}-hint`].filter(Boolean).join(' ') || undefined,
  });
  const fieldError = (key) => (errors[key] ? <p key={errors[key]} id={`discount-${key}-error`} className={`mt-1 text-xs font-semibold text-danger ${ERROR_IN}`}>{errors[key]}</p> : null);
  // A field's error drops in under it (CSS ERROR_IN, visible by default); a new message replays it
  const hint = (key, text) => <p id={`discount-${key}-hint`} className="mt-1 text-[11px] text-muted">{text}</p>;

  // The panel opens in place under the page header (panelMotion) and the list below glides to make
  // room. `layout="position"` never moves the panel itself; it tells the list (same LayoutGroup on the
  // page) to glide whenever the panel grows or shrinks, e.g. when the message field opens.
  return (
    <m.div {...panelMotion} layout="position" className="bg-surface border border-line rounded-chip p-6 shadow-sm overflow-hidden">
      <h2 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-ink" aria-hidden="true" />
        Create & Broadcast New Discount Code
      </h2>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="discount-code" className={labelClass}>Promo Code *</label>
            <input
              {...fieldProps('code')}
              type="text"
              required
              maxLength={20}
              autoComplete="off"
              placeholder="e.g. FESTIVE20"
              value={form.code}
              onChange={(e) => setField('code', e.target.value.toUpperCase())}
              className={`${inputClass} uppercase font-mono font-bold`}
            />
            {fieldError('code')}
            {hint('code', '3-20 letters, numbers, - or _.')}
          </div>

          <div>
            <label htmlFor="discount-percentageOff" className={labelClass}>Discount Percentage (%) *</label>
            <input
              {...fieldProps('percentageOff')}
              type="number"
              required
              min="1"
              max="90"
              inputMode="numeric"
              placeholder="e.g. 20"
              value={form.percentageOff}
              onChange={(e) => setField('percentageOff', e.target.value)}
              className={inputClass}
            />
            {fieldError('percentageOff')}
            {hint('percentageOff', 'From 1 to 90.')}
          </div>

          <div>
            <label htmlFor="discount-maxDiscount" className={labelClass}>Max Discount (₹, Optional)</label>
            <input
              {...fieldProps('maxDiscount')}
              type="number"
              min="1"
              inputMode="numeric"
              placeholder="e.g. 3000"
              value={form.maxDiscount}
              onChange={(e) => setField('maxDiscount', e.target.value)}
              className={inputClass}
            />
            {fieldError('maxDiscount')}
            {hint('maxDiscount', 'No cap if empty.')}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="discount-minAmount" className={labelClass}>Minimum Booking (₹)</label>
            <input
              {...fieldProps('minAmount')}
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="e.g. 5000"
              value={form.minAmount}
              onChange={(e) => setField('minAmount', e.target.value)}
              className={inputClass}
            />
            {fieldError('minAmount')}
            {hint('minAmount', 'Booking subtotal needed. Any amount if empty.')}
          </div>

          <div>
            <label htmlFor="discount-maxUses" className={labelClass}>Total Uses</label>
            <input
              {...fieldProps('maxUses')}
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="e.g. 100"
              value={form.maxUses}
              onChange={(e) => setField('maxUses', e.target.value)}
              className={inputClass}
            />
            {fieldError('maxUses')}
            {hint('maxUses', 'Across all customers. Unlimited if empty.')}
          </div>

          <div>
            <label htmlFor="discount-maxUsesPerUser" className={labelClass}>Uses Per Customer</label>
            <input
              {...fieldProps('maxUsesPerUser')}
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="e.g. 1"
              value={form.maxUsesPerUser}
              onChange={(e) => setField('maxUsesPerUser', e.target.value)}
              className={inputClass}
            />
            {fieldError('maxUsesPerUser')}
            {hint('maxUsesPerUser', 'Unlimited if empty.')}
          </div>

          <div>
            <label htmlFor="discount-expiresAt" className={labelClass}>Last Valid Day</label>
            <input
              {...fieldProps('expiresAt')}
              type="date"
              min={todayIST()}
              value={form.expiresAt}
              onChange={(e) => setField('expiresAt', e.target.value)}
              className={inputClass}
            />
            {fieldError('expiresAt')}
            {hint('expiresAt', 'Works until the end of this day (India time). No expiry if empty.')}
          </div>
        </div>

        {/* Broadcast Checkbox */}
        <div className="p-4 bg-ink/[0.06] border border-line rounded-xl space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.notifyUsers}
              onChange={(e) => setField('notifyUsers', e.target.checked)}
              className="w-4 h-4 text-ink rounded border-line focus:ring-ink/30 cursor-pointer"
            />
            <span>
              <span className="text-sm font-bold text-ink flex items-center gap-1.5">
                <Send className="w-4 h-4 text-ink" aria-hidden="true" />
                Broadcast to all users & subscribers immediately via email
              </span>
              <span className="block text-xs text-muted mt-0.5">
                Sends an announcement email to registered customers and discount subscribers once the code is saved.
              </span>
            </span>
          </label>

          {/* Ticking the box opens the message field in place; unticking closes it, faster */}
          <AnimatePresence initial={false}>
          {form.notifyUsers && (
            <m.div key="custom-message" {...panelMotion}>
              <label htmlFor="discount-customMessage" className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">
                Custom Email Announcement Message (Optional)
              </label>
              <textarea
                id="discount-customMessage"
                rows="2"
                maxLength={500}
                placeholder="e.g. Special weekend offer! Rent your favourite hypercar or SUV and enjoy 20% off."
                value={form.customMessage}
                onChange={(e) => setField('customMessage', e.target.value)}
                className={`${inputClass} py-2`}
              />
            </m.div>
          )}
          </AnimatePresence>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit" icon={Plus} loading={saving} className="font-extrabold">Save Promo Code</Button>
        </div>
      </form>
    </m.div>
  );
}
