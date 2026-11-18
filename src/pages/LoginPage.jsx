import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Shield, User } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import AuthShell from '../components/layout/AuthShell';

// Demo accounts from the project's seed data (server/seed.js), for presentations
const DEMO = [
  { label: 'Admin account', email: 'admin@driveaway.com', password: 'REMOVED-PASSWORD', icon: Shield },
  { label: 'Customer account', email: 'customer@example.com', password: 'REMOVED-PASSWORD', icon: User },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = typeof location.state?.from === 'string' && location.state.from.startsWith('/') ? location.state.from : null;
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name}`);
      navigate(redirectTo || (data.user.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not sign in. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      paint="Supercar"
      title="Welcome back."
      lead={redirectTo?.startsWith('/booking') ? 'Sign in to finish booking your car.' : 'Sign in to book, pay and manage your rentals.'}
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <label className="block">
          <span className="field-label">Email or username</span>
          <input
            type="text"
            required
            autoComplete="username"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className="field"
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className="field-label">Password</span>
          <span className="relative block">
            <input
              type={showPw ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className="field !pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-ink"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
        </label>

        {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

        <Button type="submit" loading={loading} className="w-full !py-4 text-base">
          Sign in <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="text-center text-sm text-muted">
          New to Driveaway?{' '}
          <Link to="/register" state={location.state} className="font-semibold text-ink underline">Create an account</Link>
        </p>
      </form>

      <div className="mt-10 border-t border-line pt-6">
        <p className="field-label">Demo accounts</p>
        <div className="grid gap-2">
          {DEMO.map(({ label, email, password, icon: Icon }) => (
            <button
              key={email}
              type="button"
              onClick={() => { setForm({ email, password }); setError(''); }}
              className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-left transition-colors hover:border-ink"
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted" />
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-xs text-muted">{email}</span>
                </span>
              </span>
              <span className="code-label text-[11px] text-muted">Fill in</span>
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
