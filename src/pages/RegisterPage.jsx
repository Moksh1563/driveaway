import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import AuthShell from '../components/layout/AuthShell';

const RULES = [
  { test: (p) => p.length >= 8, label: '8 or more characters' },
  { test: (p) => /[A-Za-z]/.test(p), label: 'A letter' },
  { test: (p) => /\d/.test(p), label: 'A number' },
];

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = typeof location.state?.from === 'string' && location.state.from.startsWith('/') ? location.state.from : null;
  const [form, setForm] = useState({ name: '', username: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const passOk = RULES.every((r) => r.test(form.password));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!passOk) return setError('Your password needs 8 or more characters, with a letter and a number.');
    if (form.password !== form.confirmPassword) return setError('The two passwords do not match.');
    if (!agreed) return setError('Please accept the rental terms to continue.');
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
      toast.success(`Welcome to Driveaway, ${data.user.name}`);
      navigate(redirectTo || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create your account. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const field = (key, label, type, autoComplete, placeholder) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <input type={type} required value={form[key]} onChange={set(key)} autoComplete={autoComplete} placeholder={placeholder} className="field" />
    </label>
  );

  return (
    <AuthShell paint="Hypercar" title="Get the keys." lead="Create an account once, then book any car in the fleet in about two minutes.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('name', 'Full name', 'text', 'name', 'Your name')}
          {field('username', 'Username', 'text', 'username', 'letters, numbers, _ or .')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('email', 'Email', 'email', 'email', 'you@example.com')}
          {field('phone', 'Phone', 'tel', 'tel', '10-digit mobile')}
        </div>

        <label className="block">
          <span className="field-label">Password</span>
          <span className="relative block">
            <input type={showPw ? 'text' : 'password'} required autoComplete="new-password" value={form.password} onChange={set('password')} className="field !pr-12" />
            <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-ink">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
        </label>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Password requirements">
          {RULES.map((r) => {
            const ok = r.test(form.password);
            return (
              <li key={r.label} className={`flex items-center gap-1.5 ${ok ? 'text-ok' : 'text-muted'}`}>
                <Check className={`h-3.5 w-3.5 ${ok ? '' : 'opacity-30'}`} /> {r.label}
              </li>
            );
          })}
        </ul>

        {field('confirmPassword', 'Confirm password', showPw ? 'text' : 'password', 'new-password')}

        <label className="flex items-start gap-3 pt-1 text-sm text-muted">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 rounded border-line bg-raised text-ink focus:ring-ink/30" />
          <span>I accept Driveaway&apos;s rental terms and privacy policy, and confirm I hold a valid driving licence.</span>
        </label>

        {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

        <Button type="submit" loading={loading} className="w-full !py-4 text-base">
          Create account <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-center text-sm text-muted">
          Already have an account? <Link to="/login" state={location.state} className="font-semibold text-ink underline">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
