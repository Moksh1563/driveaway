/**
 * ============================================================================
 * DISCOUNT NOTIFICATION SUBSCRIBE MODAL
 * ============================================================================
 * Allows site visitors and customers to subscribe their email for exclusive
 * discount promo codes, festival sales, and special fleet offers.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Tag, Sparkles, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { modalMotion } from '../../theme/motion';

export default function DiscountSubscribeModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || '');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

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
      setSuccessMsg(data.message || 'You have successfully subscribed to exclusive discounts!');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to subscribe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccessMsg('');
    setErrorMsg('');
    onClose();
  };

  const modalContent = (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 p-3 sm:p-6 cursor-pointer"
        onClick={handleClose}
      >
        <div className="flex min-h-full items-center justify-center py-4">
          <motion.div
            {...modalMotion}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md my-auto bg-surface border border-line rounded-[24px] p-5 sm:p-7 shadow-2xl text-ink cursor-default max-h-[calc(100vh-2rem)] overflow-y-auto overflow-x-hidden"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close discount notification modal"
              className="absolute top-3.5 right-3.5 z-30 p-2 text-muted hover:text-ink dark:text-muted rounded-full bg-ink/5 hover:bg-ink/10 transition-[color,background-color,border-color,opacity,box-shadow,transform] shadow-sm focus:outline-none focus:ring-2 focus:ring-ink/30"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Decorative background glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-ink/10 rounded-full blur-2xl pointer-events-none" />

            {successMsg ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black">You're on the VIP List!</h3>
                <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-sm mx-auto">
                  {successMsg}
                </p>
                <div className="pt-2">
                  <button
                    onClick={handleClose}
                    className="w-full bg-ink hover:bg-ink/85 text-ground font-extrabold py-3 rounded-xl transition-[color,background-color,border-color,opacity,box-shadow,transform]"
                  >
                    Awesome, Thanks!
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {/* Header */}
                <div className="text-center space-y-1.5">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-ink/15 text-ink rounded-chip shadow-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight">Never Miss a Discount</h3>
                  <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
                    Be the first to receive secret promo codes, festival specials, and up to 30% OFF our luxury & supercar fleet!
                  </p>
                </div>

                {/* Promo Banner Preview */}
                <div className=" border border-ink/30 rounded-chip p-3 sm:p-3.5 text-center">
                  <div className="text-[11px] uppercase font-extrabold text-ink dark:text-ink tracking-wider">
                    Special Subscriber Perks
                  </div>
                  <div className="text-base font-black text-ink mt-0.5">
                    Up to 25% OFF On Your First Booking
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    Delivered straight to your inbox with zero spam.
                  </div>
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-xl">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-muted mb-1 uppercase tracking-wider">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="w-full bg-raised border border-line rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ink/30 transition-[color,background-color,border-color,opacity,box-shadow,transform]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-ink hover:bg-ink/85 disabled:opacity-50 text-ground font-black text-sm rounded-xl transition-[color,background-color,border-color,opacity,box-shadow,transform] shadow-lg "
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Subscribing...
                      </>
                    ) : (
                      <>
                        <Tag className="w-4 h-4" />
                        Notify Me For Discounts <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full py-1.5 text-center text-xs font-semibold text-muted hover:text-ink dark:text-muted transition-colors"
                  >
                    No thanks, maybe later
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
