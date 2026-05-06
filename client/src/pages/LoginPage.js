/**
 * DeepDetect — Login
 */
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../App';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/scan';
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(form); toast.success('Welcome back'); navigate(from, { replace: true }); }
    catch (err) { setError(err.response?.data?.error || 'Login failed'); }
    finally { setLoading(false); }
  };

  const inputCls = "w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-600 transition-all font-sans";

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mb-4 shadow-xl shadow-blue-950">
            <Shield size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">DeepDetect</h1>
          <p className="text-sm text-zinc-500 font-mono mt-1">PII Guard Platform</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100 mb-1">Sign in</h2>
          <p className="text-sm text-zinc-500 mb-5">Enter your credentials to continue</p>

          {error && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-950/40 border border-red-800/50 mb-4">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Email</label>
              <input type="email" autoComplete="email" required value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className={inputCls} placeholder="you@company.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Password</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} autoComplete="current-password" required
                  value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className={inputCls + ' pr-11'} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <Link to="/forgot-password"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                Forgot password?
              </Link>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all duration-150 shadow-lg shadow-blue-950 mt-2">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-600 mt-5">
            No account?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 transition-colors font-medium">Create one</Link>
          </p>
        </div>

        <p className="text-center text-xs font-mono text-zinc-700 mt-5">
          GDPR · CCPA · ISO 27001 — JWT + httpOnly cookies
        </p>
      </div>
    </div>
  );
}
