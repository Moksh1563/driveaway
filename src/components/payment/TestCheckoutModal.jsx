/**
 * Driveaway test checkout: a clearly labelled demo of paying online.
 * No money moves and nothing typed here leaves the browser. The card details are fixed test
 * values that cannot be edited, so nobody can enter a real card by mistake.
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Smartphone, CreditCard, Landmark, Wallet, Lock, CheckCircle2, FlaskConical, Loader2 } from 'lucide-react';
import { modalMotion, scrimMotion } from '../../theme/motion';

const METHODS = [
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'netbanking', label: 'Net banking', icon: Landmark },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
];

// Fixed demo values (Visa's public test number); shown read-only on purpose
const TEST_CARD = { number: '4111 1111 1111 1111', expiry: '12/30', cvv: '123' };
const TEST_UPI = 'success@driveaway';
const TEST_OTP = '123456';
const BANKS = ['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank'];
const WALLETS = ['PhonePe', 'Paytm', 'MobiKwik', 'Amazon Pay'];

const newPaymentId = () => `pay_TEST_${Math.random().toString(36).slice(2, 11).toUpperCase()}`;

function Field({ label, value }) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="field flex items-center justify-between bg-ink/5 font-mono" aria-readonly="true">
        {value}
        <Lock className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
      </div>
    </div>
  );
}

function Choice({ name, options, value, onChange }) {
  return (
    <div className="grid gap-2" role="radiogroup">
      {options.map((o) => (
        <label
          key={o}
          className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors ${value === o ? 'border-ink font-semibold' : 'border-line hover:border-ink/40'}`}
        >
          {o}
          <input type="radio" name={name} checked={value === o} onChange={() => onChange(o)} className="text-ink focus:ring-0" />
        </label>
      ))}
    </div>
  );
}

export default function TestCheckoutModal({ isOpen, onClose, amount = 0, customerName = '', onPaymentSuccess }) {
  const [method, setMethod] = useState('upi');
  const [cardName, setCardName] = useState(customerName || 'Test Cardholder');
  const [bank, setBank] = useState(BANKS[0]);
  const [wallet, setWallet] = useState(WALLETS[0]);
  const [step, setStep] = useState('form'); // form | processing | otp | success
  const [otp, setOtp] = useState(TEST_OTP);
  const [paymentId, setPaymentId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setStep('form');
    setOtp(TEST_OTP);
    setPaymentId(newPaymentId());
  }, [isOpen]);

  useEffect(() => { if (customerName) setCardName(customerName); }, [customerName]);

  const canClose = step === 'form' || step === 'otp';
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && canClose) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, canClose, onClose]);

  const succeed = () => {
    setStep('success');
    const data = {
      paymentId,
      paymentMethod: `Online test (${method.toUpperCase()})`,
      amount,
      paidAt: new Date().toISOString(),
    };
    setTimeout(() => onPaymentSuccess(data), 1400);
  };

  const pay = () => {
    setStep('processing');
    setTimeout(() => (method === 'card' || method === 'netbanking' ? setStep('otp') : succeed()), 1200);
  };

  const confirmOtp = (e) => {
    e.preventDefault();
    setStep('processing');
    setTimeout(succeed, 900);
  };

  const total = `₹${Math.round(amount).toLocaleString('en-IN')}`;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="test-checkout-title" className="fixed inset-0 z-[9999] overflow-y-auto p-3 sm:p-6">
          <motion.div {...scrimMotion} onClick={canClose ? onClose : undefined} className="fixed inset-0 bg-[#0C0C0D]/70" />
          <div className="flex min-h-full items-center justify-center py-4">
            <motion.div
              {...modalMotion}
              className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-[22px] border border-line bg-surface text-ink shadow-lift"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
                <div>
                  <p className="code-label text-[11px] text-muted">Driveaway</p>
                  <h2 id="test-checkout-title" className="font-wide font-black uppercase tracking-tight text-xl">Test checkout</h2>
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

              {/* The demo notice: always visible, never dismissable */}
              <div className="flex gap-3 border-b border-line bg-[#F2B705]/15 px-6 py-3 text-sm">
                <FlaskConical className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <p>
                  <strong>Demo only. No real money is charged</strong> and nothing here is sent to a bank. The test details are filled in
                  for you, so never enter a real card or UPI PIN.
                </p>
              </div>

              {step === 'form' && (
                <div className="p-6">
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
                    {method === 'upi' && (
                      <>
                        <Field label="Test UPI ID" value={TEST_UPI} />
                        <p className="text-sm text-muted">The demo approves this payment straight away, the way a UPI app would after you confirm.</p>
                      </>
                    )}
                    {method === 'card' && (
                      <>
                        <Field label="Test card number" value={TEST_CARD.number} />
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Expiry" value={TEST_CARD.expiry} />
                          <Field label="CVV" value={TEST_CARD.cvv} />
                        </div>
                        <label className="block">
                          <span className="field-label">Name on card</span>
                          <input className="field" value={cardName} onChange={(e) => setCardName(e.target.value)} autoComplete="off" />
                        </label>
                      </>
                    )}
                    {method === 'netbanking' && <Choice name="bank" options={BANKS} value={bank} onChange={setBank} />}
                    {method === 'wallet' && <Choice name="wallet" options={WALLETS} value={wallet} onChange={setWallet} />}
                  </div>

                  <button type="button" onClick={pay} className="btn-ink mt-6 w-full !py-4 text-base">
                    Pay {total} (test)
                  </button>
                </div>
              )}

              {step === 'processing' && (
                <div className="grid place-items-center gap-3 px-6 py-16 text-center" role="status">
                  <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                  <p className="font-semibold">Simulating the payment…</p>
                </div>
              )}

              {step === 'otp' && (
                <form onSubmit={confirmOtp} className="mx-auto w-full max-w-sm space-y-4 px-6 py-10 text-center">
                  <h3 className="font-wide font-black uppercase tracking-tight text-lg">Confirm with OTP</h3>
                  <p className="text-sm text-muted">This step copies a bank's one-time password check. The test code is filled in.</p>
                  <label className="block">
                    <span className="sr-only">One-time password</span>
                    <input
                      className="field text-center font-mono text-xl tracking-[0.5em]"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    />
                  </label>
                  <p className="code-label text-[11px] text-muted">Test OTP: {TEST_OTP}</p>
                  <button type="submit" className="btn-ink w-full !py-3.5">Confirm {total} (test)</button>
                </form>
              )}

              {step === 'success' && (
                <div className="grid place-items-center gap-3 px-6 py-14 text-center" role="status">
                  <motion.span
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
                    className="grid h-16 w-16 place-items-center rounded-full bg-[#1E8E4E]/15 text-[#1E8E4E]"
                  >
                    <CheckCircle2 className="h-9 w-9" />
                  </motion.span>
                  <h3 className="font-wide font-black uppercase tracking-tight text-lg">Test payment complete</h3>
                  <p className="font-mono text-xs text-muted">Reference {paymentId}</p>
                  <p className="text-sm text-muted">Taking you to your booking…</p>
                </div>
              )}

              <p className="border-t border-line px-6 py-3 text-xs text-muted">
                Driveaway demo · simulated payment for presentations and testing
              </p>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
