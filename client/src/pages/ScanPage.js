/**
 * DeepDetect — Scan & Sanitize Page
 * Professional B2B redesign
 */
import React, { useState, useCallback, useRef } from 'react';
import { Zap, Copy, Check, Info, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import RiskMeter from '../components/RiskMeter';
import FileUpload from '../components/FileUpload';
import {
  sanitizeText, sanitizeJSON, sanitizeCSV,
  quickScan, highlightPII,
  SANITIZE_MODES, getSeverityColor,
} from '../utils/SanitizationHelpers';

const DEMO = `Patient Record — 2026-05-01
Name: Dr. Sarah Mitchell
DOB: 03/14/1985
SSN: 482-75-9310
Email: s.mitchell@cityhospital.org
Phone: (415) 823-9012
Credit Card: 4532-1234-5678-9012
IP: 192.168.1.104
Address: 2847 Maple Street, San Francisco, CA 94110`;

export default function ScanPage() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('REDACTION');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('text');
  const [file, setFile] = useState(null);
  const [copied, setCopied] = useState(false);
  const [segments, setSegments] = useState([]);
  const debounce = useRef(null);

  const handleTextChange = (val) => {
    setText(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setSegments(highlightPII(val)), 350);
  };

  const runScan = useCallback(async () => {
    if (tab === 'text' && !text.trim()) { toast.error('Enter some text first'); return; }
    if (tab !== 'text' && !file) { toast.error('Upload a file first'); return; }
    setLoading(true); setResult(null);
    try {
      let data;
      if (tab === 'text') data = await sanitizeText({ text, mode, legalBasis: 'legitimate_interest', purposeOfProcessing: 'PII audit' });
      else if (tab === 'json') data = await sanitizeJSON({ data: JSON.parse(file.content), mode });
      else data = await sanitizeCSV({ csvData: file.content, mode });
      setResult(data);
      toast.success(`${data.summary?.totalPIIFound || 0} PII items found and sanitized`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Scan failed');
    } finally {
      setLoading(false);
    }
  }, [text, mode, tab, file]);

  const handleCopy = async () => {
    const content = result?.sanitizedText || result?.sanitizedCSV || JSON.stringify(result?.sanitizedData, null, 2);
    if (!content) return;
    await navigator.clipboard.writeText(content).catch(() => {});
    setCopied(true);
    toast.success('Copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const quick = text ? quickScan(text) : null;
  const outputContent = result?.sanitizedText || result?.sanitizedCSV
    || (result?.sanitizedData ? JSON.stringify(result.sanitizedData, null, 2) : null);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-800/80 bg-zinc-900/40 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Scan & Sanitize</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Detect and remove PII in real time</p>
        </div>
        <button
          onClick={() => { handleTextChange(DEMO); setTab('text'); }}
          className="px-3 py-1.5 text-sm font-medium text-zinc-400 border border-zinc-700 rounded-lg hover:border-zinc-600 hover:text-zinc-200 transition-all"
        >
          Load demo
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex">

        {/* ── Left: Input ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-zinc-800/80">

          {/* Tab bar */}
          <div className="flex items-center gap-1 px-6 pt-4 border-b border-zinc-800/80 flex-shrink-0">
            {['text', 'json', 'csv'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium rounded-t-md transition-all -mb-px ${
                  tab === t
                    ? 'text-blue-400 border-b-2 border-blue-500 bg-transparent'
                    : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                }`}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Input area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {tab === 'text' && (
              <>
                <textarea
                  value={text}
                  onChange={e => handleTextChange(e.target.value)}
                  placeholder="Paste text containing PII — emails, SSNs, credit cards, phone numbers, names…"
                  className="w-full h-48 font-mono text-sm leading-relaxed text-zinc-300 placeholder-zinc-600 bg-zinc-900 border border-zinc-700 rounded-xl p-4 resize-none outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-600 transition-all"
                />
                <div className="flex justify-end">
                  <span className="text-xs font-mono text-zinc-600">{text.length.toLocaleString()} chars</span>
                </div>

                {/* Live highlight preview */}
                {segments.length > 0 && (
                  <div className="border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
                      <Info size={12} className="text-zinc-600" />
                      <span className="text-xs text-zinc-500 font-medium">Live preview — highlighted PII (client-side only)</span>
                    </div>
                    <div className="p-4 max-h-28 overflow-y-auto font-mono text-sm leading-relaxed text-zinc-400 bg-zinc-950">
                      {segments.map((seg, i) =>
                        seg.type === 'text' ? (
                          <span key={i}>{seg.value}</span>
                        ) : (
                          <mark key={i} title={seg.piiType}
                            className="bg-amber-400/15 text-amber-300 border-b border-amber-500/40 rounded-sm px-0.5 not-italic">
                            {seg.value}
                          </mark>
                        )
                      )}
                    </div>
                  </div>
                )}

                {quick?.hasPII && !result && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-950/30 border border-amber-800/40">
                    <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                    <p className="text-sm text-amber-400">
                      Preview: ~{quick.total} potential PII items detected. Run scan for full analysis.
                    </p>
                  </div>
                )}
              </>
            )}

            {(tab === 'json' || tab === 'csv') && (
              <FileUpload onFileReady={setFile} disabled={loading} />
            )}

            {/* Sanitization Mode */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
                Sanitization Mode
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SANITIZE_MODES.map(m => (
                  <button key={m.id} onClick={() => setMode(m.id)}
                    className={`text-left p-3.5 rounded-xl border transition-all duration-150 ${
                      mode === m.id
                        ? 'border-blue-500/40 bg-blue-950/30 ring-1 ring-blue-500/20'
                        : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/60'
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base leading-none">{m.icon}</span>
                      <span className={`text-sm font-medium ${mode === m.id ? 'text-blue-300' : 'text-zinc-200'}`}>
                        {m.label}
                      </span>
                    </div>
                    <p className={`text-xs leading-snug ${mode === m.id ? 'text-blue-400/70' : 'text-zinc-500'}`}>
                      {m.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Action button */}
            <button onClick={runScan} disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-150 shadow-lg shadow-blue-950/50">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Scanning…</>
              ) : (
                <><Zap size={15} strokeWidth={2.5} />Scan & Sanitize</>
              )}
            </button>
          </div>
        </div>

        {/* ── Right: Results ───────────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden bg-zinc-950">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Risk Meter */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <RiskMeter
                score={result?.summary?.riskScore ?? 0}
                totalPII={result?.summary?.totalPIIFound ?? 0}
                minimizationScore={result?.summary?.dataMinimizationScore ?? 100}
              />
            </div>

            {/* Findings */}
            {result?.findings?.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Findings</span>
                  <span className="text-xs font-mono text-zinc-600">{result.findings.length} items</span>
                </div>
                <div className="divide-y divide-zinc-800/60 max-h-48 overflow-y-auto">
                  {result.findings.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-mono font-medium border ${getSeverityColor(f.severity)}`}>
                        {f.severity.slice(0, 4)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-300 truncate">{f.label}</p>
                        <p className="text-xs font-mono text-zinc-600">{f.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sanitized output */}
            {outputContent && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Output</span>
                  <button onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-200 transition-colors">
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-zinc-400 whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto">
                  {outputContent}
                </pre>
              </div>
            )}

            {/* Compliance stamp */}
            {result?.compliance && (
              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check size={9} className="text-white" strokeWidth={3} />
                  </div>
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Compliant</span>
                </div>
                <div className="grid grid-cols-2 gap-y-1 gap-x-4">
                  {[['GDPR', result.compliance.gdprCompliant], ['CCPA', result.compliance.ccpaCompliant],
                    ['Audit log', result.compliance.auditTrailCreated], ['Legal basis', !!result.compliance.legalBasis],
                  ].map(([label, ok]) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs">
                      <span className={ok ? 'text-emerald-400' : 'text-red-400'}>{ok ? '✓' : '✗'}</span>
                      <span className="text-zinc-400">{label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs font-mono text-zinc-700 mt-3 truncate">ID: {result.scanId}</p>
              </div>
            )}

            {/* Empty state */}
            {!result && !loading && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                  <Zap size={22} className="text-zinc-700" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-zinc-400">Run a scan to see results</p>
                <p className="text-xs text-zinc-600 mt-1">Risk score · findings · sanitized output</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
