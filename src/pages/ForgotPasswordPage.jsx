import React, { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, MailCheck } from 'lucide-react';
import api from '../api/axios';
import Button from '../components/ui/Button';
import AuthShell from '../components/layout/AuthShell';
import { isEmail } from '../hooks/useFieldErrors';

const SENT_FALLBACK = 'If an account exists for that email, a reset link is on its way.';

export default function ForgotPasswordPage() {
  const location = useLocation();
  const passed = typeof location.state?.email === 'string' ? location.state.email : '';
  const [email, setEmail] = useState(isEmail(passed) ? passed : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const inputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isEmail(email)) {
      setError('Enter the email address you signed up with.');
      inputRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(data?.message || SENT_FALLBACK);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell paint="Luxury" title="Locked out?" lead="Tell us your email and we will send a link to choose a new password.">
      {sent ? (
        <div className="space-y-5">
          <div role="status" className="flex gap-3 rounded-xl bg-ok/10 px-4 py-4 text-sm">
            <MailCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-ok" aria-hidden="true" />
            <p>{sent}</p>
          </div>
          <p className="text-sm text-muted">The link works for 30 minutes. If nothing arrives, check your spam folder or send it again.</p>
          <Link to="/login" className="btn-ink w-full !py-4 text-base">Back to sign in <ArrowRight className="h-4 w-4" /></Link>
          <button type="button" onClick={() => setSent('')} className="btn-ghost w-full">Use a different email</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <label className="block">
            <span className="field-label">Email</span>
            <input
              ref={inputRef}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'forgot-error' : undefined}
              className="field"
              placeholder="you@example.com"
            />
          </label>

          {error && <p id="forgot-error" role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

          <Button type="submit" loading={loading} className="w-full !py-4 text-base">
            Send reset link <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="text-center text-sm text-muted">
            Remembered it? <Link to="/login" className="font-semibold text-ink underline">Sign in</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
