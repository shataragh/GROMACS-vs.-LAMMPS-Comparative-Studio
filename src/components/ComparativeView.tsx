import React, { useState } from 'react';
import { MoleculeStructure, SimulationProtocol, LammpsProtocol } from '../types/gromacs';
import { generateProductionMdp, generateMinimMdp, generateNvtMdp, generateNptMdp } from '../utils/mdpGenerator';
import { generateLammpsInput, convertGromacsToLammpsProtocol } from '../utils/lammpsGenerator';
import { ArrowLeftRight, Check, CheckCircle2, ChevronRight, Copy, Cpu, Flame, Layers, Scale, Sparkles, Terminal, Zap } from 'lucide-react';

interface ComparativeViewProps {
  structure: MoleculeStructure | null;
  protocol: SimulationProtocol;
  lammpsProtocol: LammpsProtocol;
  onUpdateLammpsProtocol: (protocol: LammpsProtocol) => void;
  onSelectEngine: (engine: 'gromacs' | 'lammps') => void;
}

export const ComparativeView: React.FC<ComparativeViewProps> = ({
  structure,
  protocol,
  lammpsProtocol,
  onUpdateLammpsProtocol,
  onSelectEngine,
}) => {
  const [activeStage, setActiveStage] = useState<'minim' | 'nvt' | 'npt' | 'prod'>('prod');
  const [copiedSide, setCopiedSide] = useState<'gmx' | 'lmp' | null>(null);

  // Unit converter state
  const [convVal, setConvVal] = useState<number>(100);
  const [convType, setConvType] = useState<'energy' | 'length' | 'pressure'>('energy');

  const gmxCode = activeStage === 'minim'
    ? generateMinimMdp(protocol)
    : activeStage === 'nvt'
    ? generateNvtMdp(protocol)
    : activeStage === 'npt'
    ? generateNptMdp(protocol)
    : generateProductionMdp(protocol);

  const lmpCode = generateLammpsInput(lammpsProtocol);

  const handleCopy = (side: 'gmx' | 'lmp') => {
    navigator.clipboard.writeText(side === 'gmx' ? gmxCode : lmpCode);
    setCopiedSide(side);
    setTimeout(() => setCopiedSide(null), 2000);
  };

  const handleSyncToLammps = () => {
    const converted = convertGromacsToLammpsProtocol(protocol);
    onUpdateLammpsProtocol(converted);
  };

  return (
    <div className="space-y-6">
      {/* Top Comparative Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* GROMACS Card */}
        <div className="p-4 rounded-xl border border-cyan-800/60 bg-gradient-to-br from-cyan-950/20 to-slate-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs font-mono">
                GMX
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">GROMACS</h3>
                <span className="text-[11px] text-slate-400 font-mono">Biomacromolecular Specialist</span>
              </div>
            </div>
            <button
              onClick={() => onSelectEngine('gromacs')}
              className="px-2.5 py-1 text-xs font-mono rounded bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors"
            >
              Set as Primary
            </button>
          </div>

          <div className="space-y-1.5 text-xs text-slate-300 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Core Specialty:</span>
              <span className="text-slate-200">Proteins, DNA/RNA, Membranes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Unit Standard:</span>
              <span className="text-cyan-400 font-semibold">nm, ps, kJ/mol, bar</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">GPU Offload:</span>
              <span className="text-slate-200">Native PME & Non-bonded</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Workflow Style:</span>
              <span className="text-slate-200">Command Pipeline (pdb2gmx $\rightarrow$ mdrun)</span>
            </div>
          </div>
        </div>

        {/* LAMMPS Card */}
        <div className="p-4 rounded-xl border border-amber-800/60 bg-gradient-to-br from-amber-950/20 to-slate-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs font-mono">
                LMP
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">LAMMPS</h3>
                <span className="text-[11px] text-slate-400 font-mono">Materials & Multiscale Simulator</span>
              </div>
            </div>
            <button
              onClick={() => onSelectEngine('lammps')}
              className="px-2.5 py-1 text-xs font-mono rounded bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition-colors"
            >
              Set as Primary
            </button>
          </div>

          <div className="space-y-1.5 text-xs text-slate-300 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Core Specialty:</span>
              <span className="text-slate-200">Metals, Polymers, Carbon, ReaxFF</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Unit Standard:</span>
              <span className="text-amber-400 font-semibold">real (Å, fs, kcal/mol) / metal (eV)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">GPU Offload:</span>
              <span className="text-slate-200">KOKKOS & GPU Packages</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Workflow Style:</span>
              <span className="text-slate-200">Single Script Pipeline (`in.lammps`)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Code & Protocol Comparison */}
      <div className="rounded-xl border border-slate-800 bg-[#07090E] overflow-hidden space-y-0">
        {/* Comparison Header */}
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200">
              Side-by-Side Protocol & Input Mapping
            </h4>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncToLammps}
              className="px-3 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
              <span>Translate GROMACS $\rightarrow$ LAMMPS</span>
            </button>
          </div>
        </div>

        {/* Dual Code Viewport */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* Left: GROMACS MDP */}
          <div className="flex flex-col">
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-cyan-400 flex items-center gap-1.5">
                <span>GROMACS ({activeStage === 'prod' ? 'md.mdp' : `${activeStage}.mdp`})</span>
              </span>
              <button
                onClick={() => handleCopy('gmx')}
                className="text-[11px] font-mono text-slate-400 hover:text-white flex items-center gap-1"
              >
                {copiedSide === 'gmx' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>Copy MDP</span>
              </button>
            </div>
            <div className="p-4 font-mono text-xs text-slate-300 overflow-y-auto max-h-[380px] bg-[#07090E] leading-relaxed">
              <pre className="whitespace-pre">{gmxCode}</pre>
            </div>
          </div>

          {/* Right: LAMMPS Input Script */}
          <div className="flex flex-col">
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-amber-400 flex items-center gap-1.5">
                <span>LAMMPS (in.lammps)</span>
              </span>
              <button
                onClick={() => handleCopy('lmp')}
                className="text-[11px] font-mono text-slate-400 hover:text-white flex items-center gap-1"
              >
                {copiedSide === 'lmp' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>Copy Script</span>
              </button>
            </div>
            <div className="p-4 font-mono text-xs text-slate-300 overflow-y-auto max-h-[380px] bg-[#07090E] leading-relaxed">
              <pre className="whitespace-pre">{lmpCode}</pre>
            </div>
          </div>
        </div>

        {/* Feature & Syntax Translation Matrix */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 font-mono text-xs">
          <span className="text-slate-400 block mb-2 font-semibold uppercase text-[11px]">
            Key Syntax & Concept Equivalencies
          </span>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase">
                  <th className="py-1.5 pr-4">Concept</th>
                  <th className="py-1.5 pr-4 text-cyan-400">GROMACS (.mdp / CLI)</th>
                  <th className="py-1.5 text-amber-400">LAMMPS (in.lammps)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 text-[11px]">
                <tr>
                  <td className="py-2 pr-4 font-semibold text-slate-400">Time Integrator</td>
                  <td className="py-2 pr-4 text-cyan-300">`integrator = md` (leap-frog)</td>
                  <td className="py-2 text-amber-300">`fix 1 all nve/nvt/npt` (Velocity-Verlet)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-semibold text-slate-400">Thermostat (NVT)</td>
                  <td className="py-2 pr-4 text-cyan-300">`tcoupl = V-rescale` / `Nose-Hoover`</td>
                  <td className="py-2 text-amber-300">`fix 1 all nvt temp Tstart Tstop Tdamp`</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-semibold text-slate-400">Barostat (NPT)</td>
                  <td className="py-2 pr-4 text-cyan-300">`pcoupl = Parrinello-Rahman`</td>
                  <td className="py-2 text-amber-300">`fix 1 all npt ... iso Pstart Pstop Pdamp`</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-semibold text-slate-400">Long-range Coulomb</td>
                  <td className="py-2 pr-4 text-cyan-300">`coulombtype = PME`</td>
                  <td className="py-2 text-amber-300">`kspace_style pppm 1.0e-4`</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-semibold text-slate-400">Bond Constraints</td>
                  <td className="py-2 pr-4 text-cyan-300">`constraints = h-bonds` (LINCS)</td>
                  <td className="py-2 text-amber-300">`fix shake` or rigid body fix</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-semibold text-slate-400">Trajectory Output</td>
                  <td className="py-2 pr-4 text-cyan-300">`nstxout-compressed = 5000` (.xtc)</td>
                  <td className="py-2 text-amber-300">`dump 1 all custom N dump.lammpstrj ...`</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Domain Selection Matrix & Interactive Unit Converter */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Which Engine Should I Use? Matrix */}
        <div className="lg:col-span-7 p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3 font-mono text-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 block border-b border-slate-800/80 pb-2">
            Engine Selection Guide by Domain
          </span>

          <div className="space-y-2.5">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start justify-between gap-3">
              <div>
                <strong className="text-white block font-sans">Solvated Proteins, Enzymes, DNA/RNA</strong>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  GROMACS delivers unmatched single-node and multi-GPU ns/day throughput with optimized PME kernels and virtual sites.
                </p>
              </div>
              <span className="text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 shrink-0 text-[10px]">
                Recommend: GROMACS
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start justify-between gap-3">
              <div>
                <strong className="text-white block font-sans">Metals, Alloys, Crystals (EAM / MEAM)</strong>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Embedded Atom Method (EAM) potentials are native to LAMMPS with extensive alloy libraries and stress-strain deformation fixes.
                </p>
              </div>
              <span className="text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-950 border border-amber-800 shrink-0 text-[10px]">
                Recommend: LAMMPS
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start justify-between gap-3">
              <div>
                <strong className="text-white block font-sans">Graphene, Nanotubes, Carbon Materials</strong>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Tersoff, AIREBO, and bond-order potentials are fully supported and heavily optimized in LAMMPS.
                </p>
              </div>
              <span className="text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-950 border border-amber-800 shrink-0 text-[10px]">
                Recommend: LAMMPS
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start justify-between gap-3">
              <div>
                <strong className="text-white block font-sans">Coarse-Grained Soft Matter (MARTINI)</strong>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Both engines have strong support; GROMACS is preferred for biomolecular MARTINI, while LAMMPS is preferred for general polymers.
                </p>
              </div>
              <span className="text-slate-300 font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 shrink-0 text-[10px]">
                Either Engine
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Unit Converter */}
        <div className="lg:col-span-5 p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4 font-mono text-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 block border-b border-slate-800/80 pb-2">
            Inter-Engine Unit Converter
          </span>

          <div className="flex gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
            {(['energy', 'length', 'pressure'] as const).map(type => (
              <button
                key={type}
                onClick={() => setConvType(type)}
                className={`flex-1 py-1 text-center rounded capitalize transition-colors ${
                  convType === type ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-slate-400 block text-[11px]">Input Value:</label>
            <input
              type="number"
              value={convVal}
              onChange={(e) => setConvVal(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono"
            />
          </div>

          <div className="space-y-2 p-3 bg-slate-950 rounded-lg border border-slate-800">
            {convType === 'energy' && (
              <>
                <div className="flex justify-between">
                  <span className="text-cyan-400">GROMACS (kJ/mol):</span>
                  <span className="text-white font-bold tabular-nums">{convVal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-400">LAMMPS real (kcal/mol):</span>
                  <span className="text-white font-bold tabular-nums">{(convVal / 4.184).toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-400">LAMMPS metal (eV):</span>
                  <span className="text-white font-bold tabular-nums">{(convVal / 96.485).toFixed(4)}</span>
                </div>
              </>
            )}

            {convType === 'length' && (
              <>
                <div className="flex justify-between">
                  <span className="text-cyan-400">GROMACS (nm):</span>
                  <span className="text-white font-bold tabular-nums">{convVal.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-400">LAMMPS (Ångström):</span>
                  <span className="text-white font-bold tabular-nums">{(convVal * 10).toFixed(2)}</span>
                </div>
              </>
            )}

            {convType === 'pressure' && (
              <>
                <div className="flex justify-between">
                  <span className="text-cyan-400">GROMACS (bar):</span>
                  <span className="text-white font-bold tabular-nums">{convVal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-400">LAMMPS real (atm):</span>
                  <span className="text-white font-bold tabular-nums">{(convVal * 0.986923).toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Standard SI (MPa):</span>
                  <span className="text-white font-bold tabular-nums">{(convVal * 0.1).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
