import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Eye, EyeOff, Check, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../utils/SanitizationHelpers';
import toast from 'react-hot-toast';

const PW_RULES = [
  { test: p => p.length >= 8, label: '8+ characters' },
  { test: p => /[A-Z]/.test(p), label: 'Uppercase' },
  { test: p => /[a-z]/.test(p), label: 'Lowercase' },
  { test: p => /\d/.test(p), label: 'Number' },
  { test: p => /[@$!%*?&#^()\-_=+]/.test(p), label: 'Special char' },
];

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) setError('Invalid reset link. Please request a new one.');
  }, [token]);

  const strength = PW_RULES.filter(r => r.test(password)).length;
  const strengthColors = ['#3f3f46', '#ef4444', '#f97316', '#eab308', '#22c55e', '#22c55e'];
  const match = password && confirm && password === confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!match) { setError('Passwords do not match'); return; }
    if (strength < 5) { setError('Password does not meet all requirements'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      toast.success('Password reset successfully');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-600 transition-all";

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mb-4 shadow-xl shadow-blue-950">
            <Shield size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">DeepDetect</h1>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-950/50 border border-emerald-800/50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={24} className="text-emerald-400" strokeWidth={1.75} />
              </div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-2">Password reset</h2>
              <p className="text-sm text-zinc-400">Redirecting you to sign in…</p>
              <Link to="/login" className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                Sign in now
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-100 mb-1">Set new password</h2>
              <p className="text-sm text-zinc-500 mb-5">Choose a strong password for your account</p>

              {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-950/40 border border-red-800/50 mb-4">
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">New password</label>
                  <div className="relative">
                    <input type={showPwd ? 'text' : 'password'} required value={password}
                      onChange={e => setPassword(e.target.value)}
                      className={inputCls + ' pr-11'} placeholder="Strong new password" autoFocus />
                    <button type="button" onClick={() => setShowPwd(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {password && (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                            style={{ backgroundColor: i <= strength ? strengthColors[strength] : '#27272a' }} />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {PW_RULES.map(r => (
                          <div key={r.label} className="flex items-center gap-1.5">
                            <Check size={10} className={r.test(password) ? 'text-emerald-400' : 'text-zinc-700'} strokeWidth={3} />
                            <span className={`text-xs ${r.test(password) ? 'text-emerald-400' : 'text-zinc-600'}`}>{r.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Confirm password</label>
                  <input type="password" required value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className={inputCls + (confirm ? (match ? ' border-emerald-700' : ' border-red-800') : '')}
                    placeholder="Repeat password" />
                  {confirm && !match && (
                    <p className="text-xs text-red-400">Passwords don't match</p>
                  )}
                </div>

                <button type="submit" disabled={loading || !token || strength < 5 || !match}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-950">
                  {loading ? 'Resetting…' : 'Reset password'}
                </button>
              </form>

              <p className="text-center text-sm text-zinc-600 mt-4">
                Remember it?{' '}
                <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
