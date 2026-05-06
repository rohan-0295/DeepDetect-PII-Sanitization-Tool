import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import toast from 'react-hot-toast';
import {
  ScanLine, LayoutDashboard, ClipboardList,
  FileDown, LogOut, Shield, ChevronRight, Settings,
  AlertTriangle,
} from 'lucide-react';
import { downloadComplianceReport } from '../utils/SanitizationHelpers';

const NAV = [
  { to: '/scan',      icon: ScanLine,        label: 'Scan & Sanitize' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Analytics' },
  { to: '/audit',     icon: ClipboardList,   label: 'Audit Logs' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  const handleLogout = async () => {
    await logout(); toast.success('Signed out'); navigate('/login');
  };

  const handleExport = async () => {
    setExporting(true);
    try { await downloadComplianceReport(30); toast.success('Report downloaded'); }
    catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-zinc-800/80 bg-zinc-900">

        {/* Logo */}
        <div className="h-14 flex items-center gap-3 px-5 border-b border-zinc-800/80">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-950">
            <Shield size={13} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-zinc-100 leading-none">DeepDetect</p>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">PII Guard v1.0</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <p className="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-widest text-zinc-600">Core</p>
          <div className="space-y-0.5">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `group flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent'
                  }`
                }>
                {({ isActive }) => (
                  <>
                    <Icon size={15} strokeWidth={isActive ? 2 : 1.75}
                      className={isActive ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-300'} />
                    <span className="font-medium flex-1 leading-none">{label}</span>
                    {isActive && <ChevronRight size={11} className="text-blue-500/50" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          <p className="px-3 pb-2 pt-5 text-xs font-medium uppercase tracking-widest text-zinc-600">Compliance</p>
          <button onClick={handleExport} disabled={exporting}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent transition-all disabled:opacity-40">
            <FileDown size={15} strokeWidth={1.75} className="text-zinc-500" />
            <span className="font-medium leading-none">{exporting ? 'Generating…' : 'Export PDF'}</span>
          </button>
        </nav>

        {/* Unverified badge */}
        {user && user.isEmailVerified === false && (
          <div className="mx-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-800/40">
            <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400 leading-snug">Email not verified</p>
          </div>
        )}

        {/* User */}
        <div className="border-t border-zinc-800/80 p-3">
          <NavLink to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all duration-150 group ${
                isActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'
              }`
            }>
            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-300 flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate leading-none">
                {user?.displayName || user?.email?.split('@')[0]}
              </p>
              <p className="text-xs text-zinc-500 capitalize mt-0.5">{user?.role}</p>
            </div>
            <Settings size={13} className="text-zinc-600 group-hover:text-zinc-400 flex-shrink-0 transition-colors" />
          </NavLink>

          <button onClick={handleLogout} title="Sign out"
            className="mt-1 w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-zinc-600 hover:text-red-400 hover:bg-red-950/20 transition-all">
            <LogOut size={12} strokeWidth={2} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
