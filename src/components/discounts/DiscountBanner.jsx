/**
 * ============================================================================
 * DISCOUNT BANNER COMPONENT
 * ============================================================================
 * An inline interactive banner featured on the HomePage and promotion areas
 * to encourage users to subscribe for instant discount notifications.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, Sparkles, CheckCircle2, AlertCircle, Loader2, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

export default function DiscountBanner() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || '');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const { data } = await api.post('/discount/subscribe', { email });
      setSuccessMsg(data.message || "You're subscribed! We'll email you exclusive discount codes.");
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to subscribe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden border border-ink/30 rounded-[24px] p-8 sm:p-12 shadow-xl">
      {/* Dismiss / Close Banner Button */}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        title="Dismiss discount notification"
        aria-label="Dismiss discount notification"
        className="absolute top-4 right-4 z-20 p-2 text-muted hover:text-ink dark:text-muted rounded-full bg-black/5 hover:bg-black/10 transition-all focus:outline-none focus:ring-2 focus:ring-ink/30"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="absolute -top-12 -right-12 w-48 h-48 bg-ink/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-ink/20 border border-ink/30 text-ink dark:text-ink px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Exclusive Driver Perks
        </div>

        <h2 className="text-3xl sm:text-4xl font-black text-ink">
          Get Instant Discount Notifications & Promo Codes
        </h2>

        <p className="text-sm sm:text-base text-muted max-w-xl mx-auto leading-relaxed">
          Subscribe with your email to receive flash deals, festival offers, and secret coupon codes for up to 30% off across Ahmedabad!
        </p>

        {successMsg ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-3 p-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-chip max-w-md mx-auto text-sm font-bold"
          >
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="flex-1 bg-raised border border-line rounded-chip px-5 py-3.5 text-sm text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ink/30 shadow-sm"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 bg-ink hover:bg-ink/85 disabled:opacity-50 text-ground font-extrabold text-sm px-6 py-3.5 rounded-chip transition-all shadow-lg flex-shrink-0"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Tag className="w-4 h-4" />
                    Subscribe
                  </>
                )}
              </button>
            </div>

            {errorMsg && (
              <div className="flex items-center justify-center gap-2 text-xs text-red-600 dark:text-red-400 pt-1">
                <AlertCircle className="w-4 h-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            <p className="text-[11px] text-muted">
              No spam ever. We only email you verified promo codes and discount announcements.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
