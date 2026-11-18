/**
 * ============================================================================
 * RAZORPAY DUPE PAYMENT GATEWAY MODAL
 * ============================================================================
 * Simulates the genuine Razorpay checkout modal for test and development.
 * Supports:
 *  - UPI QR code and instant VPA verification (Google Pay, PhonePe, Paytm)
 *  - Credit / Debit Cards with simulated CVV & 3D Secure OTP flow
 *  - Netbanking across major Indian banks (HDFC, SBI, ICICI, Axis, Kotak)
 *  - Popular Mobile Wallets
 *  - Auto-generated payment transaction IDs (e.g. `pay_RZP_...`)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ShieldCheck, CheckCircle2, Loader2, QrCode, Smartphone, 
  CreditCard, Landmark, Wallet, ArrowRight, Lock, Sparkles
} from 'lucide-react';


const POPULAR_BANKS = [
  { id: 'HDFC', name: 'HDFC Bank', code: 'HDFC' },
  { id: 'SBI', name: 'State Bank of India', code: 'SBIN' },
  { id: 'ICICI', name: 'ICICI Bank', code: 'ICIC' },
  { id: 'AXIS', name: 'Axis Bank', code: 'UTIB' },
  { id: 'KOTAK', name: 'Kotak Mahindra', code: 'KKBK' },
];

const POPULAR_WALLETS = [
  { id: 'phonepe', name: 'PhonePe Wallet' },
  { id: 'paytm', name: 'Paytm Wallet' },
  { id: 'mobikwik', name: 'MobiKwik' },
  { id: 'amazon', name: 'Amazon Pay' },
];

export default function RazorpayModal({
  isOpen,
  onClose,
  amount = 0,
  customerName = '',
  customerEmail = '',
  customerPhone = '',
  onPaymentSuccess,
}) {
  const [activeTab, setActiveTab] = useState('upi'); // upi | card | netbanking | wallet
  const [upiMode, setUpiMode] = useState('qr'); // qr | vpa
  const [vpa, setVpa] = useState('customer@okhdfcbank');
  
  // Card state
  const [cardNumber, setCardNumber] = useState('4111 2222 3333 4444');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');
  const [cardName, setCardName] = useState(customerName || 'Test Cardholder');

  // Netbanking & Wallet state
  const [selectedBank, setSelectedBank] = useState('HDFC');
  const [selectedWallet, setSelectedWallet] = useState('phonepe');

  // Simulation steps: 'form' | 'processing' | 'otp' | 'success'
  const [step, setStep] = useState('form');
  const [otp, setOtp] = useState('458921');
  const [paymentId, setPaymentId] = useState('');

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setPaymentId(`pay_RZP_${Math.random().toString(36).substring(2, 11).toUpperCase()}`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePay = () => {
    setStep('processing');

    // Simulate gateway handoff
    setTimeout(() => {
      if (activeTab === 'card' || activeTab === 'netbanking') {
        setStep('otp'); // Bank 3D secure OTP simulation
      } else {
        handleSuccess();
      }
    }, 1500);
  };

  const handleOtpSubmit = (e) => {
    e?.preventDefault();
    setStep('processing');
    setTimeout(() => {
      handleSuccess();
    }, 1200);
  };

  const handleSuccess = () => {
    setStep('success');
    const paymentData = {
      paymentId,
      paymentMethod: `Razorpay (${activeTab.toUpperCase()})`,
      amount,
      paidAt: new Date().toISOString(),
    };

    setTimeout(() => {
      onPaymentSuccess(paymentData);
    }, 1800);
  };

  const formattedAmount = Math.round(amount).toLocaleString('en-IN');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 ">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-xl bg-raised text-ink rounded-chip shadow-2xl overflow-hidden border border-line flex flex-col max-h-[92vh]"
        >
          {/* ── RAZORPAY HEADER ────────────────────────────────────── */}
          <div className="bg-[#0c2340] text-white p-4 sm:p-5 flex items-center justify-between relative select-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl from-[#0b72e7] to-[#3395ff] flex items-center justify-center shadow-md">
                {/* Razorpay Emblem */}
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.976 2L6 14.5h6l-1.976 7.5L18 9.5h-6l1.976-7.5z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold tracking-tight text-base sm:text-lg">Razorpay</span>
                  <span className="text-[10px] bg-blue-500/30 text-blue-300 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Test Mode
                  </span>
                </div>
                <p className="text-gray-300 text-xs">Driveaway Pvt Ltd • Ahmedabad</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Total Payable</span>
                <span className="text-xl sm:text-2xl font-black text-white">₹{formattedAmount}</span>
              </div>
              {step !== 'processing' && step !== 'success' && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* ── SECURITY BADGE STRIP ───────────────────────────────── */}
          <div className="bg-[#f2f7fc] px-4 py-1.5 border-b border-blue-100 flex items-center justify-between text-[11px] text-[#0c2340]">
            <span className="flex items-center gap-1 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0b72e7]" />
              Razorpay Trusted Business
            </span>
            <span className="text-muted hidden sm:inline">100% Safe 256-bit SSL Encrypted</span>
          </div>

          {/* ── CONTENT AREA ───────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            {step === 'form' && (
              <div className="grid grid-cols-1 sm:grid-cols-12 min-h-[340px]">
                {/* Left Sidebar Tabs */}
                <div className="sm:col-span-5 bg-ground border-r border-line p-2 sm:p-3 space-y-1">
                  <p className="text-[11px] font-bold text-muted uppercase px-3 py-1">Payment Methods</p>

                  <button
                    type="button"
                    onClick={() => setActiveTab('upi')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
 activeTab === 'upi'
 ? 'bg-[#0b72e7] text-white shadow-sm'
 : 'text-muted hover:bg-ink/10/60'
 }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Smartphone className="w-4 h-4" />
                      UPI (GPay, PhonePe)
                    </span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${activeTab === 'upi' ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>
                      FASTEST
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('card')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
 activeTab === 'card'
 ? 'bg-[#0b72e7] text-white shadow-sm'
 : 'text-muted hover:bg-ink/10/60'
 }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Cards (Credit / Debit)
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('netbanking')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
 activeTab === 'netbanking'
 ? 'bg-[#0b72e7] text-white shadow-sm'
 : 'text-muted hover:bg-ink/10/60'
 }`}
                  >
                    <Landmark className="w-4 h-4" />
                    Netbanking (All Banks)
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('wallet')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
 activeTab === 'wallet'
 ? 'bg-[#0b72e7] text-white shadow-sm'
 : 'text-muted hover:bg-ink/10/60'
 }`}
                  >
                    <Wallet className="w-4 h-4" />
                    Wallets (Paytm, etc.)
                  </button>
                </div>

                {/* Right Tab Content */}
                <div className="sm:col-span-7 p-4 sm:p-5 flex flex-col justify-between">
                  {/* UPI TAB */}
                  {activeTab === 'upi' && (
                    <div className="space-y-4">
                      <div className="flex border-b border-line pb-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setUpiMode('qr')}
                          className={`text-xs font-bold pb-1 transition-all ${
 upiMode === 'qr'
 ? 'text-[#0b72e7] border-b-2 border-[#0b72e7]'
 : 'text-muted hover:text-ink'
 }`}
                        >
                          Scan QR Code
                        </button>
                        <button
                          type="button"
                          onClick={() => setUpiMode('vpa')}
                          className={`text-xs font-bold pb-1 transition-all ${
 upiMode === 'vpa'
 ? 'text-[#0b72e7] border-b-2 border-[#0b72e7]'
 : 'text-muted hover:text-ink'
 }`}
                        >
                          Enter UPI ID
                        </button>
                      </div>

                      {upiMode === 'qr' ? (
                        <div className="text-center py-2 space-y-3">
                          <div className="inline-block p-3 bg-raised border-2 border-line rounded-xl shadow-inner relative group">
                            {/* Realistic Simulated QR Code */}
                            <svg className="w-36 h-36 mx-auto text-ink" viewBox="0 0 100 100" fill="currentColor">
                              {/* QR Finder patterns */}
                              <rect x="5" y="5" width="25" height="25" fill="#0c2340" />
                              <rect x="9" y="9" width="17" height="17" fill="white" />
                              <rect x="13" y="13" width="9" height="9" fill="#0c2340" />

                              <rect x="70" y="5" width="25" height="25" fill="#0c2340" />
                              <rect x="74" y="9" width="17" height="17" fill="white" />
                              <rect x="78" y="13" width="9" height="9" fill="#0c2340" />

                              <rect x="5" y="70" width="25" height="25" fill="#0c2340" />
                              <rect x="9" y="74" width="17" height="17" fill="white" />
                              <rect x="13" y="78" width="9" height="9" fill="#0c2340" />

                              {/* Matrix noise */}
                              <rect x="35" y="10" width="8" height="8" fill="#0b72e7" />
                              <rect x="47" y="15" width="6" height="6" fill="#0c2340" />
                              <rect x="57" y="10" width="8" height="6" fill="#0b72e7" />
                              <rect x="35" y="35" width="30" height="30" rx="4" fill="#0c2340" />
                              <rect x="42" y="42" width="16" height="16" fill="white" />
                              <rect x="46" y="46" width="8" height="8" fill="#0b72e7" />
                              <rect x="70" y="40" width="10" height="6" fill="#0c2340" />
                              <rect x="85" y="50" width="10" height="12" fill="#0b72e7" />
                              <rect x="15" y="45" width="12" height="8" fill="#0c2340" />
                              <rect x="40" y="75" width="18" height="8" fill="#0b72e7" />
                              <rect x="65" y="75" width="15" height="15" fill="#0c2340" />
                              <rect x="85" y="80" width="10" height="10" fill="#0b72e7" />
                            </svg>
                            <span className="text-[10px] text-muted mt-1 block font-mono">Scan with any UPI App</span>
                          </div>

                          <div className="flex items-center justify-center gap-2 text-[11px] text-muted font-semibold">
                            <span className="bg-ink/5 px-2 py-0.5 rounded">GPay</span>
                            <span className="bg-ink/5 px-2 py-0.5 rounded">PhonePe</span>
                            <span className="bg-ink/5 px-2 py-0.5 rounded">Paytm</span>
                            <span className="bg-ink/5 px-2 py-0.5 rounded">BHIM</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 py-2">
                          <div>
                            <label className="block text-xs font-bold text-muted mb-1">Enter Virtual Payment Address (VPA)</label>
                            <input
                              type="text"
                              value={vpa}
                              onChange={(e) => setVpa(e.target.value)}
                              placeholder="e.g. mobile@upi"
                              className="w-full px-3 py-2 text-xs border border-line rounded-lg focus:ring-2 focus:ring-[#0b72e7] outline-none"
                            />
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {['@okhdfcbank', '@ybl', '@paytm', '@okaxis'].map((handle) => (
                              <button
                                key={handle}
                                type="button"
                                onClick={() => setVpa(`driveuser${handle}`)}
                                className="text-[10px] bg-ink/5 hover:bg-ink/10 text-muted px-2 py-1 rounded transition-colors"
                              >
                                {handle}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CARDS TAB */}
                  {activeTab === 'card' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-muted mb-1">Card Number</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            placeholder="4111 2222 3333 4444"
                            className="w-full pl-3 pr-12 py-2 text-xs font-mono border border-line rounded-lg focus:ring-2 focus:ring-[#0b72e7] outline-none"
                          />
                          <span className="absolute right-2.5 top-2 text-[10px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            VISA
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-muted mb-1">Expiry Date</label>
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="MM/YY"
                            className="w-full px-3 py-2 text-xs font-mono border border-line rounded-lg focus:ring-2 focus:ring-[#0b72e7] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted mb-1">CVV</label>
                          <input
                            type="password"
                            maxLength="3"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            placeholder="•••"
                            className="w-full px-3 py-2 text-xs font-mono border border-line rounded-lg focus:ring-2 focus:ring-[#0b72e7] outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-muted mb-1">Cardholder Name</label>
                        <input
                          type="text"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          placeholder="Name as on card"
                          className="w-full px-3 py-2 text-xs border border-line rounded-lg focus:ring-2 focus:ring-[#0b72e7] outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        <input type="checkbox" id="saveCard" defaultChecked className="rounded text-[#0b72e7] focus:ring-0" />
                        <label htmlFor="saveCard" className="text-[11px] text-muted">
                          Securely save card as per RBI guidelines
                        </label>
                      </div>
                    </div>
                  )}

                  {/* NETBANKING TAB */}
                  {activeTab === 'netbanking' && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-muted">Select Bank</p>
                      <div className="grid grid-cols-1 gap-2">
                        {POPULAR_BANKS.map((b) => (
                          <label
                            key={b.id}
                            className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer text-xs font-semibold transition-all ${
 selectedBank === b.id
 ? 'border-[#0b72e7] bg-blue-50/50 text-[#0c2340]'
 : 'border-line hover:bg-ground text-muted'
 }`}
                          >
                            <span className="flex items-center gap-2">
                              <Landmark className="w-3.5 h-3.5 text-muted" />
                              {b.name}
                            </span>
                            <input
                              type="radio"
                              name="bank"
                              checked={selectedBank === b.id}
                              onChange={() => setSelectedBank(b.id)}
                              className="text-[#0b72e7] focus:ring-0"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* WALLETS TAB */}
                  {activeTab === 'wallet' && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-muted">Select Wallet</p>
                      <div className="grid grid-cols-1 gap-2">
                        {POPULAR_WALLETS.map((w) => (
                          <label
                            key={w.id}
                            className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer text-xs font-semibold transition-all ${
 selectedWallet === w.id
 ? 'border-[#0b72e7] bg-blue-50/50 text-[#0c2340]'
 : 'border-line hover:bg-ground text-muted'
 }`}
                          >
                            <span className="flex items-center gap-2">
                              <Wallet className="w-3.5 h-3.5 text-muted" />
                              {w.name}
                            </span>
                            <input
                              type="radio"
                              name="wallet"
                              checked={selectedWallet === w.id}
                              onChange={() => setSelectedWallet(w.id)}
                              className="text-[#0b72e7] focus:ring-0"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Primary Pay Button */}
                  <div className="pt-4 mt-auto">
                    <button
                      type="button"
                      onClick={handlePay}
                      className="w-full py-3 px-4 bg-[#0b72e7] hover:bg-[#0960c5] active:scale-[0.99] text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
                    >
                      <Lock className="w-4 h-4" />
                      Pay ₹{formattedAmount}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PROCESSING STATE */}
            {step === 'processing' && (
              <div className="py-16 px-6 text-center space-y-4">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-[#0b72e7] border-t-transparent animate-spin"></div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-ink">Processing Payment...</h3>
                  <p className="text-xs text-muted">Contacting banking gateway and confirming token...</p>
                  <p className="text-[11px] text-ink font-medium">Please do not refresh or close this window.</p>
                </div>
              </div>
            )}

            {/* OTP SIMULATION STATE */}
            {step === 'otp' && (
              <form onSubmit={handleOtpSubmit} className="py-8 px-6 max-w-sm mx-auto text-center space-y-4">
                <div className="w-12 h-12 bg-blue-50 text-[#0b72e7] rounded-full flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-ink">Simulated Bank 3D-Secure OTP</h3>
                  <p className="text-xs text-muted mt-1">
                    Enter the mock OTP sent to registered number ending in •••• 3210
                  </p>
                </div>

                <div className="my-2">
                  <input
                    type="text"
                    maxLength="6"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-44 text-center tracking-[0.5em] text-xl font-bold py-2 border-2 border-[#0b72e7] rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <p className="text-[10px] text-muted mt-1 font-mono">Default Mock OTP: 458921</p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-[#0b72e7] hover:bg-[#0960c5] text-white rounded-xl font-bold text-xs shadow-md transition-all"
                >
                  Confirm & Authorize ₹{formattedAmount}
                </button>
              </form>
            )}

            {/* SUCCESS STATE */}
            {step === 'success' && (
              <div className="py-14 px-6 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 15 }}
                  className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-sm"
                >
                  <CheckCircle2 className="w-10 h-10" />
                </motion.div>
                <div className="space-y-1">
                  <h3 className="text-lg font-extrabold text-ink">Payment Successful!</h3>
                  <p className="text-xs text-muted font-mono">Payment ID: {paymentId}</p>
                  <p className="text-xs font-semibold text-green-600">Redirecting to your booking confirmation...</p>
                </div>
              </div>
            )}
          </div>

          {/* ── FOOTER ─────────────────────────────────────────────── */}
          <div className="bg-ground px-4 py-2.5 border-t border-line flex items-center justify-between text-[11px] text-muted">
            <div className="flex items-center gap-1.5 font-medium">
              <span>Secured by</span>
              <span className="font-extrabold text-ink tracking-tight">Razorpay</span>
            </div>
            <span className="font-mono text-[10px]">PCI-DSS LEVEL 1 CERTIFIED</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
