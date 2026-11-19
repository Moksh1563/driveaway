import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import AuthShell from '../components/layout/AuthShell';

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
        <div>
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
                className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-ink"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>
          <p className="mt-2 text-right text-sm">
            <Link
              to="/forgot-password"
              state={form.email.includes('@') ? { email: form.email.trim() } : undefined}
              className="font-semibold text-muted underline hover:text-ink"
            >
              Forgot password?
            </Link>
          </p>
        </div>

        {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

        <Button type="submit" loading={loading} className="w-full !py-4 text-base">
          Sign in <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="text-center text-sm text-muted">
          New to Driveaway?{' '}
          <Link to="/register" state={location.state} className="font-semibold text-ink underline">Create an account</Link>
        </p>
      </form>

    </AuthShell>
  );
}
