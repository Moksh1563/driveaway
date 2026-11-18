/**
 * ============================================================================
 * NOTIFY AVAILABILITY MODAL COMPONENT
 * ============================================================================
 * Provides an interactive modal allowing customers to register their email
 * for an automated notification when a vehicle currently marked as 'Rented'
 * or 'Maintenance' becomes available for booking.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { modalMotion } from '../../theme/motion';

export default function NotifyAvailabilityModal({ car, isOpen, onClose }) {
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

  if (!isOpen || !car) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const { data } = await api.post(`/cars/${car._id}/notify`, { email });
      setSuccessMsg(data.message || `You're all set! We'll email ${email} the moment this car is back in fleet.`);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to register notification alert. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccessMsg('');
    setErrorMsg('');
    onClose();
  };

  const carName = car.name?.toLowerCase().startsWith((car.company || '').toLowerCase()) ? car.name : `${car.company || ''} ${car.name || 'Vehicle'}`.trim();
  const carImage = car.images?.main || (car.images && car.images[0]) || 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800';

  const modalContent = (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9999] overflow-y-auto bg-black/70 p-3 sm:p-6 cursor-pointer"
        onClick={handleClose}
      >
        <div className="flex min-h-full items-center justify-center py-4">
          <motion.div
            {...modalMotion}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md my-auto bg-surface border border-line rounded-[24px] p-5 sm:p-6 shadow-2xl text-ink cursor-default max-h-[calc(100vh-2rem)] overflow-y-auto overflow-x-hidden"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close notify modal"
              className="absolute top-3.5 right-3.5 z-30 p-2 text-muted hover:text-ink dark:text-muted rounded-full bg-ink/5 hover:bg-ink/10 transition-[color,background-color,border-color,opacity,box-shadow,transform] shadow-sm focus:outline-none focus:ring-2 focus:ring-ink/30"
            >
              <X className="w-5 h-5" />
            </button>

          {successMsg ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-ink">Alert Set!</h3>
              <p className="text-sm text-muted leading-relaxed max-w-sm mx-auto">
                {successMsg}
              </p>
              <div className="pt-2">
                <button
                  onClick={handleClose}
                  className="w-full bg-ink hover:bg-ink/85 text-ground font-extrabold py-3 rounded-xl transition-[color,background-color,border-color,opacity,box-shadow,transform]"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-ink/15 text-ink rounded-chip flex items-center justify-center flex-shrink-0">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black">Notify When Available</h3>
                  <p className="text-xs text-muted">Get an instant email alert when back in fleet</p>
                </div>
              </div>

              {/* Car Card Preview */}
              <div className="flex items-center gap-3 p-3 bg-raised border border-line rounded-chip">
                <img
                  src={carImage}
                  alt={carName}
                  className="w-16 h-16 object-cover rounded-xl bg-ink/10 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm text-ink truncate">{carName}</h4>
                  <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                    <span className="text-ink font-extrabold">₹{car.dailyRate?.toLocaleString('en-IN')}/day</span>
                    <span>•</span>
                    <span className="capitalize">{car.transmission}</span>
                  </div>
                  <div className="mt-1 inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-ink/10 text-ink dark:text-ink">
                    Status: {car.status}
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-xl">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
                    Your Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. yourname@gmail.com"
                    className="w-full bg-raised border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ink/30 transition-[color,background-color,border-color,opacity,box-shadow,transform]"
                  />
                  <p className="text-[11px] text-muted mt-1">
                    We will send a one-time email with a direct booking link as soon as this car is available.
                  </p>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 py-3 bg-ink/5 hover:bg-ink/10 text-muted font-bold text-sm rounded-xl transition-[color,background-color,border-color,opacity,box-shadow,transform]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-ink hover:bg-ink/85 disabled:opacity-50 text-ground font-extrabold text-sm rounded-xl transition-[color,background-color,border-color,opacity,box-shadow,transform] shadow-lg "
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Setting Alert...
                      </>
                    ) : (
                      <>
                        <Bell className="w-4 h-4" />
                        Notify Me
                      </>
                    )}
                  </button>
                </div>
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
