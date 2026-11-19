import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import AuthShell, { PasswordChecklist } from '../components/layout/AuthShell';
import PasswordEye from '../components/account/PasswordEye';
import { ERROR_IN, useShake } from '../components/account/formFeedback';
import { isEmail, isIndianMobile, passwordOk } from '../hooks/useFieldErrors';

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
  const [formRef, shake] = useShake();

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const passOk = passwordOk(form.password);
  // A refused submit shows its reason and gives the form a small shake
  const fail = (message) => { setError(message); shake(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isEmail(form.email)) return fail('Enter a valid email address, like you@example.com.');
    if (form.phone.trim() && !isIndianMobile(form.phone)) return fail('Enter a 10-digit Indian mobile number, or leave the phone empty.');
    if (!passOk) return fail('Your password needs 8 to 128 characters, with a letter and a number.');
    if (form.password !== form.confirmPassword) return fail('The two passwords do not match.');
    if (!agreed) return fail('Please accept the rental terms to continue.');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        name: form.name,
        username: form.username,
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      login(data.token, data.user);
      toast.success(`Welcome to Driveaway, ${data.user.name}`);
      navigate(redirectTo || '/dashboard', { replace: true });
    } catch (err) {
      fail(err.response?.data?.message || 'Could not create your account. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const field = (key, label, type, autoComplete, placeholder, required = true) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <input type={type} required={required} value={form[key]} onChange={set(key)} autoComplete={autoComplete} placeholder={placeholder} className="field" />
    </label>
  );

  return (
    <AuthShell paint="Hypercar" title="Get the keys." lead="Create an account once, then book any car in the fleet in about two minutes.">
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('name', 'Full name', 'text', 'name', 'Your name')}
          {field('username', 'Username', 'text', 'username', 'letters, numbers, _ or .')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('email', 'Email', 'email', 'email', 'you@example.com')}
          {field('phone', 'Phone (optional)', 'tel', 'tel', '10-digit mobile', false)}
        </div>

        <label className="block">
          <span className="field-label">Password</span>
          <span className="relative block">
            <input type={showPw ? 'text' : 'password'} required autoComplete="new-password" value={form.password} onChange={set('password')} className="field !pr-12" />
            <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-muted transition-[color,transform] duration-150 ease-out hover:text-ink active:scale-[0.96]">
              <PasswordEye shown={showPw} />
            </button>
          </span>
        </label>
        <PasswordChecklist password={form.password} />

        {field('confirmPassword', 'Confirm password', showPw ? 'text' : 'password', 'new-password')}

        {/* Tapping a link inside the label opens it (in a new tab, so the form is kept) without toggling the box */}
        <label className="flex items-start gap-3 pt-1 text-sm text-muted">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-line bg-raised text-ink focus:ring-ink/30" />
          <span>
            I accept Driveaway&apos;s{' '}
            <Link to="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline">rental terms</Link> and{' '}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline">privacy policy</Link>, and confirm I hold a valid driving licence.
          </span>
        </label>

        {error && <p key={error} role="alert" className={`rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger ${ERROR_IN}`}>{error}</p>}

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
