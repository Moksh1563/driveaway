import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Button from '../components/ui/Button';
import AuthShell, { PasswordChecklist } from '../components/layout/AuthShell';
import { passwordOk } from '../hooks/useFieldErrors';
import { useAuth } from '../context/AuthContext';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkDead, setLinkDead] = useState(false);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!passwordOk(form.password)) return setError('Your password needs 8 to 128 characters, with a letter and a number.');
    if (form.password !== form.confirmPassword) return setError('The two passwords do not match.');
    setLoading(true);
    try {
      const { data } = await api.post(`/auth/reset-password/${encodeURIComponent(token)}`, { password: form.password });
      toast.success(data?.message || 'Password updated. Sign in with your new password.');
      // The reset signs out every session, including one in this browser: drop it here too
      logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset your password. Please try again.');
      // Only an invalid or expired link needs a new one; a refused password or no connection can be retried
      setLinkDead(err.response?.data?.code === 'RESET_LINK_INVALID');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell paint="Electric" title="New password." lead="Choose a new password for your Driveaway account. Every device signed in with the old one is signed out.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <label className="block">
          <span className="field-label">New password</span>
          <span className="relative block">
            <input type={showPw ? 'text' : 'password'} required autoComplete="new-password" value={form.password} onChange={set('password')} className="field !pr-12" />
            <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-ink">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
        </label>
        <PasswordChecklist password={form.password} />

        <label className="block">
          <span className="field-label">Confirm new password</span>
          <input type={showPw ? 'text' : 'password'} required autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} className="field" />
        </label>

        {error && (
          <div role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            <p>{error}</p>
            {linkDead && <Link to="/forgot-password" className="mt-1 inline-block font-semibold underline">Send me a new link</Link>}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full !py-4 text-base">
          Save new password <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-center text-sm text-muted">
          <Link to="/login" className="font-semibold text-ink underline">Back to sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
