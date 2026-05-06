/**
 * DeepDetect — App Entry
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { authAPI } from './utils/SanitizationHelpers';
import ErrorBoundary from './components/ErrorBoundary';

import LoginPage         from './pages/LoginPage';
import RegisterPage      from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage  from './pages/ResetPasswordPage';
import VerifyEmailPage    from './pages/VerifyEmailPage';
import NotFoundPage       from './pages/NotFoundPage';
import DashboardPage      from './pages/DashboardPage';
import ScanPage           from './pages/ScanPage';
import AuditPage          from './pages/AuditPage';
import ProfilePage        from './pages/ProfilePage';
import Layout             from './components/Layout';

// ─── Auth Context ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authAPI.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const h = () => setUser(null);
    window.addEventListener('auth:expired', h);
    return () => window.removeEventListener('auth:expired', h);
  }, []);

  const login    = useCallback(async (creds) => { const d = await authAPI.login(creds); setUser(d.user); return d; }, []);
  const register = useCallback(async (data)  => { const d = await authAPI.register(data); setUser(d.user); return d; }, []);
  const logout   = useCallback(async ()      => { await authAPI.logout().catch(() => {}); setUser(null); }, []);
  const refreshUser = useCallback(async ()   => { const d = await authAPI.me(); setUser(d); return d; }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Guards ───────────────────────────────────────────────────────────────────
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-zinc-500 font-mono">Authenticating…</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/login" state={{ from: location }} replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/scan" replace /> : children;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/scan" replace />} />

            {/* Public */}
            <Route path="/login"           element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register"        element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
            <Route path="/reset-password"  element={<ResetPasswordPage />} />
            <Route path="/verify-email"    element={<VerifyEmailPage />} />

            {/* Private — inside Layout */}
            <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route path="/scan"      element={<ScanPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/audit"     element={<AuditPage />} />
              <Route path="/profile"   element={<ProfilePage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>

        <Toaster position="top-right" toastOptions={{
          style: {
            background: '#18181b', color: '#e4e4e7',
            border: '1px solid #3f3f46', borderRadius: '10px',
            fontSize: '13px', fontFamily: 'Inter, sans-serif',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#18181b' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#18181b' } },
        }} />
      </AuthProvider>
    </ErrorBoundary>
  );
}
