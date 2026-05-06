import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../utils/SanitizationHelpers';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      // Still show success — server never reveals if email exists
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mb-4 shadow-xl shadow-blue-950">
            <Shield size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">DeepDetect</h1>
          <p className="text-sm text-zinc-500 font-mono mt-1">PII Guard Platform</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          {!sent ? (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-blue-950/60 border border-blue-800/50 flex items-center justify-center">
                  <Mail size={16} className="text-blue-400" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-100 leading-none">Reset password</h2>
                  <p className="text-sm text-zinc-500 mt-0.5">We'll email you a secure link</p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-950/40 border border-red-800/50 mb-4">
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Your email address
                  </label>
                  <input
                    type="email" required autoFocus value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-600 transition-all"
                  />
                </div>

                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3">
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    The reset link expires in <strong className="text-zinc-300">1 hour</strong> and can only be used once.
                    If you don't receive an email, check your spam folder.
                  </p>
                </div>

                <button type="submit" disabled={loading || !email}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-950">
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-950/50 border border-emerald-800/50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={24} className="text-emerald-400" strokeWidth={1.75} />
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-100 mb-2">Check your inbox</h2>
              <p className="text-sm text-zinc-400 leading-relaxed mb-1">
                If <strong className="text-zinc-200">{email}</strong> is registered, a reset link is on its way.
              </p>
              <p className="text-xs text-zinc-600 mt-3">
                Didn't get it? Check your spam folder or{' '}
                <button onClick={() => setSent(false)} className="text-blue-400 hover:text-blue-300 transition-colors">
                  try again
                </button>
              </p>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-zinc-800">
            <Link to="/login"
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors w-fit">
              <ArrowLeft size={14} strokeWidth={2} />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
