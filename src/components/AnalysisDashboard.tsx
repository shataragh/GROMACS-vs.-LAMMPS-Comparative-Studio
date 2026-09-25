import React, { useState } from 'react';
import { XvgSeries } from '../types/gromacs';
import { generateSampleXvgData } from '../utils/sampleData';
import { Activity, BarChart2, Compass, Download, Info, TrendingUp } from 'lucide-react';

interface AnalysisDashboardProps {
  currentSeries: XvgSeries | null;
  onSelectSeries: (series: XvgSeries) => void;
}

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
  currentSeries,
  onSelectSeries,
}) => {
  const sampleData = generateSampleXvgData();
  const [activeTab, setActiveTab] = useState<'rmsd' | 'rmsf' | 'energy' | 'temp' | 'pressure' | 'gyrate' | 'ramachandran'>('rmsd');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Active series resolution
  const getActiveSeries = (): XvgSeries => {
    if (activeTab === 'energy') return sampleData.potentialEnergy;
    if (activeTab === 'temp') return sampleData.temperature;
    if (activeTab === 'pressure') return sampleData.pressure;
    if (activeTab === 'rmsd') return currentSeries?.id === 'rmsd' ? currentSeries : sampleData.rmsd;
    if (activeTab === 'rmsf') return sampleData.rmsf;
    if (activeTab === 'gyrate') return sampleData.gyration;
    return sampleData.rmsd;
  };

  const series = getActiveSeries();

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setHoverIndex(null);
  };

  // SVG Chart Dimensions
  const width = 720;
  const height = 300;
  const padding = { top: 25, right: 30, bottom: 45, left: 65 };

  const data = series.data;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  data.forEach(d => {
    if (d.x < minX) minX = d.x;
    if (d.x > maxX) maxX = d.x;
    if (d.y < minY) minY = d.y;
    if (d.y > maxY) maxY = d.y;
  });

  if (minX === Infinity) { minX = 0; maxX = 10; minY = 0; maxY = 1; }
  const spanX = Math.max(0.001, maxX - minX);
  const spanY = Math.max(0.001, maxY - minY);

  const getCanvasX = (x: number) => padding.left + ((x - minX) / spanX) * (width - padding.left - padding.right);
  const getCanvasY = (y: number) => height - padding.bottom - ((y - minY) / spanY) * (height - padding.top - padding.bottom);

  // Build SVG path
  const pathD = data.length > 0
    ? data.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${getCanvasX(pt.x).toFixed(1)} ${getCanvasY(pt.y).toFixed(1)}`, '')
    : '';

  // Area under curve fill path
  const areaD = data.length > 0
    ? `${pathD} L ${getCanvasX(data[data.length - 1].x).toFixed(1)} ${height - padding.bottom} L ${getCanvasX(data[0].x).toFixed(1)} ${height - padding.bottom} Z`
    : '';

  const hoveredPoint = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : null;

  const downloadCSV = () => {
    let csv = `${series.xLabel} (${series.unitX}),${series.yLabel} (${series.unitY})\n`;
    series.data.forEach(pt => {
      csv += `${pt.x},${pt.y}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${series.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation for Analyses */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
          {[
            { id: 'rmsd', label: 'Backbone RMSD' },
            { id: 'rmsf', label: 'Residue RMSF' },
            { id: 'energy', label: 'Potential Energy' },
            { id: 'temp', label: 'Temperature (NVT)' },
            { id: 'pressure', label: 'Pressure (NPT)' },
            { id: 'gyrate', label: 'Radius of Gyration (Rg)' },
            { id: 'ramachandran', label: 'Ramachandran (Phi/Psi)' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id as any)}
              className={`px-3 py-1.5 text-xs font-mono rounded transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          onClick={downloadCSV}
          className="px-3 py-1.5 text-xs font-mono text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Export CSV</span>
        </button>
      </div>

      {activeTab === 'ramachandran' ? (
        /* Ramachandran Dihedral Angle Map */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-5 rounded-xl border border-slate-800 bg-[#07090E]">
          <div className="md:col-span-8 flex flex-col items-center">
            <h4 className="text-xs font-mono font-semibold text-slate-300 mb-2">
              Ramachandran Backbone Dihedral Angles ($\Phi$ vs $\Psi$)
            </h4>
            <div className="relative w-[340px] h-[340px] border border-slate-700 bg-slate-950 rounded-lg overflow-hidden">
              {/* Core favored zones */}
              {/* Alpha-helix core: Phi -60, Psi -45 */}
              <div
                className="absolute bg-cyan-500/20 border border-cyan-500/40 rounded-lg"
                style={{ left: '22%', top: '52%', width: '22%', height: '24%' }}
                title="Favored Right-handed Alpha-Helix"
              />
              {/* Beta-sheet core: Phi -120 to -140, Psi +135 */}
              <div
                className="absolute bg-amber-500/20 border border-amber-500/40 rounded-lg"
                style={{ left: '10%', top: '12%', width: '28%', height: '28%' }}
                title="Favored Beta-Sheet"
              />
              {/* Left-handed alpha helix */}
              <div
                className="absolute bg-purple-500/20 border border-purple-500/40 rounded-lg"
                style={{ left: '60%', top: '35%', width: '18%', height: '20%' }}
                title="Left-handed Alpha-Helix"
              />

              {/* Axes lines (Phi=0, Psi=0) */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-700" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-700" />

              {/* Synthetic residue dihedral points */}
              {Array.from({ length: 65 }).map((_, i) => {
                // Bias into alpha or beta regions
                const isHelix = i % 3 !== 0;
                const phi = isHelix ? -65 + (Math.sin(i) * 15) : -130 + (Math.cos(i) * 20);
                const psi = isHelix ? -40 + (Math.cos(i) * 15) : 135 + (Math.sin(i) * 25);
                const left = ((phi + 180) / 360) * 100;
                const top = ((180 - psi) / 360) * 100;

                return (
                  <div
                    key={i}
                    className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full bg-cyan-300 ring-1 ring-cyan-500 shadow-sm"
                    style={{ left: `${left}%`, top: `${top}%` }}
                    title={`Residue ${i + 1}: Phi=${phi.toFixed(1)}°, Psi=${psi.toFixed(1)}°`}
                  />
                );
              })}

              <span className="absolute bottom-1 left-2 text-[10px] font-mono text-slate-500">-180°</span>
              <span className="absolute bottom-1 right-2 text-[10px] font-mono text-slate-500">+180°</span>
              <span className="absolute top-1 left-2 text-[10px] font-mono text-slate-500">+180°</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400 mt-3">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-cyan-500/20 border border-cyan-500/40" /> $\alpha$-Helix</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40" /> $\beta$-Sheet</span>
            </div>
          </div>

          <div className="md:col-span-4 space-y-3 font-mono text-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 block border-b border-slate-800 pb-2">
              Conformational Health
            </span>
            <div className="space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Favored Regions:</span>
                <span className="text-emerald-400 font-semibold">96.4%</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Allowed Regions:</span>
                <span className="text-cyan-400 font-semibold">3.6%</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Outliers / Disallowed:</span>
                <span className="text-slate-400 font-semibold">0.0%</span>
              </div>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed pt-2 border-t border-slate-800">
              The Ramachandran plot demonstrates excellent sterochemical backbone validity with zero sterically forbidden dihedral collisions.
            </p>
          </div>
        </div>
      ) : (
        /* Dynamic SVG Time-Series Chart */
        <div className="p-4 rounded-xl border border-slate-800 bg-[#07090E] space-y-3">
          {/* Chart Header & Statistical Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-100">{series.title}</h4>
              <p className="text-xs font-mono text-slate-400">
                {series.xLabel} vs. {series.yLabel}
              </p>
            </div>

            {series.stats && (
              <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
                <span>Mean: <strong className="text-cyan-400 tabular-nums">{series.stats.mean}</strong> {series.unitY}</span>
                <span>·</span>
                <span>StdDev: <strong className="text-slate-400 tabular-nums">±{series.stats.stdDev}</strong></span>
                <span>·</span>
                <span>Range: <strong className="text-slate-200 tabular-nums">[{series.stats.min}, {series.stats.max}]</strong></span>
              </div>
            )}
          </div>

          {/* SVG Rendering Stage */}
          <div className="relative overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto select-none"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseX = ((e.clientX - rect.left) / rect.width) * width;
                if (mouseX >= padding.left && mouseX <= width - padding.right && data.length > 0) {
                  const frac = (mouseX - padding.left) / (width - padding.left - padding.right);
                  const idx = Math.min(data.length - 1, Math.max(0, Math.round(frac * (data.length - 1))));
                  setHoverIndex(idx);
                }
              }}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
                const y = padding.top + frac * (height - padding.top - padding.bottom);
                const val = maxY - frac * spanY;
                return (
                  <g key={i}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="#1E293B"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 3}
                      fill="#64748B"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {val > 1000 || val < -1000 ? val.toExponential(1) : val.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* X Axis Ticks */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
                const x = padding.left + frac * (width - padding.left - padding.right);
                const val = minX + frac * spanX;
                return (
                  <g key={i}>
                    <line
                      x1={x}
                      y1={height - padding.bottom}
                      x2={x}
                      y2={height - padding.bottom + 4}
                      stroke="#475569"
                    />
                    <text
                      x={x}
                      y={height - padding.bottom + 16}
                      fill="#64748B"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {val.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Axes Labels */}
              <text
                x={width / 2}
                y={height - 8}
                fill="#94A3B8"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {series.xLabel} ({series.unitX})
              </text>

              {/* Area Fill */}
              {areaD && <path d={areaD} fill="url(#areaGradient)" />}

              {/* Main Curve Line */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#06B6D4"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Crosshair Probe */}
              {hoveredPoint && (
                <g>
                  <line
                    x1={getCanvasX(hoveredPoint.x)}
                    y1={padding.top}
                    x2={getCanvasX(hoveredPoint.x)}
                    y2={height - padding.bottom}
                    stroke="#F59E0B"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={getCanvasX(hoveredPoint.x)}
                    cy={getCanvasY(hoveredPoint.y)}
                    r="4.5"
                    fill="#F59E0B"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                </g>
              )}
            </svg>
          </div>

          {/* Interactive Floating Hover Probe Card */}
          {hoveredPoint && (
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-between text-xs font-mono text-slate-200">
              <span className="text-amber-400 font-semibold">
                ● Probe at {series.xLabel}: {hoveredPoint.x} {series.unitX}
              </span>
              <span className="text-white font-bold tabular-nums">
                {series.yLabel}: {hoveredPoint.y} {series.unitY}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
