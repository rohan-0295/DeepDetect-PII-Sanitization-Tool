/**
 * DeepDetect — Analytics Dashboard
 * Professional B2B redesign
 */
import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Shield, Database, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { fetchAuditStats, downloadComplianceReport } from '../utils/SanitizationHelpers';
import toast from 'react-hot-toast';

const PIE_COLORS = {
  EMAIL: '#3b82f6', PHONE: '#8b5cf6', PERSON_NAME: '#06b6d4',
  SSN: '#ef4444', CREDIT_CARD: '#dc2626', IP_ADDRESS: '#f59e0b',
  OTHER: '#52525b',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 shadow-xl">
      <p className="text-xs text-zinc-400 mb-1.5 font-medium">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-zinc-400">{p.name}:</span>
          <span className="text-zinc-100 font-semibold font-mono">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

function StatCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    blue:   { bg: 'bg-blue-950/50',  border: 'border-blue-900/60',  icon: 'text-blue-400',  val: 'text-blue-300' },
    red:    { bg: 'bg-red-950/50',   border: 'border-red-900/60',   icon: 'text-red-400',   val: 'text-red-300' },
    amber:  { bg: 'bg-amber-950/50', border: 'border-amber-900/60', icon: 'text-amber-400', val: 'text-amber-300' },
    green:  { bg: 'bg-emerald-950/50',border: 'border-emerald-900/60',icon: 'text-emerald-400',val: 'text-emerald-300' },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-5`}>
      <div className={`w-8 h-8 rounded-lg bg-zinc-900/60 flex items-center justify-center mb-4 ${c.icon}`}>
        <Icon size={16} strokeWidth={1.75} />
      </div>
      <p className={`text-2xl font-semibold font-mono tracking-tight ${c.val}`}>{value}</p>
      <p className="text-sm font-medium text-zinc-300 mt-1">{label}</p>
      {sub && <p className="text-xs text-zinc-600 mt-0.5 font-mono">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setStats(await fetchAuditStats(period)); }
    catch { toast.error('Failed to load analytics'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [period]); // eslint-disable-line

  const handleExport = async () => {
    setExporting(true);
    try { await downloadComplianceReport(period); toast.success('PDF downloaded'); }
    catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw size={18} className="text-zinc-600 animate-spin" />
        <p className="text-sm text-zinc-600">Loading analytics…</p>
      </div>
    </div>
  );

  const { stats: s = {}, piiBreakdown = [], timeline = [], modeBreakdown = [] } = stats || {};

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 h-14 flex items-center justify-between px-6 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-sm">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Analytics</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Last {period} days · metadata only</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={period} onChange={e => setPeriod(Number(e.target.value))}
            className="text-sm font-medium bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 outline-none focus:border-zinc-600">
            {[7, 30, 90].map(d => <option key={d} value={d}>Last {d} days</option>)}
          </select>
          <button onClick={load} className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-500 hover:text-zinc-200 transition-colors">
            <RefreshCw size={13} />
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            <Download size={13} strokeWidth={2} />
            {exporting ? 'Generating…' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon={Shield}        label="Total Scans"      value={(s.totalScans||0).toLocaleString()}                     sub={`${period}-day window`}         color="blue"  />
          <StatCard icon={AlertTriangle} label="PII Detected"     value={(s.totalPIIFound||0).toLocaleString()}                  sub="Unique instances"               color="red"   />
          <StatCard icon={TrendingUp}    label="Avg Risk Score"   value={Math.round(s.avgRiskScore||0)}                          sub={`Peak: ${s.maxRiskScore||0}`}   color="amber" />
          <StatCard icon={Database}      label="Data Processed"   value={`${((s.totalBytesProcessed||0)/1024).toFixed(1)} KB`}  sub="Total input"                    color="green" />
        </div>

        {/* Timeline + Pie */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-sm font-medium text-zinc-300 mb-4">Scan Activity</p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={timeline} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="#27272a" />
                <XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#52525b', fontFamily: 'JetBrains Mono' }}
                  tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(timeline.length / 6))} />
                <YAxis tick={{ fontSize: 10, fill: '#52525b', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="scans" stroke="#3b82f6" strokeWidth={1.5}
                  fill="url(#grad)" dot={false} name="Scans" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-sm font-medium text-zinc-300 mb-4">PII Distribution</p>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={piiBreakdown.slice(0,6)} cx="50%" cy="50%"
                  innerRadius={50} outerRadius={72} paddingAngle={2} dataKey="totalCount">
                  {piiBreakdown.slice(0,6).map((entry, i) => (
                    <Cell key={i} fill={PIE_COLORS[entry._id] || PIE_COLORS.OTHER} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {piiBreakdown.slice(0,6).map(item => (
                <div key={item._id} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PIE_COLORS[item._id] || PIE_COLORS.OTHER }} />
                  <span className="text-xs text-zinc-500 truncate">{item._id?.replace(/_/g,' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PII bar + Mode */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-sm font-medium text-zinc-300 mb-4">PII Count by Type</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={piiBreakdown.slice(0,7)} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#27272a" vertical={false} />
                <XAxis dataKey="_id" tick={{ fontSize: 9, fill: '#52525b', fontFamily: 'JetBrains Mono' }}
                  tickLine={false} axisLine={false} interval={0}
                  tickFormatter={v => v.replace(/_/g,' ').slice(0,5)} />
                <YAxis tick={{ fontSize: 9, fill: '#52525b', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="totalCount" radius={[3,3,0,0]} name="Count">
                  {piiBreakdown.slice(0,7).map((e, i) => (
                    <Cell key={i} fill={PIE_COLORS[e._id] || PIE_COLORS.OTHER} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-sm font-medium text-zinc-300 mb-4">Sanitization Mode Usage</p>
            <div className="space-y-4">
              {(['REDACTION','MASKING','HASHING','PSEUDONYMIZATION']).map(id => {
                const item = modeBreakdown.find(m => m._id === id) || { count: 0 };
                const total = Math.max(1, modeBreakdown.reduce((s,m) => s+m.count, 0));
                const pct = Math.round((item.count / total) * 100);
                const colors = { REDACTION:'#ef4444', MASKING:'#3b82f6', HASHING:'#8b5cf6', PSEUDONYMIZATION:'#06b6d4' };
                return (
                  <div key={id}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm font-medium text-zinc-400">{id.charAt(0)+id.slice(1).toLowerCase()}</span>
                      <span className="text-sm font-mono text-zinc-500">{item.count} · {pct}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: colors[id] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Compliance status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-sm font-medium text-zinc-300 mb-4">Compliance Status</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'GDPR Art. 30', desc: 'Records of processing', ok: true },
              { label: 'CCPA §1798.100', desc: 'Consumer rights', ok: true },
              { label: 'ISO 27001', desc: 'Audit trail maintained', ok: true },
              { label: 'Data Minimization', desc: 'Art. 5(1)(c)', ok: (s.avgRiskScore||0) < 80 },
            ].map(({ label, desc, ok }) => (
              <div key={label}
                className={`flex items-start gap-3 p-4 rounded-xl border ${
                  ok ? 'bg-emerald-950/30 border-emerald-900/50' : 'bg-red-950/30 border-red-900/50'
                }`}>
                <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}>
                  <span className="text-white text-xs font-bold">{ok ? '✓' : '!'}</span>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${ok ? 'text-emerald-400' : 'text-red-400'}`}>{label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
