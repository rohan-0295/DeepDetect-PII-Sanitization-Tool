import React, { useState, useEffect } from 'react';
import {
  User, Lock, Trash2, Download, ShieldCheck,
  Eye, EyeOff, Check, AlertCircle, CheckCircle2, Bell,
} from 'lucide-react';
import { useAuth } from '../App';
import api from '../utils/SanitizationHelpers';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const PW_RULES = [
  { test: p => p.length >= 8, label: '8+ characters' },
  { test: p => /[A-Z]/.test(p), label: 'Uppercase' },
  { test: p => /[a-z]/.test(p), label: 'Lowercase' },
  { test: p => /\d/.test(p), label: 'Number' },
  { test: p => /[@$!%*?&#^()\-_=+]/.test(p), label: 'Special char' },
];

function Section({ title, description, children, danger }) {
  return (
    <div className={`bg-zinc-900 border rounded-xl overflow-hidden ${danger ? 'border-red-900/60' : 'border-zinc-800'}`}>
      <div className={`px-6 py-4 border-b ${danger ? 'border-red-900/40 bg-red-950/10' : 'border-zinc-800'}`}>
        <h3 className={`text-sm font-semibold ${danger ? 'text-red-400' : 'text-zinc-100'}`}>{title}</h3>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

const inputCls = "w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-600 transition-all";
const labelCls = "text-xs font-medium uppercase tracking-wider text-zinc-500";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ displayName: user?.displayName || '', organization: user?.organization || '' });
  const [profileLoading, setProfileLoading] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: '', password: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const [deleteForm, setDeleteForm] = useState({ password: '', confirmation: '' });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [verificationSent, setVerificationSent] = useState(false);
  const [fullUser, setFullUser] = useState(null);

  useEffect(() => {
    api.get('/auth/me').then(r => setFullUser(r.data)).catch(() => {});
  }, []);

  const pwStrength = PW_RULES.filter(r => r.test(pwForm.password)).length;
  const strengthColors = ['#3f3f46','#ef4444','#f97316','#eab308','#22c55e','#22c55e'];
  const pwMatch = pwForm.password && pwForm.confirm && pwForm.password === pwForm.confirm;

  // ── Profile update ──────────────────────────────────────────────────────────
  const handleProfileSave = async (e) => {
    e.preventDefault(); setProfileLoading(true);
    try {
      await api.put('/auth/profile', profile);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally { setProfileLoading(false); }
  };

  // ── Change password ──────────────────────────────────────────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pwMatch) { toast.error('Passwords do not match'); return; }
    if (pwStrength < 5) { toast.error('Password does not meet all requirements'); return; }
    setPwLoading(true);
    try {
      await api.put('/auth/change-password', { currentPassword: pwForm.currentPassword, password: pwForm.password });
      toast.success('Password changed. Please sign in again.');
      setPwForm({ currentPassword: '', password: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally { setPwLoading(false); }
  };

  // ── Resend verification ──────────────────────────────────────────────────────
  const handleResendVerification = async () => {
    try {
      await api.post('/auth/resend-verification');
      setVerificationSent(true);
      toast.success('Verification email sent');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send email');
    }
  };

  // ── Export data (GDPR) ───────────────────────────────────────────────────────
  const handleExportData = async () => {
    try {
      const res = await api.get('/user/export-data', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = `deepdetect-export-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Data export downloaded');
    } catch { toast.error('Export failed'); }
  };

  // ── Delete account ───────────────────────────────────────────────────────────
  const handleDeleteAccount = async (e) => {
    e.preventDefault(); setDeleteLoading(true);
    try {
      await api.delete('/auth/account', { data: deleteForm });
      await logout();
      toast.success('Account deleted');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Deletion failed');
    } finally { setDeleteLoading(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="h-14 flex items-center px-6 border-b border-zinc-800/80 bg-zinc-900/40 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Account Settings</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Manage your profile, security, and data</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-5">

        {/* Email verification banner */}
        {fullUser && !fullUser.isEmailVerified && !verificationSent && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-amber-950/30 border border-amber-800/50 rounded-xl">
            <div className="flex items-center gap-2.5">
              <Bell size={15} className="text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-300">Your email address hasn't been verified yet.</p>
            </div>
            <button onClick={handleResendVerification}
              className="shrink-0 px-3 py-1.5 bg-amber-700/40 hover:bg-amber-700/60 text-amber-300 text-xs font-medium rounded-lg border border-amber-700/50 transition-all">
              Resend email
            </button>
          </div>
        )}
        {verificationSent && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl">
            <CheckCircle2 size={15} className="text-emerald-400" />
            <p className="text-sm text-emerald-300">Verification email sent — check your inbox.</p>
          </div>
        )}

        {/* Profile */}
        <Section title="Profile" description="Update your display name and organization">
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelCls}>Display name</label>
                <input type="text" value={profile.displayName}
                  onChange={e => setProfile(p => ({ ...p, displayName: e.target.value }))}
                  className={inputCls} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Organization</label>
                <input type="text" value={profile.organization}
                  onChange={e => setProfile(p => ({ ...p, organization: e.target.value }))}
                  className={inputCls} placeholder="Acme Corp" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Email address</label>
              <input type="email" value={user?.email || ''} disabled
                className={inputCls + ' opacity-50 cursor-not-allowed'} />
              <p className="text-xs text-zinc-600">Email changes require contacting support</p>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                {fullUser?.isEmailVerified
                  ? <><CheckCircle2 size={13} className="text-emerald-400" /><span className="text-xs text-emerald-400">Email verified</span></>
                  : <><AlertCircle size={13} className="text-amber-400" /><span className="text-xs text-amber-400">Email not verified</span></>
                }
              </div>
              <button type="submit" disabled={profileLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all">
                {profileLoading ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Section>

        {/* Change password */}
        <Section title="Change Password" description="Use a strong unique password">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Current password</label>
              <div className="relative">
                <input type={showCurrent ? 'text' : 'password'} value={pwForm.currentPassword}
                  onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))}
                  className={inputCls + ' pr-11'} placeholder="Your current password" />
                <button type="button" onClick={() => setShowCurrent(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>New password</label>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} value={pwForm.password}
                  onChange={e => setPwForm(p => ({ ...p, password: e.target.value }))}
                  className={inputCls + ' pr-11'} placeholder="New strong password" />
                <button type="button" onClick={() => setShowNew(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {pwForm.password && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-all"
                        style={{ backgroundColor: i <= pwStrength ? strengthColors[pwStrength] : '#27272a' }} />
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {PW_RULES.map(r => (
                      <div key={r.label} className="flex items-center gap-1">
                        <Check size={9} className={r.test(pwForm.password) ? 'text-emerald-400' : 'text-zinc-700'} strokeWidth={3} />
                        <span className={`text-xs ${r.test(pwForm.password) ? 'text-emerald-400' : 'text-zinc-600'}`}>{r.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Confirm new password</label>
              <input type="password" value={pwForm.confirm}
                onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                className={inputCls + (pwForm.confirm ? (pwMatch ? ' border-emerald-700' : ' border-red-800') : '')}
                placeholder="Repeat new password" />
              {pwForm.confirm && !pwMatch && <p className="text-xs text-red-400">Passwords don't match</p>}
            </div>
            <div className="flex justify-end">
              <button type="submit"
                disabled={pwLoading || pwStrength < 5 || !pwMatch || !pwForm.currentPassword}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-all">
                {pwLoading ? 'Changing…' : 'Change password'}
              </button>
            </div>
          </form>
        </Section>

        {/* GDPR data export */}
        <Section title="Your Data" description="Download or manage your personal data">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-300 font-medium">Export your data</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Download all scan metadata in JSON format (GDPR Art. 20 — Right to portability). No PII is included.
              </p>
            </div>
            <button onClick={handleExportData}
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm font-medium rounded-lg transition-all ml-4">
              <Download size={14} strokeWidth={2} />
              Export JSON
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-800 flex items-start gap-2.5">
            <ShieldCheck size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-zinc-500 leading-relaxed">
              DeepDetect never stores the actual PII from your scans — only statistical metadata (counts, types, risk scores).
              Your audit trail is retained for 365 days per GDPR Article 5(1)(e) and then automatically purged.
            </p>
          </div>
        </Section>

        {/* Danger zone */}
        <Section title="Danger Zone" description="Permanent actions — proceed with caution" danger>
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-300 font-medium">Delete account</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Your account is anonymized per GDPR Art. 17. Audit log metadata is retained for compliance.
                </p>
              </div>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="shrink-0 flex items-center gap-2 px-4 py-2 bg-red-950/40 hover:bg-red-950/70 border border-red-800/60 text-red-400 text-sm font-medium rounded-lg transition-all ml-4">
                <Trash2 size={14} strokeWidth={2} />
                Delete account
              </button>
            </div>
          ) : (
            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div className="flex items-start gap-2.5 p-3 bg-red-950/20 border border-red-900/40 rounded-lg">
                <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-300 leading-relaxed">
                  This action is irreversible. Your account will be anonymized and you will be signed out immediately.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Enter your password to confirm</label>
                <input type="password" required value={deleteForm.password}
                  onChange={e => setDeleteForm(p => ({ ...p, password: e.target.value }))}
                  className={inputCls} placeholder="Your current password" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>
                  Type <strong className="text-red-400 font-mono">DELETE MY ACCOUNT</strong> to confirm
                </label>
                <input type="text" required value={deleteForm.confirmation}
                  onChange={e => setDeleteForm(p => ({ ...p, confirmation: e.target.value }))}
                  className={inputCls} placeholder="DELETE MY ACCOUNT" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-all">
                  Cancel
                </button>
                <button type="submit"
                  disabled={deleteLoading || deleteForm.confirmation !== 'DELETE MY ACCOUNT' || !deleteForm.password}
                  className="flex-1 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-all">
                  {deleteLoading ? 'Deleting…' : 'Permanently delete'}
                </button>
              </div>
            </form>
          )}
        </Section>

      </div>
    </div>
  );
}
