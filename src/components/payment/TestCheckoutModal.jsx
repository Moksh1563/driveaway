/**
 * Driveaway checkout. There is no payment gateway behind it: only the chosen method (UPI, CARD,
 * NETBANKING or WALLET) goes to the server, which records the payment and makes its reference.
 * It is styled like a real checkout, but it never asks for a card number, CVV, UPI PIN or OTP, so no
 * real payment credentials can be typed into it. Cards are offered as a saved card for that reason.
 *
 * onPaymentSuccess({ method }) must return a promise: success shows only once it resolves, and a
 * rejection shows the server's message with Try again and Close. onComplete(result) runs after the
 * success screen.
 */
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'framer-motion';
import { X, Smartphone, CreditCard, Landmark, Wallet, Lock, CheckCircle2, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { modalMotion, scrimMotion } from '../../theme/motion';
import useFocusTrap from '../../hooks/useFocusTrap';

const METHODS = [
  { id: 'UPI', label: 'UPI', icon: Smartphone },
  { id: 'CARD', label: 'Card', icon: CreditCard },
  { id: 'NETBANKING', label: 'Net banking', icon: Landmark },
  { id: 'WALLET', label: 'Wallet', icon: Wallet },
];
const SAVED_CARD = { brand: 'VISA', last4: '7316', expiry: '09/29' };
const BANKS = ['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank'];
const WALLETS = ['PhonePe', 'Paytm', 'MobiKwik', 'Amazon Pay'];
const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;

// "Aarav Shah" -> "aarav.shah@upi", to save typing; the customer can change it
const upiFromName = (name) => {
  const handle = String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  return handle ? `${handle}@upi` : '';
};

function Choice({ name, options, value, onChange }) {
  return (
    <div className="grid gap-2" role="radiogroup">
      {options.map((o) => (
        <label
          key={o}
          className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors ${value === o ? 'border-ink font-semibold' : 'border-line hover:border-ink/40'}`}
        >
          {o}
          <input type="radio" name={name} checked={value === o} onChange={() => onChange(o)} className="text-ink focus:ring-0 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface" />
        </label>
      ))}
    </div>
  );
}

export default function TestCheckoutModal({ isOpen, onClose, amount = 0, customerName = '', onPaymentSuccess, onComplete }) {
  const [method, setMethod] = useState('UPI');
  const [upiId, setUpiId] = useState(upiFromName(customerName));
  const [bank, setBank] = useState(BANKS[0]);
  const [wallet, setWallet] = useState(WALLETS[0]);
  const [step, setStep] = useState('form'); // form | processing | saving | success | error
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const titleId = useId();
  const upiInputId = useId();
  const dialogRef = useRef(null);
  const retryRef = useRef(null);
  const timers = useRef([]);
  // Bumped on every open, close and unmount, so a late timer or server reply from an earlier
  // session can never move this one on (or navigate after the page has gone)
  const session = useRef(0);
  const handlers = useRef({ onPaymentSuccess, onComplete, onClose });
  useLayoutEffect(() => {
    handlers.current = { onPaymentSuccess, onComplete, onClose };
  });

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (fn, ms) => {
    const s = session.current;
    timers.current.push(setTimeout(() => { if (session.current === s) fn(); }, ms));
  };

  // A fresh checkout on every open (before paint, so a reopened modal never flashes the last step)
  useLayoutEffect(() => {
    session.current += 1;
    clearTimers();
    if (isOpen) {
      setStep('form');
      setReference('');
      setError('');
    }
  }, [isOpen]);
  useEffect(() => () => {
    session.current += 1;
    clearTimers();
  }, []);

  useEffect(() => { if (customerName) setUpiId((v) => v || upiFromName(customerName)); }, [customerName]);

  // No closing while the payment is processing or being recorded, or once it has succeeded
  const canClose = step === 'form' || step === 'error';
  useFocusTrap(dialogRef, isOpen, { onEscape: canClose ? onClose : undefined });

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Keep focus somewhere sensible as the steps swap their content
  useEffect(() => {
    if (!isOpen) return;
    if (step === 'error') retryRef.current?.focus();
    else if (step !== 'form') dialogRef.current?.focus({ preventScroll: true });
  }, [step, isOpen]);

  const record = async () => {
    const s = session.current;
    setStep('saving');
    try {
      const result = await handlers.current.onPaymentSuccess?.({ method });
      if (session.current !== s) return;
      setReference(result?.paymentId || '');
      setStep('success');
      later(() => (handlers.current.onComplete || handlers.current.onClose)?.(result), 1400);
    } catch (err) {
      if (session.current !== s) return;
      setError(err?.response?.data?.message || 'Your payment could not be completed. Please try again.');
      setStep('error');
    }
  };

  const upiValid = UPI_RE.test(upiId.trim());
  const canPay = method !== 'UPI' || upiValid;

  const pay = (e) => {
    e?.preventDefault();
    if (!canPay) return;
    setStep('processing');
    later(record, method === 'UPI' ? 1500 : 1900);
  };

  const processingText = {
    UPI: 'Processing your UPI payment…',
    CARD: 'Verifying with your bank…',
    NETBANKING: `Connecting to ${bank}…`,
    WALLET: `Connecting to ${wallet}…`,
  }[method];

  const total = `₹${Math.round(amount).toLocaleString('en-IN')}`;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto p-3 sm:p-6">
          <m.div {...scrimMotion} onClick={canClose ? onClose : undefined} className="fixed inset-0 bg-[#0C0C0D]/70" />
          <div className="flex min-h-full items-center justify-center py-4">
            <m.div
              {...modalMotion}
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-[22px] border border-line bg-surface text-ink shadow-lift focus:outline-none"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
                <div>
                  <p className="code-label text-[11px] text-muted">Driveaway</p>
                  <h2 id={titleId} className="font-wide font-black uppercase tracking-tight text-xl">Checkout</h2>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-right">
                    <p className="code-label text-[11px] text-muted">To pay</p>
                    <p className="font-wide font-black text-2xl leading-none">{total}</p>
                  </div>
                  {canClose && (
                    <button type="button" onClick={onClose} aria-label="Close" className="hit-area grid h-10 w-10 place-items-center rounded-full border border-line hover:border-ink transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {step === 'form' && (
                <form onSubmit={pay} className="p-6">
                  <div className="grid grid-cols-4 gap-2" role="tablist" aria-label="Payment method">
                    {METHODS.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={method === id}
                        onClick={() => setMethod(id)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors ${method === id ? 'border-ink bg-ink text-ground' : 'border-line hover:border-ink/40'}`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-6 min-h-[188px] space-y-4" role="tabpanel">
                    {method === 'UPI' && (
                      <>
                        <label htmlFor={upiInputId} className="field-label">UPI ID</label>
                        <input
                          id={upiInputId}
                          className="field font-mono"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          placeholder="yourname@bank"
                          autoComplete="off"
                          spellCheck={false}
                          aria-invalid={upiId.trim() !== '' && !upiValid}
                          aria-describedby={`${upiInputId}-hint`}
                        />
                        <p id={`${upiInputId}-hint`} className={`text-sm ${upiId.trim() !== '' && !upiValid ? 'text-danger' : 'text-muted'}`}>
                          {upiId.trim() !== '' && !upiValid ? 'Enter a UPI ID like yourname@bank.' : 'The UPI ID linked to your bank account.'}
                        </p>
                      </>
                    )}
                    {method === 'CARD' && (
                      <>
                        <span className="field-label">Saved card</span>
                        <div className="flex items-center justify-between rounded-xl border border-ink px-4 py-4">
                          <div className="flex items-center gap-4">
                            <span className="grid h-9 w-14 place-items-center rounded-md bg-ink font-wide text-xs font-black italic tracking-wider text-ground">{SAVED_CARD.brand}</span>
                            <div>
                              <p className="font-mono font-semibold">•••• {SAVED_CARD.last4}</p>
                              <p className="text-sm text-muted">{customerName || 'Cardholder'} · Expires {SAVED_CARD.expiry}</p>
                            </div>
                          </div>
                          <CheckCircle2 className="h-5 w-5" aria-label="Selected" />
                        </div>
                        <p className="text-sm text-muted">Your bank may ask you to confirm this payment.</p>
                      </>
                    )}
                    {method === 'NETBANKING' && <Choice name="bank" options={BANKS} value={bank} onChange={setBank} />}
                    {method === 'WALLET' && <Choice name="wallet" options={WALLETS} value={wallet} onChange={setWallet} />}
                  </div>

                  <button type="submit" disabled={!canPay} className="btn-ink mt-6 w-full !py-4 text-base disabled:opacity-50">
                    Pay {total}
                  </button>
                </form>
              )}

              {(step === 'processing' || step === 'saving') && (
                <div className="grid place-items-center gap-3 px-6 py-16 text-center" role="status">
                  <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                  <p className="font-semibold">{step === 'saving' ? 'Confirming your booking…' : processingText}</p>
                  <p className="text-sm text-muted">Please don&apos;t close this window.</p>
                </div>
              )}

              {step === 'success' && (
                <div className="grid place-items-center gap-3 px-6 py-14 text-center" role="status">
                  <m.span
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
                    className="grid h-16 w-16 place-items-center rounded-full bg-[#1E8E4E]/15 text-[#1E8E4E]"
                  >
                    <CheckCircle2 className="h-9 w-9" />
                  </m.span>
                  <h3 className="font-wide font-black uppercase tracking-tight text-lg">Payment successful</h3>
                  {reference && <p className="font-mono text-xs text-muted">Reference {reference}</p>}
                  <p className="text-sm text-muted">Your booking is confirmed.</p>
                </div>
              )}

              {step === 'error' && (
                <div className="grid place-items-center gap-3 px-6 py-12 text-center" role="alert">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-danger/10 text-danger">
                    <AlertCircle className="h-8 w-8" aria-hidden="true" />
                  </span>
                  <h3 className="font-wide font-black uppercase tracking-tight text-lg">Payment failed</h3>
                  <p className="max-w-sm text-sm text-muted">{error}</p>
                  <div className="mt-3 flex w-full max-w-sm gap-3">
                    <button type="button" onClick={onClose} className="btn-line flex-1 !py-3.5">Close</button>
                    <button ref={retryRef} type="button" onClick={record} className="btn-ink flex-1 !py-3.5">Try again</button>
                  </div>
                </div>
              )}

              <p className="flex items-center gap-2 border-t border-line px-6 py-3 text-xs text-muted">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                Paying Driveaway Luxury Rentals, Ahmedabad
                <ShieldCheck className="ml-auto h-3.5 w-3.5" aria-hidden="true" />
              </p>
            </m.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
