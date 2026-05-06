/**
 * DeepDetect — Register
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '../App';
import toast from 'react-hot-toast';

const PW_RULES = [
  { test: p => p.length >= 8, label: '8+ characters' },
  { test: p => /[A-Z]/.test(p), label: 'Uppercase letter' },
  { test: p => /[a-z]/.test(p), label: 'Lowercase letter' },
  { test: p => /\d/.test(p), label: 'Number' },
  { test: p => /[@$!%*?&#^()\-_=+]/.test(p), label: 'Special character' },
];

const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#22c55e'];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', displayName: '', organization: '', dataProcessingConsent: false });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  const strength = PW_RULES.filter(r => r.test(form.password)).length;

  const handleSubmit = async (e) => {
    e.preventDefault(); setErrors([]);
    if (!form.dataProcessingConsent) { setErrors([{ msg: 'Data processing consent is required' }]); return; }
    setLoading(true);
    try { await register({ ...form, dataProcessingConsent: true }); toast.success('Account created'); navigate('/scan'); }
    catch (err) { setErrors(err.response?.data?.errors || [{ msg: err.response?.data?.error || 'Registration failed' }]); }
    finally { setLoading(false); }
  };

  const inputCls = "w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-600 transition-all";

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mb-4 shadow-xl shadow-blue-950">
            <Shield size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Create account</h1>
          <p className="text-sm text-zinc-500 font-mono mt-1">DeepDetect PII Guard</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          {errors.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {errors.map((e, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-red-950/40 border border-red-800/50">
                  <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-400">{e.msg}</p>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Full Name</label>
                <input type="text" value={form.displayName}
                  onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
                  className={inputCls} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Organization</label>
                <input type="text" value={form.organization}
                  onChange={e => setForm(p => ({ ...p, organization: e.target.value }))}
                  className={inputCls} placeholder="Acme Corp" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Work Email</label>
              <input type="email" required autoComplete="email" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className={inputCls} placeholder="you@company.com" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Password</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} required autoComplete="new-password"
                  value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className={inputCls + ' pr-11'} placeholder="Strong password" />
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {form.password && (
                <div className="mt-2 space-y-2">
                  {/* Strength bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 flex-1">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                          style={{ backgroundColor: i <= strength ? strengthColor[strength] : '#3f3f46' }} />
                      ))}
                    </div>
                    <span className="text-xs font-medium" style={{ color: strengthColor[strength] }}>
                      {strengthLabel[strength]}
                    </span>
                  </div>
                  {/* Rule checklist */}
                  <div className="grid grid-cols-2 gap-1">
                    {PW_RULES.map(r => (
                      <div key={r.label} className="flex items-center gap-1.5">
                        <Check size={10} className={r.test(form.password) ? 'text-emerald-400' : 'text-zinc-700'} strokeWidth={3} />
                        <span className={`text-xs ${r.test(form.password) ? 'text-emerald-400' : 'text-zinc-600'}`}>{r.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Consent */}
            <div className="border border-zinc-700 rounded-xl p-4 bg-zinc-800/40">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.dataProcessingConsent}
                  onChange={e => setForm(p => ({ ...p, dataProcessingConsent: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded accent-blue-500 flex-shrink-0" />
                <span className="text-sm text-zinc-400 leading-relaxed">
                  I consent to DeepDetect processing my data for PII detection services.
                  Scan metadata (never actual PII) is retained per{' '}
                  <span className="text-blue-400 font-medium">GDPR Art. 30</span> and{' '}
                  <span className="text-blue-400 font-medium">CCPA §1798.100</span>.
                  Legal basis: <strong className="text-zinc-200">Consent</strong>.
                </span>
              </label>
            </div>

            <button type="submit"
              disabled={loading || strength < 5 || !form.dataProcessingConsent}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-150 shadow-lg shadow-blue-950">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-600 mt-5">
            Have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
