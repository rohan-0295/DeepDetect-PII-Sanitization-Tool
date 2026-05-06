/**
 * DeepDetect — Audit Log Page
 * Professional B2B redesign
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Filter, Download, RefreshCw, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { fetchAuditLogs, downloadComplianceReport, getRiskColor } from '../utils/SanitizationHelpers';
import toast from 'react-hot-toast';

const MODES = ['', 'REDACTION', 'MASKING', 'HASHING', 'PSEUDONYMIZATION'];
const LEVELS = ['', 'NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function RiskPill({ score, level }) {
  const { text, bg } = getRiskColor(score);
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-medium"
      style={{ backgroundColor: bg + '18', color: bg }}>
      {score} <span className="text-xs opacity-60">· {level}</span>
    </div>
  );
}

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [modeFilter, setModeFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs({ page, limit: 20, mode: modeFilter||undefined, riskLevel: riskFilter||undefined });
      setLogs(data.logs); setPagination(data.pagination);
    } catch { toast.error('Failed to load logs'); }
    finally { setLoading(false); }
  }, [page, modeFilter, riskFilter]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try { await downloadComplianceReport(90); toast.success('Report downloaded'); }
    catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const selectCls = "text-sm font-medium bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 outline-none focus:border-zinc-600 cursor-pointer";

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-800/80 bg-zinc-900/40 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Audit Logs</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Metadata only — zero PII stored at any point</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-500 hover:text-zinc-200 transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            <Download size={13} strokeWidth={2} />
            {exporting ? 'Generating PDF…' : 'Export Compliance PDF'}
          </button>
        </div>
      </div>

      {/* GDPR notice */}
      <div className="mx-6 mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-950/20 border border-blue-900/40 flex-shrink-0">
        <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-300/80 leading-relaxed">
          All audit entries comply with <strong className="text-blue-300">GDPR Article 30</strong> and <strong className="text-blue-300">CCPA §1798.100</strong>.
          IP addresses are stored as one-way SHA-256 hashes. No PII values are recorded at any stage of processing.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 mt-4 mb-3 flex-shrink-0">
        <Filter size={14} className="text-zinc-600" />
        <select value={modeFilter} onChange={e => { setModeFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">All modes</option>
          {MODES.slice(1).map(m => <option key={m} value={m}>{m.charAt(0)+m.slice(1).toLowerCase()}</option>)}
        </select>
        <select value={riskFilter} onChange={e => { setRiskFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">All risk levels</option>
          {LEVELS.slice(1).map(r => <option key={r} value={r}>{r.charAt(0)+r.slice(1).toLowerCase()}</option>)}
        </select>
        <span className="text-sm text-zinc-600 font-mono ml-auto">{pagination.total || 0} entries</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                {['Scan ID', 'Input', 'Mode', 'PII Found', 'Risk', 'Min. Score', 'Timestamp', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading && !logs.length
                ? <tr><td colSpan={8} className="py-16 text-center text-sm text-zinc-600">Loading…</td></tr>
                : logs.length === 0
                  ? <tr><td colSpan={8} className="py-16 text-center text-sm text-zinc-600">No audit entries found</td></tr>
                  : logs.map(log => (
                    <tr key={log._id} className="hover:bg-zinc-900/60 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-zinc-500">{log.scanId?.slice(0,14)}…</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-xs font-mono">{log.inputType}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-zinc-400">{log.sanitizationMode?.charAt(0)+log.sanitizationMode?.slice(1).toLowerCase()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-semibold font-mono ${log.totalPIIFound > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {log.totalPIIFound}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <RiskPill score={log.riskScore} level={log.riskLevel} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono text-blue-400">{log.dataMinimizationScore}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-zinc-500">
                          {new Date(log.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          log.status === 'SUCCESS' ? 'bg-emerald-950/60 text-emerald-400'
                          : log.status === 'FAILED' ? 'bg-red-950/60 text-red-400'
                          : 'bg-amber-950/60 text-amber-400'
                        }`}>{log.status}</span>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={!pagination.hasPrev}
              className="p-2 rounded-lg border border-zinc-700 text-zinc-500 disabled:opacity-30 hover:bg-zinc-800 hover:text-zinc-200 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm text-zinc-500 font-mono">Page {page} of {pagination.pages}</span>
            <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={!pagination.hasNext}
              className="p-2 rounded-lg border border-zinc-700 text-zinc-500 disabled:opacity-30 hover:bg-zinc-800 hover:text-zinc-200 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
