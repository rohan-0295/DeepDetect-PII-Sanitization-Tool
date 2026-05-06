import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import api from '../utils/SanitizationHelpers';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('No verification token provided.'); return; }
    api.get(`/auth/verify-email?token=${token}`)
      .then(r => { setStatus('success'); setMessage(r.data.message); })
      .catch(err => { setStatus('error'); setMessage(err.response?.data?.error || 'Verification failed.'); });
  }, [token]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mb-4 shadow-xl shadow-blue-950">
            <Shield size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">DeepDetect</h1>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 size={36} className="text-blue-400 animate-spin mx-auto mb-4" strokeWidth={1.5} />
              <h2 className="text-lg font-semibold text-zinc-100 mb-2">Verifying your email…</h2>
              <p className="text-sm text-zinc-500">This will only take a moment</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-emerald-950/50 border border-emerald-800/50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={26} className="text-emerald-400" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-2">Email verified!</h2>
              <p className="text-sm text-zinc-400 mb-5">{message}</p>
              <Link to="/scan"
                className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all">
                Go to dashboard
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-red-950/50 border border-red-800/50 flex items-center justify-center mx-auto mb-4">
                <XCircle size={26} className="text-red-400" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-2">Verification failed</h2>
              <p className="text-sm text-zinc-400 mb-5">{message}</p>
              <Link to="/login"
                className="inline-block px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-xl border border-zinc-700 transition-all">
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
