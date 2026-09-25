import React, { useState } from 'react';
import { BoxShape, ForceField, MoleculeStructure, SimulationProtocol, WaterModel } from '../types/gromacs';
import { generateIonsMdp, generateMinimMdp, generateNptMdp, generateNvtMdp, generateProductionMdp } from '../utils/mdpGenerator';
import { Check, ChevronRight, Copy, Cpu, Info, Sliders, Sparkles, Terminal } from 'lucide-react';

interface ProtocolBuilderProps {
  structure: MoleculeStructure | null;
  protocol: SimulationProtocol;
  onUpdateProtocol: (protocol: SimulationProtocol) => void;
  onOpenExport: () => void;
}

export const ProtocolBuilder: React.FC<ProtocolBuilderProps> = ({
  structure,
  protocol,
  onUpdateProtocol,
  onOpenExport,
}) => {
  const [activeStage, setActiveStage] = useState<'minim' | 'nvt' | 'npt' | 'prod'>('prod');
  const [copiedStage, setCopiedStage] = useState<string | null>(null);

  const getMdpCodeForStage = (stage: 'minim' | 'nvt' | 'npt' | 'prod'): string => {
    switch (stage) {
      case 'minim':
        return generateMinimMdp(protocol);
      case 'nvt':
        return generateNvtMdp(protocol);
      case 'npt':
        return generateNptMdp(protocol);
      case 'prod':
      default:
        return generateProductionMdp(protocol);
    }
  };

  const handleCopy = (code: string, stage: string) => {
    navigator.clipboard.writeText(code);
    setCopiedStage(stage);
    setTimeout(() => setCopiedStage(null), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left Column: Parameter Configuration & Pipeline Stages */}
      <div className="lg:col-span-6 space-y-4">
        {/* System Topology & Force Field Selection */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span>01. Topology & Force Field</span>
            </span>
            <span className="text-xs text-slate-500 font-mono">pdb2gmx</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1.5">
                Force Field
              </label>
              <select
                value={protocol.forceField}
                onChange={(e) => onUpdateProtocol({ ...protocol, forceField: e.target.value as ForceField })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="amber99sb-ildn">AMBER99SB-ILDN (Recommended for proteins)</option>
                <option value="charmm36m">CHARMM36m (Lipids & proteins)</option>
                <option value="oplsaa">OPLS-AA/L (All-atom)</option>
                <option value="gromos54a7">GROMOS 54a7 (United-atom)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1.5">
                Water Model
              </label>
              <select
                value={protocol.waterModel}
                onChange={(e) => onUpdateProtocol({ ...protocol, waterModel: e.target.value as WaterModel })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="tip3p">TIP3P (Standard 3-site)</option>
                <option value="spce">SPC/E (Extended Simple Point Charge)</option>
                <option value="tip4p">TIP4P (4-site rigid model)</option>
                <option value="opc">OPC (Optimal Point Charge)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Box & Solvation */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span>02. Solvation Box & Ions</span>
            </span>
            <span className="text-xs text-slate-500 font-mono">editconf + genion</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1.5">
                Box Geometry
              </label>
              <select
                value={protocol.boxShape}
                onChange={(e) => onUpdateProtocol({ ...protocol, boxShape: e.target.value as BoxShape })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="cubic">Cubic (Simpler)</option>
                <option value="dodecahedron">Rhombic Dodecahedron (30% less water)</option>
                <option value="triclinic">Triclinic</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1.5">
                Distance to Edge
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.1"
                  min="0.8"
                  max="2.5"
                  value={protocol.boxPadding}
                  onChange={(e) => onUpdateProtocol({ ...protocol, boxPadding: parseFloat(e.target.value) || 1.0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 tabular-nums"
                />
                <span className="text-xs text-slate-500 font-mono">nm</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1.5">
                Salt Conc.
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1.0"
                  value={protocol.saltConcentration}
                  onChange={(e) => onUpdateProtocol({ ...protocol, saltConcentration: parseFloat(e.target.value) || 0.15 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 tabular-nums"
                />
                <span className="text-xs text-slate-500 font-mono">M</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 text-slate-400 font-mono">
            <span>Net System Charge: <strong className="text-white">{structure?.totalCharge !== undefined ? (structure.totalCharge > 0 ? `+${structure.totalCharge}` : structure.totalCharge) : '+2'} e</strong></span>
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={protocol.neutralize}
                onChange={(e) => onUpdateProtocol({ ...protocol, neutralize: e.target.checked })}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-950"
              />
              <span>Neutralize with counterions</span>
            </label>
          </div>
        </div>

        {/* Simulation Physics Controls */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span>03. Dynamics & Ensembles</span>
            </span>
            <span className="text-xs text-slate-500 font-mono">Ensemble Thermodynamics</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">Target Temp</span>
                <span className="text-slate-200 tabular-nums font-semibold">{protocol.temperature} K</span>
              </div>
              <input
                type="range"
                min="270"
                max="400"
                step="5"
                value={protocol.temperature}
                onChange={(e) => onUpdateProtocol({ ...protocol, temperature: parseInt(e.target.value, 10) })}
                className="w-full accent-cyan-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">Target Pressure</span>
                <span className="text-slate-200 tabular-nums font-semibold">{protocol.pressure.toFixed(1)} bar</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.5"
                value={protocol.pressure}
                onChange={(e) => onUpdateProtocol({ ...protocol, pressure: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1.5">
                NVT Length
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="20"
                  max="1000"
                  step="20"
                  value={protocol.nvtLengthPs}
                  onChange={(e) => onUpdateProtocol({ ...protocol, nvtLengthPs: parseInt(e.target.value, 10) || 100 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 tabular-nums"
                />
                <span className="text-xs text-slate-500 font-mono">ps</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1.5">
                NPT Length
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="20"
                  max="1000"
                  step="20"
                  value={protocol.nptLengthPs}
                  onChange={(e) => onUpdateProtocol({ ...protocol, nptLengthPs: parseInt(e.target.value, 10) || 100 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 tabular-nums"
                />
                <span className="text-xs text-slate-500 font-mono">ps</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1.5">
                Production MD
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="500"
                  step="5"
                  value={protocol.prodLengthNs}
                  onChange={(e) => onUpdateProtocol({ ...protocol, prodLengthNs: parseFloat(e.target.value) || 10 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 tabular-nums"
                />
                <span className="text-xs text-slate-500 font-mono">ns</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80 font-mono">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={protocol.gpuAcceleration}
                onChange={(e) => onUpdateProtocol({ ...protocol, gpuAcceleration: e.target.checked })}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-950"
              />
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>GPU Acceleration Flag (-nb gpu -pme gpu)</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Right Column: Live MDP Inspector & One-Click Script Generator */}
      <div className="lg:col-span-6 space-y-4 flex flex-col">
        <div className="flex-1 rounded-xl border border-slate-800 bg-slate-950 flex flex-col overflow-hidden">
          {/* Header tabs for MDP inspection */}
          <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
              {(['minim', 'nvt', 'npt', 'prod'] as const).map((stage) => (
                <button
                  key={stage}
                  onClick={() => setActiveStage(stage)}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                    activeStage === stage
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {stage === 'minim' ? 'minim.mdp' : stage === 'nvt' ? 'nvt.mdp' : stage === 'npt' ? 'npt.mdp' : 'md.mdp'}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleCopy(getMdpCodeForStage(activeStage), activeStage)}
              className="text-xs font-mono text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              {copiedStage === activeStage ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy MDP</span>
                </>
              )}
            </button>
          </div>

          {/* MDP Code Body */}
          <div className="flex-1 p-4 font-mono text-xs text-slate-300 overflow-y-auto max-h-[380px] bg-[#07090e] leading-relaxed selection:bg-cyan-900 selection:text-cyan-100">
            <pre className="whitespace-pre">{getMdpCodeForStage(activeStage)}</pre>
          </div>

          {/* Bottom Execution CTA */}
          <div className="p-3.5 border-t border-slate-800 bg-slate-900/70 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>GROMACS 2022+ syntax validated</span>
            </div>

            <button
              onClick={onOpenExport}
              className="px-4 py-2 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors font-mono font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <span>Export Package (.ZIP & Scripts)</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
