/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GromacsFile, MoleculeStructure, SimulationProtocol, LammpsProtocol, XvgSeries } from './types/gromacs';
import { getSampleMolecule, generateSampleXvgData } from './utils/sampleData';
import { convertGromacsToLammpsProtocol } from './utils/lammpsGenerator';
import { TopBar, NavView } from './components/TopBar';
import { DropZone } from './components/DropZone';
import { MolecularViewer } from './components/MolecularViewer';
import { ProtocolBuilder } from './components/ProtocolBuilder';
import { ComparativeView } from './components/ComparativeView';
import { InteractiveSimulation } from './components/InteractiveSimulation';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { DiagnosticAssistant } from './components/DiagnosticAssistant';
import { ScriptExportModal } from './components/ScriptExportModal';
import { GitHubShowcaseModal } from './components/GitHubShowcaseModal';
import githubBanner from './assets/images/github_project_banner_1790357373350.jpg';
import { Activity, ArrowLeftRight, Box, Download, FileText, FlaskConical, Layers, Scale, ShieldCheck, Zap } from 'lucide-react';

export default function App() {
  // Initial default system is 1AKI Lysozyme
  const initialMolecule = getSampleMolecule('lysozyme');
  const sampleXvg = generateSampleXvgData();

  const [structure, setStructure] = useState<MoleculeStructure | null>(initialMolecule);
  const [currentView, setCurrentView] = useState<NavView>('workspace');
  const [activeEngine, setActiveEngine] = useState<'gromacs' | 'lammps' | 'comparative'>('gromacs');
  const [currentXvg, setCurrentXvg] = useState<XvgSeries | null>(sampleXvg.rmsd);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);

  // File manifest
  const [files, setFiles] = useState<GromacsFile[]>([
    {
      name: '1AKI_lysozyme.pdb',
      size: 84200,
      type: 'structure',
      engine: 'gromacs',
      content: '',
      lastModified: Date.now(),
      parsedSummary: '1001 atoms · 129 residues · Charge: +8',
    },
    {
      name: 'topol.top',
      size: 45000,
      type: 'topology',
      engine: 'gromacs',
      content: '',
      lastModified: Date.now(),
      parsedSummary: 'AMBER99SB-ILDN with TIP3P water',
    },
    {
      name: 'minim.mdp',
      size: 1200,
      type: 'parameter',
      engine: 'gromacs',
      content: '',
      lastModified: Date.now(),
      parsedSummary: 'Steepest descent (emtol = 1000.0)',
    },
    {
      name: 'nvt.mdp',
      size: 1800,
      type: 'parameter',
      engine: 'gromacs',
      content: '',
      lastModified: Date.now(),
      parsedSummary: '100 ps · V-rescale thermostat (300 K)',
    },
    {
      name: 'npt.mdp',
      size: 2100,
      type: 'parameter',
      engine: 'gromacs',
      content: '',
      lastModified: Date.now(),
      parsedSummary: '100 ps · Parrinello-Rahman (1.0 bar)',
    },
    {
      name: 'md.mdp',
      size: 2400,
      type: 'parameter',
      engine: 'gromacs',
      content: '',
      lastModified: Date.now(),
      parsedSummary: '10 ns · PME electrostatics',
    },
    {
      name: 'in.lammps',
      size: 1950,
      type: 'lammps_input',
      engine: 'lammps',
      content: '',
      lastModified: Date.now(),
      parsedSummary: 'units real · atom_style full · PPPM electrostatics',
    },
    {
      name: 'data.lammps',
      size: 92000,
      type: 'lammps_data',
      engine: 'lammps',
      content: '',
      lastModified: Date.now(),
      parsedSummary: '1001 atoms · 12 atom types',
    },
  ]);

  // GROMACS Simulation Protocol Parameters
  const [protocol, setProtocol] = useState<SimulationProtocol>({
    systemName: 'Lysozyme in Water',
    forceField: 'amber99sb-ildn',
    waterModel: 'tip3p',
    boxShape: 'dodecahedron',
    boxPadding: 1.0,
    saltConcentration: 0.15,
    neutralize: true,
    temperature: 300,
    pressure: 1.0,
    minimSteps: 50000,
    nvtLengthPs: 100,
    nptLengthPs: 100,
    prodLengthNs: 10,
    timeStepFs: 2.0,
    pmeCutoff: 1.0,
    pullCodeEnabled: false,
    gpuAcceleration: true,
  });

  // LAMMPS Simulation Protocol Parameters
  const [lammpsProtocol, setLammpsProtocol] = useState<LammpsProtocol>(() =>
    convertGromacsToLammpsProtocol({
      systemName: 'Lysozyme in Water',
      forceField: 'amber99sb-ildn',
      waterModel: 'tip3p',
      boxShape: 'dodecahedron',
      boxPadding: 1.0,
      saltConcentration: 0.15,
      neutralize: true,
      temperature: 300,
      pressure: 1.0,
      minimSteps: 50000,
      nvtLengthPs: 100,
      nptLengthPs: 100,
      prodLengthNs: 10,
      timeStepFs: 2.0,
      pmeCutoff: 1.0,
      pullCodeEnabled: false,
      gpuAcceleration: true,
    })
  );

  const handleStructureLoaded = (newMol: MoleculeStructure) => {
    setStructure(newMol);
    setProtocol((prev) => ({
      ...prev,
      systemName: newMol.name,
    }));
    setLammpsProtocol((prev) => ({
      ...prev,
      systemName: `${newMol.name} (LAMMPS)`,
    }));
  };

  const handleSelectEngine = (engine: 'gromacs' | 'lammps') => {
    setActiveEngine(engine);
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col font-sans selection:bg-cyan-900 selection:text-cyan-100">
      {/* Top Bar (Constitution Zone Contract) */}
      <TopBar
        currentView={currentView}
        onSelectView={setCurrentView}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenGitHubModal={() => setIsGitHubModalOpen(true)}
        systemName={structure?.name || 'Empty System'}
        activeEngine={activeEngine}
        onSelectEngine={handleSelectEngine}
      />

      {/* Main Workspace Content */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Workspace Overview & Ingestion */}
        {currentView === 'workspace' && (
          <div className="space-y-6">
            {/* System Status Banner */}
            {structure && (
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <FlaskConical className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white font-sans">
                      {structure.name}
                    </h2>
                    <div className="flex items-center gap-2 text-slate-400 mt-0.5">
                      <span>Source: {structure.filename}</span>
                      <span>·</span>
                      <span className="text-cyan-400 font-semibold">{structure.chains.length} Chain{structure.chains.length > 1 ? 's' : ''} ({structure.chains.join(', ')})</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-slate-300">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Atoms</span>
                    <span className="text-white font-bold tabular-nums text-sm">{structure.numAtoms}</span>
                  </div>
                  <div className="w-px h-6 bg-slate-800" />
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Residues</span>
                    <span className="text-white font-bold tabular-nums text-sm">{structure.numResidues}</span>
                  </div>
                  <div className="w-px h-6 bg-slate-800" />
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Net Charge</span>
                    <span className={`font-bold tabular-nums text-sm ${structure.totalCharge > 0 ? 'text-cyan-400' : (structure.totalCharge < 0 ? 'text-amber-400' : 'text-slate-200')}`}>
                      {structure.totalCharge > 0 ? `+${structure.totalCharge}` : structure.totalCharge} e
                    </span>
                  </div>
                  <div className="w-px h-6 bg-slate-800" />
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Box Dimensions</span>
                    <span className="text-slate-200 tabular-nums">
                      {structure.box ? `${(structure.box.x/10).toFixed(1)} × ${(structure.box.y/10).toFixed(1)} × ${(structure.box.z/10).toFixed(1)} nm` : 'Not Defined'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Drag & Drop File Zone (Supports GROMACS & LAMMPS files) */}
            <DropZone
              onLoadStructure={handleStructureLoaded}
              onLoadXvg={setCurrentXvg}
              onFilesUpdated={setFiles}
              files={files}
              onSelectEngine={handleSelectEngine}
            />

            {/* Quick Structure Preview & Protocol Summary Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="font-semibold uppercase text-slate-300">Interactive 3D Molecular Preview</span>
                  <button
                    onClick={() => setCurrentView('structure')}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold"
                  >
                    Open Full Viewport →
                  </button>
                </div>
                <MolecularViewer structure={structure} height="420px" />
              </div>

              <div className="lg:col-span-5 space-y-4">
                {/* Engine Comparison & Quick Switcher Card */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <span className="font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-cyan-400" />
                      <span>MD Engine Setup</span>
                    </span>
                    <button
                      onClick={() => setCurrentView('comparative')}
                      className="text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      Compare Side-by-Side →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div
                      onClick={() => setActiveEngine('gromacs')}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        activeEngine === 'gromacs'
                          ? 'border-cyan-500/60 bg-cyan-950/30'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-950'
                      }`}
                    >
                      <span className="text-cyan-400 font-bold block text-sm">GROMACS</span>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        {protocol.forceField} · {protocol.waterModel}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Best for biomolecules & liquid boxes
                      </span>
                    </div>

                    <div
                      onClick={() => setActiveEngine('lammps')}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        activeEngine === 'lammps'
                          ? 'border-amber-500/60 bg-amber-950/30'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-950'
                      }`}
                    >
                      <span className="text-amber-400 font-bold block text-sm">LAMMPS</span>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        {lammpsProtocol.units} units · {lammpsProtocol.atomStyle}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Best for materials, crystals & polymers
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-slate-300 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Target Temp / Pressure:</span>
                      <span className="text-white font-medium">{protocol.temperature} K / {protocol.pressure} bar</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Production Length:</span>
                      <span className="text-cyan-400 font-bold">{protocol.prodLengthNs} ns ({protocol.timeStepFs} fs dt)</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex gap-2">
                    <button
                      onClick={() => setCurrentView('comparative')}
                      className="flex-1 py-2 text-center text-xs font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Compare Engines</span>
                    </button>
                    <button
                      onClick={() => setIsExportOpen(true)}
                      className="flex-1 py-2 text-center text-xs font-mono font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Bundle</span>
                    </button>
                  </div>
                </div>

                {/* Pedagogical Feature Card */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
                    <Zap className="w-4 h-4" />
                    <span className="font-semibold uppercase">Real-Time In-Browser MD</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Test forces, thermal vibration, and energy conservation right in your browser with our built-in Velocity-Verlet simulation engine.
                  </p>
                  <button
                    onClick={() => setCurrentView('simulation')}
                    className="text-xs font-mono text-cyan-400 hover:text-cyan-300 font-semibold"
                  >
                    Launch Interactive MD Sandbox →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3D Structure View */}
        {currentView === 'structure' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">3D Molecular Structure & Coordinate Inspection</h3>
                <p className="text-xs font-mono text-slate-400">
                  {structure?.name || 'No structure loaded'} · {structure?.numAtoms} atoms · {structure?.numResidues} residues
                </p>
              </div>

              <button
                onClick={() => setCurrentView('workspace')}
                className="text-xs font-mono text-slate-400 hover:text-slate-200"
              >
                ← Back to Workspace
              </button>
            </div>

            <MolecularViewer structure={structure} height="650px" />
          </div>
        )}

        {/* Protocol Builder View */}
        {currentView === 'protocol' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">GROMACS Protocol & Parameter Generator</h3>
                <p className="text-xs font-mono text-slate-400">
                  Generate verified MDP parameters, editconf solvation box commands, and SLURM execution scripts.
                </p>
              </div>

              <button
                onClick={() => setCurrentView('comparative')}
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1.5"
              >
                <span>View LAMMPS Equivalent</span>
                <span>→</span>
              </button>
            </div>

            <ProtocolBuilder
              structure={structure}
              protocol={protocol}
              onUpdateProtocol={setProtocol}
              onOpenExport={() => setIsExportOpen(true)}
            />
          </div>
        )}

        {/* Comparative Engine View (GROMACS vs LAMMPS) */}
        {currentView === 'comparative' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">GROMACS vs. LAMMPS Comparative Studio</h3>
                <p className="text-xs font-mono text-slate-400">
                  Direct side-by-side protocol translation, syntax equivalencies, unit conversion, and domain recommendations.
                </p>
              </div>

              <button
                onClick={() => setIsExportOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors font-mono flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Dual-Engine Bundle</span>
              </button>
            </div>

            <ComparativeView
              structure={structure}
              protocol={protocol}
              lammpsProtocol={lammpsProtocol}
              onUpdateLammpsProtocol={setLammpsProtocol}
              onSelectEngine={handleSelectEngine}
            />
          </div>
        )}

        {/* Real-time MD Simulation */}
        {currentView === 'simulation' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">Live Physics Simulation (Velocity-Verlet MD)</h3>
                <p className="text-xs font-mono text-slate-400">
                  Real-time numerical integration of Lennard-Jones 12-6 potential & harmonic bonds with Berendsen thermostat.
                </p>
              </div>
            </div>

            <InteractiveSimulation structure={structure} />
          </div>
        )}

        {/* Trajectory Analytics View */}
        {currentView === 'analytics' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">Trajectory & Energy Data Analytics (.XVG & LAMMPS Log)</h3>
                <p className="text-xs font-mono text-slate-400">
                  Inspect Backbone RMSD, Residue RMSF, Energy Minimization, NVT Temperature, and Ramachandran plots.
                </p>
              </div>
            </div>

            <AnalysisDashboard
              currentSeries={currentXvg}
              onSelectSeries={setCurrentXvg}
            />
          </div>
        )}

        {/* Diagnostic Troubleshooter View */}
        {currentView === 'diagnostics' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">Simulation Diagnostics & Error Resolution (GROMACS & LAMMPS)</h3>
                <p className="text-xs font-mono text-slate-400">
                  Instant diagnosis and cross-engine equivalents for LINCS warnings, lost atoms, SETTLE errors, and PPPM failures.
                </p>
              </div>
            </div>

            <DiagnosticAssistant />
          </div>
        )}
      </main>

      {/* Script Export Modal */}
      <ScriptExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        structure={structure}
        protocol={protocol}
        lammpsProtocol={lammpsProtocol}
      />

      {/* GitHub Project Showcase & Banner Modal */}
      <GitHubShowcaseModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        imageSrc={githubBanner}
      />
    </div>
  );
}
