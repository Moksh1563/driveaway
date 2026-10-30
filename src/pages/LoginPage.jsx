import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Car, Shield, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PageWrapper from '../components/layout/PageWrapper';
import Button from '../components/ui/Button';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name}! 👋`);
      navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = "w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none placeholder-gray-400 dark:placeholder-gray-500 shadow-sm transition-all";

  return (
    <PageWrapper>
      <div className="min-h-screen flex bg-gray-50 dark:bg-[#0D0D0D]">
        {/* Left Hero Panel (Desktop) */}
        <div
          className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30" />
          <div className="relative z-10 flex flex-col justify-between p-12 w-full text-white">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Car className="w-6 h-6 text-black" />
              </div>
              <span className="text-white font-bold text-2xl tracking-tight">
                Drive<span className="text-amber-500">away</span>
              </span>
            </Link>

            <div>
              <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-3 py-1 text-xs font-semibold text-amber-400 mb-4">
                <Shield className="w-3.5 h-3.5" /> Ahmedabad's Verified Fleet
              </div>
              <h2 className="text-4xl xl:text-5xl font-black leading-tight mb-4">
                Drive Your <span className="text-amber-500">Dream Car</span> Today.
              </h2>
              <p className="text-gray-300 text-base max-w-md leading-relaxed">
                Enjoy instant bookings, verified premium cars, and hassle-free pickup across Vastrapur, SG Highway & Ahmedabad Airport.
              </p>
            </div>

            <div className="flex items-center gap-6 text-xs text-gray-400">
              <span>✓ 24/7 Roadside Assistance</span>
              <span>✓ No Hidden Charges</span>
              <span>✓ Instant Refunds</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-12 py-12">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-white dark:bg-[#161616] p-8 rounded-2xl shadow-xl dark:shadow-2xl border border-gray-100 dark:border-white/[0.08]"
          >
            {/* Logo Mobile */}
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center">
                <Car className="w-5 h-5 text-black" />
              </div>
              <span className="text-gray-900 dark:text-white font-bold text-xl">
                Drive<span className="text-amber-500">away</span>
              </span>
            </div>

            <div className="mb-6">
              <h1 className="text-gray-900 dark:text-white text-2xl font-bold tracking-tight">
                Welcome Back 👋
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Enter your credentials to access your account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Email Address or Username
                </label>
                <input
                  type="text"
                  required
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className={inputStyle}
                  placeholder="admin@driveaway.com or customer@example.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    className={`${inputStyle} pr-11`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full mt-2 font-bold shadow-lg shadow-amber-500/20"
                size="lg"
              >
                Sign In
              </Button>
            </form>

            <p className="text-center text-gray-600 dark:text-gray-400 text-sm mt-5">
              Don't have an account?{' '}
              <Link to="/register" className="text-amber-500 hover:text-amber-400 font-semibold underline-offset-2 hover:underline">
                Create account
              </Link>
            </p>

            {/* Quick Demo Credentials Box */}
            <div className="mt-6 bg-amber-500/5 dark:bg-white/[0.03] border border-amber-500/20 dark:border-white/10 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  ⚡ Quick Demo Login
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Click to autofill</span>
              </div>

              <div
                onClick={() => setForm({ email: 'admin@driveaway.com', password: 'REMOVED-PASSWORD' })}
                className="flex items-center justify-between bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 hover:border-amber-500 rounded-lg p-2.5 cursor-pointer transition-all hover:scale-[1.01]"
              >
                <div>
                  <p className="text-gray-900 dark:text-white text-xs font-bold flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-amber-500" /> Admin Account
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-[11px]">admin@driveaway.com</p>
                </div>
                <span className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                  REMOVED-PASSWORD
                </span>
              </div>

              <div
                onClick={() => setForm({ email: 'customer@example.com', password: 'REMOVED-PASSWORD' })}
                className="flex items-center justify-between bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 hover:border-amber-500 rounded-lg p-2.5 cursor-pointer transition-all hover:scale-[1.01]"
              >
                <div>
                  <p className="text-gray-900 dark:text-white text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-green-500" /> Customer Account (Moksh)
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-[11px]">customer@example.com</p>
                </div>
                <span className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                  REMOVED-PASSWORD
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </PageWrapper>
  );
}
