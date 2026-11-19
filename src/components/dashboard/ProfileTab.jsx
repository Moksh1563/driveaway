import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import { ERROR_IN, useShake } from '../account/formFeedback';
import { passwordOk } from '../../hooks/useFieldErrors';

const PROFILE_FIELDS = {
  name: 'Full name',
  phone: 'Phone',
  licenseNumber: 'Driving licence number',
  drivingExperience: 'Years of driving',
  emergencyContact: 'Emergency contact',
  emergencyPhone: 'Emergency phone',
  address: 'Address',
};

const fromUser = (user) => Object.fromEntries(Object.keys(PROFILE_FIELDS).map((k) => [k, user?.[k] ?? '']));

/** Garage "Profile" tab: driver details and password, each form with its own saving state. */
export default function ProfileTab() {
  const { user, updateUser, updateToken } = useAuth();
  const [profileForm, setProfileForm] = useState(() => fromUser(user));
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '' });
  const [pwError, setPwError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [pwFormRef, shake] = useShake();
  // A refused password change shows its reason and gives the form a small shake
  const failPassword = (message) => { setPwError(message); shake(); };

  // The saved session only keeps name and email; fill the rest once the full profile arrives,
  // without overwriting anything already typed
  const touched = useRef(new Set());
  useEffect(() => {
    if (!user || !('loyaltyPoints' in user)) return;
    const values = fromUser(user);
    setProfileForm((p) => {
      const next = { ...p };
      Object.entries(values).forEach(([k, v]) => { if (!touched.current.has(k) && (next[k] === '' || next[k] === undefined)) next[k] = v; });
      return next;
    });
  }, [user]);

  const handleProfileSave = async () => {
    setSavingProfile(true);
    try {
      const { data } = await api.put('/auth/profile', profileForm);
      updateUser(data);
      toast.success('Details saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save your details');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async () => {
    setPwError('');
    if (!pwForm.oldPassword) return failPassword('Enter your current password.');
    if (!passwordOk(pwForm.newPassword)) return failPassword('The new password needs 8 to 128 characters, with a letter and a number.');
    setSavingPassword(true);
    try {
      const { data } = await api.put('/auth/password', pwForm);
      // Older tokens stop working after a password change; carry on with the fresh one
      if (data?.token) updateToken(data.token);
      toast.success('Password changed');
      setPwForm({ oldPassword: '', newPassword: '' });
    } catch (err) {
      failPassword(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <form className="lg:col-span-7" onSubmit={(e) => { e.preventDefault(); handleProfileSave(); }}>
        <h2 className="font-wide font-black uppercase tracking-tight text-xl">Driver details</h2>
        <p className="mt-2 text-sm text-muted">Saved details pre-fill your next booking.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Object.entries(PROFILE_FIELDS).map(([key, label]) => (
            <label key={key} className={`block ${key === 'address' ? 'sm:col-span-2' : ''}`}>
              <span className="field-label">{label}</span>
              <input
                value={profileForm[key] || ''}
                onChange={(e) => { touched.current.add(key); setProfileForm((p) => ({ ...p, [key]: e.target.value })); }}
                inputMode={key === 'drivingExperience' ? 'numeric' : key.toLowerCase().includes('phone') ? 'tel' : undefined}
                className="field"
              />
            </label>
          ))}
        </div>
        <Button type="submit" loading={savingProfile} className="mt-6">Save details</Button>
      </form>

      <form ref={pwFormRef} className="lg:col-span-5" onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }} noValidate>
        <h2 className="font-wide font-black uppercase tracking-tight text-xl">Password</h2>
        <p className="mt-2 text-sm text-muted">At least 8 characters, with a letter and a number.</p>
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="field-label">Current password</span>
            <input type="password" autoComplete="current-password" value={pwForm.oldPassword} onChange={(e) => setPwForm((p) => ({ ...p, oldPassword: e.target.value }))} className="field" />
          </label>
          <label className="block">
            <span className="field-label">New password</span>
            <input type="password" autoComplete="new-password" value={pwForm.newPassword} onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))} className="field" />
          </label>
        </div>
        {pwError && <p key={pwError} role="alert" className={`mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger dark:text-[#F28B82] ${ERROR_IN}`}>{pwError}</p>}
        <Button type="submit" variant="secondary" loading={savingPassword} className="mt-6">Change password</Button>
      </form>
    </div>
  );
}
