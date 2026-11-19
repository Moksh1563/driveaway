/**
 * ============================================================================
 * DISCOUNT NOTIFICATION SUBSCRIBE MODAL
 * ============================================================================
 * Lets site visitors and customers subscribe their email to promo-code alerts:
 * whenever the Driveaway team releases a new promo code, subscribers get it by
 * email. Built on the shared Modal (focus, Escape, scroll lock, exit animation).
 */

import React, { useState, useEffect, useId, useRef } from 'react';
import { Tag, Mail, CheckCircle2, AlertCircle, Loader2, ArrowRight, MailX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import Modal from '../ui/Modal';

export default function DiscountSubscribeModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  // An address that unsubscribed earlier is only re-subscribed after its owner confirms by email
  const [confirmPending, setConfirmPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const emailRef = useRef(null);
  const doneRef = useRef(null);
  const emailId = useId();
  const errorId = useId();

  // Start fresh each time it opens. The account email is read when it opens, not when the
  // Navbar first mounts (that happens before the signed-in user has loaded).
  useEffect(() => {
    if (!isOpen) return;
    setSuccessMsg('');
    setConfirmPending(false);
    setErrorMsg('');
    setEmail((current) => current || user?.email || '');
  }, [isOpen, user?.email]);

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
      const { data } = await api.post('/discount/subscribe', { email });
      setConfirmPending(Boolean(data.confirmationSent));
      setSuccessMsg(data.message || 'You are subscribed to Driveaway promo codes.');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to subscribe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={successMsg ? (confirmPending ? 'Check your inbox' : "You're subscribed") : 'Promo codes by email'}
      initialFocusRef={successMsg ? undefined : emailRef}
    >
      {successMsg ? (
        <div className="text-center py-2 space-y-4" role="status">
          <div className="w-14 h-14 bg-ok/10 text-ok rounded-full flex items-center justify-center mx-auto">
            {confirmPending
              ? <Mail className="w-7 h-7" aria-hidden="true" />
              : <CheckCircle2 className="w-8 h-8" aria-hidden="true" />}
          </div>
          <p className="text-sm text-muted leading-relaxed max-w-sm mx-auto">{successMsg}</p>
          <button ref={doneRef} type="button" onClick={onClose} className="btn-ink w-full">
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-muted leading-relaxed">
            When the Driveaway team releases a new promo code, we email it to you. Enter it at checkout to take the
            discount off your booking.
          </p>

          {/* What subscribing actually does */}
          <ul className="grid gap-px overflow-hidden rounded-chip border border-line bg-line text-sm">
            <li className="flex items-start gap-3 bg-raised p-3.5">
              <Mail className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>An email each time a new promo code is released, with the code and how much it takes off.</span>
            </li>
            <li className="flex items-start gap-3 bg-raised p-3.5">
              <MailX className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>One-click unsubscribe in every email.</span>
            </li>
          </ul>

          {errorMsg && (
            <p id={errorId} role="alert" className="flex items-center gap-2 p-3 bg-danger/10 text-danger text-sm rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div>
              <label htmlFor={emailId} className="field-label">Email address</label>
              <input
                ref={emailRef}
                id={emailId}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-describedby={errorMsg ? errorId : undefined}
                aria-invalid={errorMsg ? true : undefined}
                className="field"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-ink w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Subscribing…
                </>
              ) : (
                <>
                  <Tag className="w-4 h-4" aria-hidden="true" />
                  Email me new promo codes <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>

            <button type="button" onClick={onClose} className="btn-ghost w-full !py-2 text-muted hover:text-ink">
              No thanks
            </button>
          </form>
        </div>
      )}
    </Modal>
  );
}
