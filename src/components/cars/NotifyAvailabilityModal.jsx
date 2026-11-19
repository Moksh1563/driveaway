/**
 * ============================================================================
 * NOTIFY AVAILABILITY MODAL COMPONENT
 * ============================================================================
 * Provides an interactive modal allowing customers to register their email
 * for an automated notification when a vehicle that is booked right now or
 * in maintenance becomes available for booking. Built on the shared Modal,
 * so focus, Escape, scroll lock and the exit animation behave like every
 * other dialog.
 */

import React, { useState, useEffect, useId, useRef } from 'react';
import { Bell, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import Modal from '../ui/Modal';
import { carTitle } from '../../theme/paints';
import { sizedImage, handleImageError } from '../../utils/image';

const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

/** Plain-words status for the preview card ("Booked until 12 Dec", "In maintenance"). */
const statusText = (car) => {
  if (car.status === 'Maintenance') return 'In maintenance';
  if (car.status === 'Rented') return car.nextFreeDate ? `Booked until ${shortDate(car.nextFreeDate)}` : 'Booked right now';
  return car.status;
};

export default function NotifyAvailabilityModal({ car, isOpen, onClose }) {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const emailRef = useRef(null);
  const doneRef = useRef(null);
  const emailId = useId();
  const hintId = useId();
  const errorId = useId();

  // Start fresh each time it opens, and pre-fill the account email (the user may have
  // signed in after this component first mounted)
  useEffect(() => {
    if (!isOpen) return;
    setSuccessMsg('');
    setErrorMsg('');
    setEmail((current) => current || user?.email || '');
  }, [isOpen, user?.email]);

  // The form (and the focused button) is replaced by the confirmation: keep focus in the dialog
  useEffect(() => {
    if (successMsg) doneRef.current?.focus();
  }, [successMsg]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      emailRef.current?.focus();
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const { data } = await api.post(`/cars/${car._id}/notify`, { email });
      setSuccessMsg(data.message || `You're all set. We'll email ${email} as soon as this car can be booked.`);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to register notification alert. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const name = car ? carTitle(car) || 'This car' : '';

  return (
    <Modal
      isOpen={isOpen && Boolean(car)}
      onClose={onClose}
      title={successMsg ? 'Alert set' : 'Notify me when free'}
      initialFocusRef={successMsg ? undefined : emailRef}
    >
      {car && (successMsg ? (
        // The confirmation comes into focus in place of the form
        <div className="text-center py-2 space-y-4 focus-in" style={{ '--rise': '10px' }} role="status">
          <div className="w-16 h-16 bg-ok/10 text-ok rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
          </div>
          <p className="text-sm text-muted leading-relaxed max-w-sm mx-auto">{successMsg}</p>
          <button ref={doneRef} type="button" onClick={onClose} className="btn-ink w-full">
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="flex items-start gap-3 text-sm text-muted">
            <Bell className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink" aria-hidden="true" />
            We will send one email with a booking link as soon as this car can be booked.
          </p>

          {/* Car preview */}
          <div className="flex items-center gap-3 p-3 bg-raised border border-line rounded-chip">
            <img
              src={sizedImage(car.images?.main, 250)}
              alt=""
              width="64"
              height="64"
              onError={(e) => handleImageError(e, 250)}
              className="w-16 h-16 object-cover rounded-xl bg-ink/10 flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-ink truncate">{name}</p>
              <p className="flex items-center gap-2 text-xs text-muted mt-0.5">
                <span className="text-ink font-extrabold">₹{car.dailyRate?.toLocaleString('en-IN')}/day</span>
                <span aria-hidden="true">·</span>
                <span className="capitalize">{car.transmission}</span>
              </p>
              <p className="mt-1.5 inline-flex items-center rounded-full bg-ink/[0.06] px-2.5 py-0.5 code-label text-[11px] text-muted">
                {statusText(car)}
              </p>
            </div>
          </div>

          {errorMsg && (
            <p id={errorId} role="alert" className="step-in flex items-center gap-2 p-3 bg-danger/10 text-danger text-sm rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor={emailId} className="field-label">Your email address</label>
              <input
                ref={emailRef}
                id={emailId}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-describedby={errorMsg ? `${hintId} ${errorId}` : hintId}
                aria-invalid={errorMsg ? true : undefined}
                className="field"
              />
              <p id={hintId} className="text-xs text-muted mt-1.5">
                We only use it for this alert.
              </p>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-line flex-1">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-ink flex-1">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Setting alert…
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4" aria-hidden="true" />
                    Notify me
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ))}
    </Modal>
  );
}
