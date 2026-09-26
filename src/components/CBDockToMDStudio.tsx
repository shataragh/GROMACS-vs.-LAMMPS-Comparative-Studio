import React, { useState } from 'react';
import { MoleculeStructure, SimulationProtocol, XvgSeries } from '../types/gromacs';
import { generateProteinLigandBashScript, generateLammpsProteinLigandScript, generateLigandNvtMdp, generateLigandProdMdp, generateLigandPosreItp } from '../utils/dockingWorkflow';
import { generateDockingMdAnalytics, getSampleMolecule } from '../utils/sampleData';
import { MolecularViewer } from './MolecularViewer';
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Flame,
  FlaskConical,
  Layers,
  Lightbulb,
  Maximize2,
  ShieldAlert,
  Sparkles,
  Terminal,
  Zap,
  Database,
} from 'lucide-react';

interface CBDockToMDStudioProps {
  structure: MoleculeStructure | null;
  protocol: SimulationProtocol;
  onUpdateProtocol: (protocol: SimulationProtocol) => void;
  onLoadStructure: (mol: MoleculeStructure) => void;
  onOpenExport: () => void;
  onOpenPdbModal?: () => void;
}

export const CBDockToMDStudio: React.FC<CBDockToMDStudioProps> = ({
  structure,
  protocol,
  onUpdateProtocol,
  onLoadStructure,
  onOpenExport,
  onOpenPdbModal,
}) => {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [activeScriptTab, setActiveScriptTab] = useState<'bash' | 'lammps' | 'nvt_mdp' | 'prod_mdp' | 'posre'>('bash');
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeMetricTab, setActiveMetricTab] = useState<'rmsd' | 'energy' | 'hbonds' | 'distance'>('rmsd');
  const [hoverMetricIndex, setHoverMetricIndex] = useState<number | null>(null);

  // Auto-detect or default ligand name
  const ligandResName = structure?.ligands?.[0]?.resName || protocol.ligandName || 'LIG';
  const dockingScore = structure?.dockingScore !== undefined ? structure.dockingScore : -8.6;
  const cavity = structure?.cavityInfo || { center: [20.8, 31.4, 21.0] as [number, number, number], volume: 486.2, id: 1 };
  const pocketResidues = structure?.bindingPocketResidues || [
    { resName: 'TRP', resSeq: 62, minDistance: 2.85 },
    { resName: 'ASP', resSeq: 52, minDistance: 3.12 },
    { resName: 'GLU', resSeq: 35, minDistance: 3.44 },
    { resName: 'ALA', resSeq: 107, minDistance: 3.78 },
    { resName: 'ASN', resSeq: 59, minDistance: 4.10 },
  ];

  // Post-docking MD analytics series
  const dockingAnalytics = generateDockingMdAnalytics();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const loadCBDockPreset = (preset: '1aki_nag' | 'mpro_paxlovid') => {
    if (preset === '1aki_nag') {
      const mol = getSampleMolecule('cbdock_complex');
      onLoadStructure(mol);
      onUpdateProtocol({
        ...protocol,
        systemName: 'Lysozyme + NAG Inhibitor (CB-Dock Pose)',
        isProteinLigand: true,
        ligandName: 'LIG',
        ligandParamTool: 'gaff_antechamber',
        ligandCharge: 0,
      });
    } else {
      const mol = getSampleMolecule('cbdock_mpro');
      onLoadStructure(mol);
      onUpdateProtocol({
        ...protocol,
        systemName: 'SARS-CoV-2 Mpro + Paxlovid (CB-Dock Pose)',
        isProteinLigand: true,
        ligandName: 'LIG',
        ligandParamTool: 'gaff_antechamber',
        ligandCharge: 0,
      });
    }
  };

  const getActiveScriptContent = (): string => {
    const currentMol = structure || getSampleMolecule('cbdock_complex');
    switch (activeScriptTab) {
      case 'bash':
        return generateProteinLigandBashScript(currentMol, protocol, ligandResName);
      case 'lammps':
        return generateLammpsProteinLigandScript(currentMol, protocol);
      case 'nvt_mdp':
        return generateLigandNvtMdp(protocol, ligandResName);
      case 'prod_mdp':
        return generateLigandProdMdp(protocol, ligandResName);
      case 'posre':
        return generateLigandPosreItp(ligandResName, structure?.ligands?.[0]?.atomCount || 45);
      default:
        return '';
    }
  };

  // Metric series selector
  const getSelectedSeries = (): XvgSeries => {
    switch (activeMetricTab) {
      case 'rmsd':
        return dockingAnalytics.ligandRmsd;
      case 'energy':
        return dockingAnalytics.interactionEnergy;
      case 'hbonds':
        return dockingAnalytics.hbondCount;
      case 'distance':
      default:
        return dockingAnalytics.comDistance;
    }
  };

  const metricSeries = getSelectedSeries();
  const mData = metricSeries.data;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  mData.forEach(pt => {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  });
  if (minX === Infinity) { minX = 0; maxX = 10; minY = 0; maxY = 1; }
  const spanX = Math.max(0.001, maxX - minX);
  const spanY = Math.max(0.001, maxY - minY);

  const chartW = 600;
  const chartH = 220;
  const pad = { top: 20, right: 25, bottom: 35, left: 55 };

  const getCanvasX = (x: number) => pad.left + ((x - minX) / spanX) * (chartW - pad.left - pad.right);
  const getCanvasY = (y: number) => chartH - pad.bottom - ((y - minY) / spanY) * (chartH - pad.top - pad.bottom);

  const pathD = mData.length > 0
    ? mData.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${getCanvasX(pt.x).toFixed(1)} ${getCanvasY(pt.y).toFixed(1)}`, '')
    : '';

  const areaD = mData.length > 0
    ? `${pathD} L ${getCanvasX(mData[mData.length - 1].x).toFixed(1)} ${chartH - pad.bottom} L ${getCanvasX(mData[0].x).toFixed(1)} ${chartH - pad.bottom} Z`
    : '';

  const hoveredPt = hoverMetricIndex !== null && mData[hoverMetricIndex] ? mData[hoverMetricIndex] : null;

  return (
    <div className="space-y-6">
      {/* Banner / Header */}
      <div className="p-5 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-900/90 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                Docking to Dynamics Pipeline
              </span>
              <span className="text-xs font-mono text-slate-400">CB-Dock & AutoDock Vina Bridge</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              CB-Dock to Molecular Dynamics Studio
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Automate the notorious transition from static CB-Dock cavity docking to all-atom molecular dynamics: small-molecule ligand parameterization (GAFF2 / CGenFF), dual-thermostat equilibration, position restraints, and post-docking binding stability analytics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="text-slate-400 text-[11px] mr-1">Load Docked Presets:</span>
            <button
              onClick={() => loadCBDockPreset('1aki_nag')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
              <span>1AKI + NAG (-8.6 kcal/mol)</span>
            </button>
            <button
              onClick={() => loadCBDockPreset('mpro_paxlovid')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Mpro + Paxlovid (-9.4 kcal/mol)</span>
            </button>
            {onOpenPdbModal && (
              <button
                onClick={onOpenPdbModal}
                className="px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-700/60 transition-colors flex items-center gap-1.5 font-bold"
              >
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Fetch PDB Complex</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4-Step Interactive Navigation Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 font-mono text-xs">
        {[
          { step: 1, title: '01. Cavity & Pocket', sub: 'CB-Dock Ingestion' },
          { step: 2, title: '02. Parameterization', sub: 'GAFF2 / CGenFF / Topol' },
          { step: 3, title: '03. MD Protocol & Script', sub: 'Dual Temperature & Restraints' },
          { step: 4, title: '04. Dynamic Stability', sub: 'Pose RMSD & Interaction Energy' },
        ].map((item) => (
          <button
            key={item.step}
            onClick={() => setActiveStep(item.step as any)}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeStep === item.step
                ? 'border-cyan-500/60 bg-cyan-950/30 text-white shadow-sm'
                : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-400'
            }`}
          >
            <span className={`block font-semibold ${activeStep === item.step ? 'text-cyan-400' : 'text-slate-300'}`}>
              {item.title}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">{item.sub}</span>
          </button>
        ))}
      </div>

      {/* Main Content Area per Step */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Step 1: Cavity Diagnostics & Ingestion */}
        {activeStep === 1 && (
          <>
            <div className="lg:col-span-6 space-y-4 font-mono text-xs">
              {/* Docking Summary Card */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-cyan-400 font-semibold uppercase flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span>CB-Dock Detected Binding Cavity</span>
                  </span>
                  <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    Cavity #{cavity.id || 1}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px] uppercase">Vina Binding Score</span>
                    <span className="text-emerald-400 font-bold text-base tabular-nums">
                      {dockingScore.toFixed(1)} kcal/mol
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px] uppercase">Cavity Volume</span>
                    <span className="text-white font-bold text-base tabular-nums">
                      {cavity.volume ? `${cavity.volume.toFixed(1)} Å³` : '486.2 Å³'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px] uppercase">Cavity Center</span>
                    <span className="text-slate-300 font-medium text-xs tabular-nums mt-1 block">
                      ({cavity.center[0].toFixed(1)}, {cavity.center[1].toFixed(1)}, {cavity.center[2].toFixed(1)})
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/70 flex items-center justify-between text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Docked Ligand ResName:</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
                      {ligandResName}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    {structure?.ligands?.[0]?.atomCount || 45} Heavy Atoms
                  </div>
                </div>
              </div>

              {/* Interacting Contact Residues */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <span>Binding Pocket Contact Residues (Within 4.5 Å)</span>
                  </span>
                  <span className="text-slate-500 text-[11px]">{pocketResidues.length} Residues Identified</span>
                </div>

                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {pocketResidues.map((res, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-slate-800 text-slate-400 text-[10px] flex items-center justify-center font-bold">
                          {i + 1}
                        </span>
                        <span className="text-white font-semibold">
                          {res.resName} {res.resSeq}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[11px]">Closest Atom:</span>
                        <span className="text-cyan-400 font-bold tabular-nums">
                          {res.minDistance.toFixed(2)} Å
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-800/30 text-[11px] text-cyan-200/90 leading-relaxed flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Why run MD after CB-Dock?</strong> Static docking scores predict binding pose affinity, but only all-atom MD reveals whether hydrogen bonds hold under thermal fluctuation, or if the ligand dissociates from the cavity.
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setActiveStep(2)}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>Proceed to Ligand Parameterization</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="font-semibold uppercase text-slate-300">3D Docked Complex & Binding Pocket</span>
                <span className="text-cyan-400">Ligand highlighted in CPK / Ball-Stick</span>
              </div>
              <MolecularViewer structure={structure} height="480px" />
            </div>
          </>
        )}

        {/* Step 2: Ligand Parameterization (The Critical MD Bridge) */}
        {activeStep === 2 && (
          <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono text-xs">
            <div className="lg:col-span-6 space-y-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-cyan-400 font-semibold uppercase flex items-center gap-1.5">
                    <FlaskConical className="w-4 h-4 text-cyan-400" />
                    <span>Ligand Force Field & Parameterizer</span>
                  </span>
                  <span className="text-slate-500 text-[11px]">The GROMACS pdb2gmx Solution</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-slate-400 block mb-1">
                      Parameterization Tool & Charge Model
                    </label>
                    <select
                      value={protocol.ligandParamTool || 'gaff_antechamber'}
                      onChange={(e) =>
                        onUpdateProtocol({ ...protocol, ligandParamTool: e.target.value as any })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="gaff_antechamber">
                        GAFF2 / Antechamber (ACPYPE) - AM1-BCC Charges (Recommended for AMBER)
                      </option>
                      <option value="cgenff">
                        CGenFF (CHARMM General Force Field) - for CHARMM36m
                      </option>
                      <option value="swissparam">
                        SwissParam (MMFF / CHARMM based)
                      </option>
                      <option value="openff">
                        Open Force Field (Sage / Parsley via openff-toolkit)
                      </option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">
                        Ligand Formal Net Charge
                      </label>
                      <select
                        value={protocol.ligandCharge !== undefined ? protocol.ligandCharge : 0}
                        onChange={(e) =>
                          onUpdateProtocol({ ...protocol, ligandCharge: parseInt(e.target.value, 10) })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value="0">0 (Neutral Ligand)</option>
                        <option value="-1">-1 (Deprotonated / Acidic)</option>
                        <option value="1">+1 (Protonated / Basic)</option>
                        <option value="-2">-2 (Dianion / Phosphate)</option>
                        <option value="2">+2 (Dication)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">
                        Ligand Residue Name (PDB)
                      </label>
                      <input
                        type="text"
                        value={protocol.ligandName || ligandResName}
                        onChange={(e) =>
                          onUpdateProtocol({ ...protocol, ligandName: e.target.value.toUpperCase().slice(0, 3) })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-cyan-500 font-bold"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-2 text-slate-300">
                    <span className="text-slate-400 text-[11px] block font-semibold">
                      Automated Pipeline Operations:
                    </span>
                    <ul className="space-y-1.5 text-[11px] text-slate-300">
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>Extracts <strong className="text-white">receptor.pdb</strong> and <strong className="text-white">{ligandResName}.pdb</strong></span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>Generates <strong className="text-white">{ligandResName}.itp</strong> topology & coordinates (<strong className="text-white">{ligandResName}.gro</strong>)</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>Builds harmonic restraints: <strong className="text-white">posre_{ligandResName}.itp</strong> (1000 kJ/mol nm²)</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>Injects <strong className="text-white">#include "{ligandResName}.itp"</strong> and adds ligand to <strong className="text-white">[ molecules ]</strong></span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setActiveStep(1)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                  ← Back to Cavity
                </button>
                <button
                  onClick={() => setActiveStep(3)}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>Generate MD Scripts & MDPs</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Position Restraint & Topology Preview */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 flex flex-col overflow-hidden h-full">
                <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Ligand Restraint Topology (posre_{ligandResName}.itp)</span>
                  </span>
                  <button
                    onClick={() => handleCopy(generateLigandPosreItp(ligandResName, 15))}
                    className="text-xs text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700 transition-colors flex items-center gap-1"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="p-4 font-mono text-[11px] text-slate-300 overflow-y-auto max-h-[360px] bg-[#07090e] leading-relaxed">
                  <pre className="whitespace-pre">{generateLigandPosreItp(ligandResName, 18)}</pre>
                </div>

                <div className="p-3 border-t border-slate-800 bg-slate-900/40 text-[11px] text-slate-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Essential safeguard: Without <code className="text-cyan-300">-DPOSRES_LIG</code>, docked small molecules commonly blow out of the binding site during initial NVT water relaxation.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Simulation Protocol & Custom Script Generator */}
        {activeStep === 3 && (
          <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono text-xs">
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-cyan-400 font-semibold uppercase flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span>Dual-Thermostat & MD Parameters</span>
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Temperature (K)</label>
                      <input
                        type="number"
                        value={protocol.temperature}
                        onChange={(e) =>
                          onUpdateProtocol({ ...protocol, temperature: parseInt(e.target.value, 10) || 300 })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Pressure (bar)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={protocol.pressure}
                        onChange={(e) =>
                          onUpdateProtocol({ ...protocol, pressure: parseFloat(e.target.value) || 1.0 })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Equilibration Length</label>
                      <input
                        type="number"
                        value={protocol.nvtLengthPs}
                        onChange={(e) =>
                          onUpdateProtocol({ ...protocol, nvtLengthPs: parseInt(e.target.value, 10) || 100 })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">ps (NVT + NPT)</span>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Production MD Length</label>
                      <input
                        type="number"
                        value={protocol.prodLengthNs}
                        onChange={(e) =>
                          onUpdateProtocol({ ...protocol, prodLengthNs: parseFloat(e.target.value) || 10 })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">ns (Unrestrained)</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1.5 text-slate-300">
                    <span className="text-cyan-400 font-semibold block text-[11px]">
                      Dual Temperature Coupling (Index Groups):
                    </span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Automatically groups <code className="text-slate-200">Protein_{ligandResName}</code> and <code className="text-slate-200">Water_and_ions</code> into separate thermostats with V-rescale to eliminate the hot-solvent / frozen-ligand artifact.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 pt-1">
                    <input
                      type="checkbox"
                      checked={protocol.gpuAcceleration}
                      onChange={(e) => onUpdateProtocol({ ...protocol, gpuAcceleration: e.target.checked })}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-950"
                    />
                    <span>GPU acceleration flags (-nb gpu -pme gpu)</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onOpenExport}
                  className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Download ZIP Bundle</span>
                </button>
                <button
                  onClick={() => setActiveStep(4)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <span>Inspect Analytics →</span>
                </button>
              </div>
            </div>

            {/* Script & MDP Viewer */}
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 flex flex-col overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800">
                    {[
                      { id: 'bash', label: 'run_cbdock_to_gmx.sh' },
                      { id: 'lammps', label: 'in.cbdock.lammps' },
                      { id: 'nvt_mdp', label: 'nvt_ligand.mdp' },
                      { id: 'prod_mdp', label: 'md_ligand.mdp' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveScriptTab(tab.id as any)}
                        className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                          activeScriptTab === tab.id
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleCopy(getActiveScriptContent())}
                    className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800 border border-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedCode ? 'Copied' : 'Copy Script'}</span>
                  </button>
                </div>

                <div className="p-4 font-mono text-xs text-slate-300 overflow-y-auto max-h-[460px] bg-[#07090e] leading-relaxed selection:bg-cyan-900 selection:text-cyan-100">
                  <pre className="whitespace-pre">{getActiveScriptContent()}</pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Post-Docking Binding Stability Analytics */}
        {activeStep === 4 && (
          <div className="lg:col-span-12 space-y-4 font-mono text-xs">
            {/* Metric Switcher Bar */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
                {[
                  { id: 'rmsd', label: 'Ligand Pose RMSD (Stability)' },
                  { id: 'energy', label: 'Coul + LJ Interaction Energy' },
                  { id: 'hbonds', label: 'Active Site H-Bonds' },
                  { id: 'distance', label: 'COM to Cavity Center' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setActiveMetricTab(t.id as any); setHoverMetricIndex(null); }}
                    className={`px-3 py-1.5 rounded text-xs transition-colors ${
                      activeMetricTab === t.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">10 ns All-Atom Trajectory Evaluated</span>
              </div>
            </div>

            {/* Interactive SVG Chart Card */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <h4 className="text-white font-semibold text-sm font-sans">{metricSeries.title}</h4>
                    <p className="text-[11px] text-slate-400">
                      {metricSeries.yLabel} vs. {metricSeries.xLabel} ({metricSeries.unitX})
                    </p>
                  </div>
                  {metricSeries.stats && (
                    <div className="flex items-center gap-3 text-[11px] text-slate-300">
                      <span>Mean: <strong className="text-cyan-400">{metricSeries.stats.mean}</strong> {metricSeries.unitY}</span>
                      <span>Min: <strong className="text-white">{metricSeries.stats.min}</strong></span>
                      <span>Max: <strong className="text-white">{metricSeries.stats.max}</strong></span>
                    </div>
                  )}
                </div>

                <div className="relative bg-[#07090e] rounded-lg p-2 border border-slate-800/80 overflow-hidden">
                  <svg
                    viewBox={`0 0 ${chartW} ${chartH}`}
                    className="w-full h-auto cursor-crosshair"
                    onMouseLeave={() => setHoverMetricIndex(null)}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relX = ((e.clientX - rect.left) / rect.width) * chartW;
                      const normX = (relX - pad.left) / (chartW - pad.left - pad.right);
                      const targetX = minX + Math.max(0, Math.min(1, normX)) * spanX;
                      let closestIdx = 0;
                      let closestDiff = Infinity;
                      mData.forEach((pt, i) => {
                        const diff = Math.abs(pt.x - targetX);
                        if (diff < closestDiff) {
                          closestDiff = diff;
                          closestIdx = i;
                        }
                      });
                      setHoverMetricIndex(closestIdx);
                    }}
                  >
                    <defs>
                      <linearGradient id="cbdockAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
                      const y = pad.top + r * (chartH - pad.top - pad.bottom);
                      const val = maxY - r * spanY;
                      return (
                        <g key={i}>
                          <line x1={pad.left} y1={y} x2={chartW - pad.right} y2={y} stroke="#1e293b" strokeDasharray="3,3" />
                          <text x={pad.left - 8} y={y + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
                            {val.toFixed(1)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Area under curve */}
                    {areaD && <path d={areaD} fill="url(#cbdockAreaGrad)" />}

                    {/* Line curve */}
                    {pathD && <path d={pathD} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />}

                    {/* Crosshair probe */}
                    {hoveredPt && (
                      <g>
                        <line
                          x1={getCanvasX(hoveredPt.x)}
                          y1={pad.top}
                          x2={getCanvasX(hoveredPt.x)}
                          y2={chartH - pad.bottom}
                          stroke="#38bdf8"
                          strokeDasharray="2,2"
                        />
                        <circle
                          cx={getCanvasX(hoveredPt.x)}
                          cy={getCanvasY(hoveredPt.y)}
                          r="4"
                          fill="#06b6d4"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                      </g>
                    )}
                  </svg>

                  {hoveredPt && (
                    <div className="absolute top-4 right-4 bg-slate-900/90 border border-cyan-500/40 rounded px-2.5 py-1 text-[11px] text-white backdrop-blur">
                      <span className="text-slate-400">{hoveredPt.x} {metricSeries.unitX}: </span>
                      <strong className="text-cyan-400">{hoveredPt.y} {metricSeries.unitY}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Scientific Verdict & Stability Checklist */}
              <div className="lg:col-span-4 p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3">
                <div className="border-b border-slate-800 pb-2">
                  <span className="text-white font-semibold">Post-Docking Stability Verdict</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">Rigorous MD Validation</span>
                </div>

                <div className="space-y-2.5 text-slate-300">
                  <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/40 space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Pose Stable in Binding Cavity</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Ligand backbone RMSD plateaus at <strong>0.12 nm (1.2 Å)</strong>, well under the 0.20 nm threshold for stable binding.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Binding Enthalpy</span>
                    <span className="text-white font-bold text-sm block">
                      -214 kJ/mol (-51.1 kcal/mol)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Strong electrostatic & dispersion interactions throughout the 10 ns production run.
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Catalytic H-Bonds</span>
                    <span className="text-cyan-400 font-bold text-sm block">
                      3 - 4 Persistent Contacts
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Active site residues maintain &gt;85% hydrogen bonding occupancy over trajectory.
                    </span>
                  </div>
                </div>

                <button
                  onClick={onOpenExport}
                  className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Complete Analysis & Package</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
