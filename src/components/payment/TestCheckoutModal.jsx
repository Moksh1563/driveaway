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
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'framer-motion';
import { X, Smartphone, CreditCard, Landmark, Wallet, Lock, CheckCircle2, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { EASE, SPRING, modalMotion, scrimMotion, viewSwap } from '../../theme/motion';
import useFocusTrap from '../../hooks/useFocusTrap';
import DrawnCheck from '../booking/DrawnCheck';

// Steps and method panels swap with the shared viewSwap; a view that is leaving stops taking clicks
// at once (a second press on a fading Pay or Try again must not pay twice), one that comes back takes them again
const swap = {
  initial: viewSwap.initial,
  animate: { ...viewSwap.animate, pointerEvents: 'auto' },
  exit: (dir) => ({ ...viewSwap.exit(dir), pointerEvents: 'none' }),
};

// Method panels cross-fade in place: the old one drops away fast (ease-out, 120ms) underneath while
// the new one slides in on top from the side the pill travelled to, so the two never read as a jumble
const panelSwap = {
  initial: swap.initial,
  animate: swap.animate,
  exit: (dir) => ({ opacity: 0, x: dir * -8, pointerEvents: 'none', transition: { duration: 0.12, ease: EASE.out } }),
};

// The success lines settle in after the tick has started drawing
const settle = (delay) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, delay, ease: EASE.out } },
});

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
  const [methodDir, setMethodDir] = useState(0); // the method panel slides the way the pill travelled
  const [upiId, setUpiId] = useState(upiFromName(customerName));
  const [bank, setBank] = useState(BANKS[0]);
  const [wallet, setWallet] = useState(WALLETS[0]);
  const [step, setStep] = useState('form'); // form | processing | saving | success | error
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  // The form's height when Pay was pressed: the processing, success and error views keep it, so the
  // checkout holds its size and only its contents dissolve from one step to the next
  const [frame, setFrame] = useState(0);
  const titleId = useId();
  const upiInputId = useId();
  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const retryRef = useRef(null);
  // The error view slides in after the last view has gone, so Try again takes focus as it mounts
  const retryMounted = useCallback((el) => {
    retryRef.current = el;
    el?.focus();
  }, []);
  const timers = useRef([]);
  // Bumped on every open, close and unmount, so a late timer or server reply from an earlier
  // session can never move this one on (or navigate after the page has gone)
  const session = useRef(0);
  // One payment at a time: the form and the error view fade out rather than vanish, so a second press
  // during the fade must do nothing. Set on Pay / Try again, cleared on every open and on a failure.
  const busy = useRef(false);
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
    busy.current = false;
    if (isOpen) {
      setStep('form');
      setReference('');
      setError('');
      setFrame(0);
      setMethodDir(0);
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
      busy.current = false;
      setError(err?.response?.data?.message || 'Your payment could not be completed. Please try again.');
      setStep('error');
    }
  };

  const retry = () => {
    if (busy.current) return;
    busy.current = true;
    record();
  };

  const upiValid = UPI_RE.test(upiId.trim());
  const canPay = method !== 'UPI' || upiValid;

  const pay = (e) => {
    e?.preventDefault();
    if (!canPay || busy.current) return;
    busy.current = true;
    setFrame(formRef.current?.offsetHeight || 0);
    setStep('processing');
    later(record, method === 'UPI' ? 1500 : 1900);
  };

  const chooseMethod = (id) => {
    const from = METHODS.findIndex((x) => x.id === method);
    const to = METHODS.findIndex((x) => x.id === id);
    setMethodDir(Math.sign(to - from));
    setMethod(id);
  };

  // Processing and saving are one view (the spinner keeps turning; only its line changes)
  const view = step === 'saving' ? 'processing' : step;
  const frameStyle = frame ? { minHeight: frame } : undefined;
  const methodIndex = Math.max(0, METHODS.findIndex((x) => x.id === method));

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

              {/* The steps dissolve into each other inside a frame that holds its size */}
              <AnimatePresence mode="wait" initial={false} custom={0}>
              {view === 'form' && (
                <m.form key="form" ref={formRef} custom={0} variants={swap} initial="initial" animate="animate" exit="exit" onSubmit={pay} className="p-6">
                  <div className="grid grid-cols-4 gap-2" role="tablist" aria-label="Payment method">
                    {/* One ink pill that glides to the chosen method's cell, under the tabs. It stays
                        mounted: framer-motion 11 never unregisters a layout element that unmounts inside
                        a presence child, so a pill per tab (mounted only when chosen) would leave this
                        form unable to finish leaving, and the processing view would never appear. */}
                    <m.span
                      layout
                      layoutDependency={method}
                      transition={SPRING}
                      aria-hidden="true"
                      className="pointer-events-none bg-ink"
                      style={{ gridRowStart: 1, gridColumnStart: methodIndex + 1, borderRadius: 12 }}
                    />
                    {METHODS.map(({ id, label, icon: Icon }, i) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={method === id}
                        onClick={() => chooseMethod(id)}
                        style={{ gridRowStart: 1, gridColumnStart: i + 1 }}
                        className={`relative flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors duration-200 ${method === id ? 'border-ink text-ground' : 'border-line hover:border-ink/40'}`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* overflow-y-clip: a taller old panel (net banking) is trimmed to the new height as it fades,
                      instead of fading over the Pay button; sideways it stays free for the slide */}
                  <div className="relative mt-6 min-h-[188px] overflow-y-clip" role="tabpanel">
                    {/* The old method's panel lifts out and fades while the new one slides in from the pill's side */}
                    <AnimatePresence mode="popLayout" initial={false} custom={methodDir}>
                    {/* relative on every panel: the incoming one (later in the DOM) paints over the lifted-out old one */}
                    <m.div key={method} custom={methodDir} variants={panelSwap} initial="initial" animate="animate" exit="exit" className="relative space-y-4">
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
                    </m.div>
                    </AnimatePresence>
                  </div>

                  <button type="submit" disabled={!canPay} className="btn-ink mt-6 w-full !py-4 text-base disabled:opacity-50">
                    Pay {total}
                  </button>
                </m.form>
              )}

              {view === 'processing' && (
                <m.div
                  key="processing"
                  custom={0}
                  variants={swap}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  style={frameStyle}
                  className="grid place-items-center content-center gap-3 px-6 py-16 text-center"
                  role="status"
                >
                  <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                  {/* Processing → confirming: the line fades over, the spinner carries on */}
                  <m.p key={step} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.22, ease: EASE.out } }} className="font-semibold">
                    {step === 'saving' ? 'Confirming your booking…' : processingText}
                  </m.p>
                  <p className="text-sm text-muted">Please don&apos;t close this window.</p>
                </m.div>
              )}

              {view === 'success' && (
                <m.div
                  key="success"
                  custom={0}
                  variants={swap}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  style={frameStyle}
                  className="grid place-items-center content-center gap-3 px-6 py-14 text-center"
                  role="status"
                >
                  {/* The ring draws round, then the tick draws in: no pop, no bounce */}
                  <m.span
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.32, ease: EASE.out }}
                    className="grid h-16 w-16 place-items-center rounded-full bg-[#1E8E4E]/15 text-[#1E8E4E]"
                  >
                    <DrawnCheck circle delay={0.1} className="h-9 w-9" />
                  </m.span>
                  <m.h3 {...settle(0.28)} className="font-wide font-black uppercase tracking-tight text-lg">Payment successful</m.h3>
                  {reference && <m.p {...settle(0.34)} className="font-mono text-xs text-muted">Reference {reference}</m.p>}
                  <m.p {...settle(0.4)} className="text-sm text-muted">Your booking is confirmed.</m.p>
                </m.div>
              )}

              {view === 'error' && (
                <m.div
                  key="error"
                  custom={0}
                  variants={swap}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  style={frameStyle}
                  className="grid place-items-center content-center gap-3 px-6 py-12 text-center"
                  role="alert"
                >
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-danger/10 text-danger">
                    <AlertCircle className="h-8 w-8" aria-hidden="true" />
                  </span>
                  <h3 className="font-wide font-black uppercase tracking-tight text-lg">Payment failed</h3>
                  <p className="max-w-sm text-sm text-muted">{error}</p>
                  <div className="mt-3 flex w-full max-w-sm gap-3">
                    <button type="button" onClick={onClose} className="btn-line flex-1 !py-3.5">Close</button>
                    <button ref={retryMounted} type="button" onClick={retry} className="btn-ink flex-1 !py-3.5">Try again</button>
                  </div>
                </m.div>
              )}
              </AnimatePresence>

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
