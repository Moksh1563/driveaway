import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Car, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PageWrapper from '../components/layout/PageWrapper';
import Button from '../components/ui/Button';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', username: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const pwStrength = (() => {
    const p = form.password;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][pwStrength] || '';
  const strengthColor = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-400', 'bg-green-500'][pwStrength] || 'bg-gray-400';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!agreed) {
      toast.error('Please accept the terms of service');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        name: form.name,
        username: form.username,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      login(data.token, data.user);
      toast.success(`Welcome to Driveaway, ${data.user.name}! 🎉`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = "w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none placeholder-gray-400 dark:placeholder-gray-500 shadow-sm transition-all";

  const field = (key, label, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type}
        required
        value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        className={inputStyle}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <PageWrapper>
      <div className="min-h-screen flex bg-gray-50 dark:bg-[#0D0D0D]">
        {/* Left Hero Panel (Desktop) */}
        <div
          className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1200')",
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
              <h2 className="text-4xl xl:text-5xl font-black leading-tight mb-4">
                Join Driveaway.<br /><span className="text-amber-500">Drive in Style.</span>
              </h2>
              <div className="space-y-2 mt-4">
                {['No hidden security deposit fees', 'Earn loyalty points with every rental', 'Flexible cancellation policy', '24/7 dedicated local support'].map((b) => (
                  <div key={b} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-gray-400">
              © {new Date().getFullYear()} Driveaway Pvt Ltd • Ahmedabad, Gujarat
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
                Create Account 🚀
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Start your journey with Ahmedabad's best cars
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {field('name', 'Full Name', 'text', 'Aarav Shah')}
              {field('username', 'Username', 'text', 'moksh123')}
              {field('email', 'Email Address', 'email', 'you@example.com')}
              {field('phone', 'Phone Number', 'tel', '9999999999')}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Password</label>
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
                {form.password && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${i < pwStrength ? strengthColor : 'bg-gray-200 dark:bg-white/10'} transition-all`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">Strength: {strengthLabel}</p>
                  </div>
                )}
              </div>

              {field('confirmPassword', 'Confirm Password', 'password', '••••••••')}

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-amber-500 rounded flex-shrink-0"
                />
                <span className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                  I agree to the <span className="text-amber-500 font-medium">Terms of Service</span> and <span className="text-amber-500 font-medium">Privacy Policy</span>
                </span>
              </label>

              <Button type="submit" loading={loading} className="w-full font-bold shadow-lg shadow-amber-500/20" size="lg">
                Create Account
              </Button>
            </form>

            <p className="text-center text-gray-600 dark:text-gray-400 text-sm mt-5">
              Already have an account?{' '}
              <Link to="/login" className="text-amber-500 hover:text-amber-400 font-semibold underline-offset-2 hover:underline">
                Sign in
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </PageWrapper>
  );
}
