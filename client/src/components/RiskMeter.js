/**
 * DeepDetect — Risk Meter
 * Animated SVG semicircle gauge with refined styling
 */
import React, { useEffect, useRef, useState } from 'react';

const ARC_R = 80;
const ARC_CIRC = Math.PI * ARC_R;

const RISK_LEVELS = [
  { min: 0,  max: 0,  label: 'Clean',    color: '#22c55e', track: '#166534' },
  { min: 1,  max: 20, label: 'Low',      color: '#84cc16', track: '#3f6212' },
  { min: 21, max: 50, label: 'Medium',   color: '#f59e0b', track: '#78350f' },
  { min: 51, max: 75, label: 'High',     color: '#f97316', track: '#7c2d12' },
  { min: 76, max: 100,label: 'Critical', color: '#ef4444', track: '#7f1d1d' },
];

function getLevel(score) {
  return RISK_LEVELS.find(l => score <= l.max) || RISK_LEVELS[RISK_LEVELS.length - 1];
}

export default function RiskMeter({ score = 0, totalPII = 0, minimizationScore = 100 }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    const from = display;
    const to = score;
    const start = performance.now();
    const dur = 700;
    cancelAnimationFrame(raf.current);
    const tick = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [score]); // eslint-disable-line

  const level = getLevel(display);
  const fill = (display / 100) * ARC_CIRC;
  const gap = ARC_CIRC - fill;

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Gauge */}
      <div className="relative">
        <svg width="200" height="114" viewBox="-4 -4 208 118" className="overflow-visible">
          {/* Track background */}
          <path d="M 10 100 A 80 80 0 0 1 190 100"
            fill="none" stroke="#27272a" strokeWidth="14" strokeLinecap="round" />
          {/* Colored fill */}
          <path d="M 10 100 A 80 80 0 0 1 190 100"
            fill="none"
            stroke={level.color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${fill} ${gap}`}
            style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.34, 1.2, 0.64, 1), stroke 0.4s ease' }}
          />
          {/* Score */}
          <text x="100" y="86" textAnchor="middle"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 36, fontWeight: 500, fill: level.color, transition: 'fill 0.4s' }}>
            {display}
          </text>
          <text x="100" y="104" textAnchor="middle"
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500, fill: '#71717a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {level.label}
          </text>
          {/* Scale labels */}
          <text x="6"   y="114" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: '#52525b' }}>0</text>
          <text x="182" y="114" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: '#52525b' }}>100</text>
        </svg>
      </div>

      {/* Stat row */}
      <div className="w-full flex gap-3">
        <div className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3 text-center">
          <p className="text-xl font-semibold font-mono leading-none" style={{ color: level.color }}>
            {totalPII}
          </p>
          <p className="text-xs text-zinc-500 mt-1 font-medium">PII found</p>
        </div>
        <div className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3 text-center">
          <p className="text-xl font-semibold font-mono leading-none text-blue-400">{minimizationScore}%</p>
          <p className="text-xs text-zinc-500 mt-1 font-medium">Minimized</p>
        </div>
      </div>

      {/* Minimization bar */}
      <div className="w-full">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium text-zinc-400">Data Minimization</span>
          <span className="text-xs font-mono text-blue-400">{minimizationScore}%</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-blue-500 transition-all duration-700"
            style={{ width: `${minimizationScore}%` }} />
        </div>
        <p className="text-xs text-zinc-600 mt-1.5 font-mono">GDPR Art. 5(1)(c) — target ≥ 90%</p>
      </div>

      {/* Level legend */}
      <div className="w-full grid grid-cols-5 gap-1">
        {RISK_LEVELS.map(l => (
          <div key={l.label}
            className="flex flex-col items-center gap-1 py-1.5 rounded-md transition-all"
            style={{
              backgroundColor: display >= l.min && display <= l.max ? l.color + '12' : 'transparent',
              border: `1px solid ${display >= l.min && display <= l.max ? l.color + '40' : 'transparent'}`,
            }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
            <span className="text-xs font-medium" style={{ color: l.color }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
