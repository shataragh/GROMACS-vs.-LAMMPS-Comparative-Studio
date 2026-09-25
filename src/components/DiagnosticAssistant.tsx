import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Cpu, Lightbulb, Search, Send, Sparkles } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface DiagnosticItem {
  id: string;
  errorName: string;
  engine: 'gromacs' | 'lammps';
  symptom: string;
  rootCause: string;
  solution: string;
  stage: string;
  equivalentInOtherEngine?: string;
}

const COMMON_MD_ERRORS: DiagnosticItem[] = [
  // GROMACS Errors
  {
    id: 'lincs_warning',
    errorName: 'LINCS Warning: Relative constraint deviation',
    engine: 'gromacs',
    symptom: 'Simulation crashes with "Too many LINCS warnings" or infinite coordinate explosion.',
    rootCause: 'Atoms are moving too fast, likely due to steric clashes, insufficient energy minimization, or time step (dt) being too large (> 2 fs without virtual sites).',
    solution: '1. Check the maximum force in EM (`Fmax < 1000 kJ/mol/nm`).\n2. Reduce time step `dt = 0.001` (1 fs) during initial equilibration.\n3. Increase `lincs-order = 6` or `lincs-iter = 2`.\n4. Check if temperature coupling is too tight (set `tau-t = 0.1` or larger).',
    stage: 'Equilibration / Production MD',
    equivalentInOtherEngine: 'LAMMPS: "Lost atoms: original X current Y" or "Out of range atoms"',
  },
  {
    id: 'water_settle',
    errorName: 'Water molecule can not be settled',
    engine: 'gromacs',
    symptom: 'Fatal error: "Water molecule starting at atom X can not be settled".',
    rootCause: 'A water molecule has extreme unphysical forces acting on its O-H bonds, typically caused by severe steric overlap with protein sidechains or ions after `gmx solvate`.',
    solution: '1. Re-run energy minimization with flexible water by adding `define = -DFLEXIBLE` in `minim.mdp`.\n2. Ensure steepest descent minimization runs until `Fmax < 500 kJ/mol/nm`.\n3. Verify box distance is at least 1.0 nm (`gmx editconf -d 1.0`).',
    stage: 'Energy Minimization',
    equivalentInOtherEngine: 'LAMMPS: "Shake atoms missing on proc" or "Fix shake bond distance exceeded"',
  },
  {
    id: 'net_charge',
    errorName: 'System has non-zero total charge',
    engine: 'gromacs',
    symptom: 'grompp gives NOTE or WARNING: "System has non-zero total charge: +4.000000 e".',
    rootCause: 'Using PME electrostatics on a non-neutral box introduces a neutralizing uniform plasma background, which can cause artifacts in free energy and membrane simulations.',
    solution: 'Run `gmx genion` with the `-neutral` flag:\n`echo "SOL" | gmx genion -s ions.tpr -o solv_ions.gro -p topol.top -pname NA -nname CL -neutral`',
    stage: 'System Preparation (gmx genion)',
    equivalentInOtherEngine: 'LAMMPS: "WARNING: System is not charge neutral, net charge = X"',
  },
  {
    id: 'box_cutoff',
    errorName: 'Box size smaller than twice the cut-off',
    engine: 'gromacs',
    symptom: 'Fatal error: "The cut-off length is 1.2 nm, which is larger than half the smallest box vector".',
    rootCause: 'The periodic box shrunk during NPT equilibration or was created too small in `editconf`, causing an atom to interact with its own periodic image.',
    solution: '1. Increase initial box padding in `gmx editconf -d 1.2` (or at least 1.0 nm).\n2. If using Parrinello-Rahman barostat directly from EM, switch to Berendsen or C-rescale for the first 100 ps before Parrinello-Rahman.\n3. Lower `rcoulomb` and `rvdw` to 1.0 nm if allowed by your force field.',
    stage: 'editconf / NPT Equilibration',
    equivalentInOtherEngine: 'LAMMPS: "Communication cutoff too small for ghost atom interaction"',
  },
  {
    id: 'grompp_segfault',
    errorName: 'Segmentation fault or fatal error in grompp',
    engine: 'gromacs',
    symptom: '`gmx grompp` abruptly terminates without a clean error message.',
    rootCause: 'Mismatch between `topol.top` atom counts and coordinate file (`.gro`), or missing atom parameter in force field itp.',
    solution: '1. Open `topol.top` and check the `[ molecules ]` section at the end. The count of Protein, SOL, NA, CL must EXACTLY match the number of residues in the `.gro` file.\n2. Run `gmx check -f system.gro` to verify coordinate integrity.',
    stage: 'gmx grompp',
  },

  // LAMMPS Errors
  {
    id: 'lmp_lost_atoms',
    errorName: 'Lost atoms: original X current Y',
    engine: 'lammps',
    symptom: 'LAMMPS halts during run: "ERROR: Lost atoms: original 32000 current 31985".',
    rootCause: 'Atoms moved outside the simulation box in a single timestep, usually because forces exploded from overlapping atoms or `timestep` is too large.',
    solution: '1. Minimize your structure before dynamics: `minimize 1.0e-4 1.0e-6 1000 10000`.\n2. Reduce timestep: `timestep 0.5` or `1.0` fs for real units.\n3. Verify periodic boundary conditions: `boundary p p p` instead of non-periodic `f f f`.',
    stage: 'Dynamics Run (fix nvt/npt)',
    equivalentInOtherEngine: 'GROMACS: "LINCS Warning / Coordinate Explosion"',
  },
  {
    id: 'lmp_pppm_out_of_range',
    errorName: 'Out of range atoms - cannot compute PPPM',
    engine: 'lammps',
    symptom: 'ERROR: Out of range atoms - cannot compute PPPM (src/KSPACE/pppm.cpp:1894).',
    rootCause: 'Atoms have flown far outside the processor sub-domain mesh due to bad initial velocities or runaway temperature.',
    solution: '1. Check initial geometry with `dump 1 all image 1 snapshot.png`.\n2. In `fix nvt` or `fix npt`, check temperature damp time (`Tdamp`). For `units real`, use `100.0` fs, not `0.1`.\n3. Re-run minimization prior to kspace.',
    stage: 'PPPM Long-Range Electrostatics',
    equivalentInOtherEngine: 'GROMACS: "grid-spacing / PME mesh interpolation failure"',
  },
  {
    id: 'lmp_nan_coords',
    errorName: 'Non-numeric atom coords - simulation unstable',
    engine: 'lammps',
    symptom: 'ERROR on proc 0: Non-numeric atom coords - simulation unstable (src/domain.cpp:520).',
    rootCause: 'Forces or coordinates evaluated to NaN/Inf due to zero division in Lennard-Jones ($r = 0$) or infinite Coulombic force.',
    solution: '1. Check for overlapping atoms in `data.lammps`.\n2. Add `pair_style ...` with a soft potential first: `pair_style soft` to push overlapping atoms apart before turning on Lennard-Jones.',
    stage: 'Energy Minimization / Early MD',
    equivalentInOtherEngine: 'GROMACS: "Step X, will finish... Fmax = inf"',
  },
];

export const DiagnosticAssistant: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEngine, setSelectedEngine] = useState<'all' | 'gromacs' | 'lammps'>('all');
  const [expandedId, setExpandedId] = useState<string | null>('lincs_warning');
  const [userPrompt, setUserPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const filteredErrors = COMMON_MD_ERRORS.filter(
    (e) =>
      (selectedEngine === 'all' || e.engine === selectedEngine) &&
      (e.errorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
       e.symptom.toLowerCase().includes(searchTerm.toLowerCase()) ||
       e.rootCause.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAskAI = async () => {
    if (!userPrompt.trim()) return;
    setIsLoading(true);
    setAiResponse(null);

    try {
      // Check if Gemini API is available
      const apiKey = process.env.GEMINI_API_KEY || (window as any).GEMINI_API_KEY;
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `You are an expert computational biophysicist and GROMACS software engineer. 
Analyze the following GROMACS error, question, or MDP issue:
"${userPrompt}"

Provide a concise, practical diagnosis with:
1. Root Cause
2. Exact GROMACS command or MDP parameter adjustment needed
3. Preventive best practices. Format cleanly in markdown without fluff.`,
        });
        setAiResponse(response.text || 'No response returned from model.');
      } else {
        // Fallback knowledge lookup
        const lower = userPrompt.toLowerCase();
        if (lower.includes('lincs') || lower.includes('step') || lower.includes('explode')) {
          setAiResponse(`### Diagnosis: LINCS / Numerical Instability
**Root Cause**: Your system contains high steric overlaps or the time step is too large for the bonds.
**Actionable Fix**:
1. Check \`minim.mdp\`: ensure \`emtol = 1000.0\` or lower was reached.
2. In \`nvt.mdp\`, set \`dt = 0.001\` (1 fs) for the first 50 ps.
3. Check for overlapping water molecules near protein boundaries.`);
        } else if (lower.includes('water') || lower.includes('settle')) {
          setAiResponse(`### Diagnosis: Water SETTLE Constraint Failure
**Root Cause**: Initial water placement overlapped with a heavy atom.
**Actionable Fix**:
Add \`define = -DFLEXIBLE\` to \`minim.mdp\` to allow flexible water minimization before turning rigid SETTLE back on in NVT.`);
        } else {
          setAiResponse(`### Recommended Diagnostic Steps:
1. Check the end of your \`topol.top\` file to ensure atom counts match the \`.gro\` file.
2. Verify periodic boundary conditions with \`gmx trjconv -pbc mol -center\`.
3. Check the maximum force in energy minimization (\`em.log\`). If $F_{max} > 1000$ kJ/mol/nm, minimization did not converge.`);
        }
      }
    } catch (err: any) {
      setAiResponse(`Diagnostic note: Check that your structure has no overlapping coordinates and that topology molecule counts match the coordinate file.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search & AI Consultation Box */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>AI & Biophysics Simulation Troubleshooter</span>
          </span>
          <span className="text-xs font-mono text-slate-500">GROMACS 2020 - 2024 Engine</span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
            placeholder="Paste GROMACS error (e.g. LINCS warning, water cannot be settled, segfault)..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={handleAskAI}
            disabled={isLoading || !userPrompt.trim()}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded-lg font-mono flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Diagnosing...' : 'Diagnose'}</span>
          </button>
        </div>

        {aiResponse && (
          <div className="p-3.5 rounded-lg bg-slate-950 border border-cyan-800/60 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
            {aiResponse}
          </div>
        )}
      </div>

      {/* Common MD Error Database with Engine Filter */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
              Verified Simulation Error Solutions
            </h4>
            <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded text-[11px] font-mono">
              <button
                onClick={() => setSelectedEngine('all')}
                className={`px-2 py-0.5 rounded transition-colors ${selectedEngine === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
              >
                All Engines
              </button>
              <button
                onClick={() => setSelectedEngine('gromacs')}
                className={`px-2 py-0.5 rounded transition-colors ${selectedEngine === 'gromacs' ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400'}`}
              >
                GROMACS
              </button>
              <button
                onClick={() => setSelectedEngine('lammps')}
                className={`px-2 py-0.5 rounded transition-colors ${selectedEngine === 'lammps' ? 'bg-amber-950 text-amber-300' : 'text-slate-400'}`}
              >
                LAMMPS
              </button>
            </div>
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter errors or keywords..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          {filteredErrors.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                      item.engine === 'lammps'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    }`}>
                      {item.engine}
                    </span>
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block font-mono">
                        {item.errorName}
                      </span>
                      <span className="text-[11px] text-slate-400">Stage: {item.stage}</span>
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-800/60 space-y-2.5 font-mono text-xs">
                    <div>
                      <span className="text-slate-500 font-semibold uppercase text-[10px] block mb-0.5">Symptom</span>
                      <p className="text-slate-300">{item.symptom}</p>
                    </div>

                    <div>
                      <span className="text-slate-500 font-semibold uppercase text-[10px] block mb-0.5">Root Cause</span>
                      <p className="text-slate-300">{item.rootCause}</p>
                    </div>

                    {item.equivalentInOtherEngine && (
                      <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400">
                        <span className="text-slate-500 font-semibold uppercase text-[10px] block">Cross-Engine Equivalent</span>
                        <span>{item.equivalentInOtherEngine}</span>
                      </div>
                    )}

                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-cyan-400 font-semibold uppercase text-[10px] block mb-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-cyan-400" />
                        <span>Recommended Resolution</span>
                      </span>
                      <pre className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {item.solution}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
