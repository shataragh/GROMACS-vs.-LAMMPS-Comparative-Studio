import React, { useRef, useState } from 'react';
import JSZip from 'jszip';
import { parseGRO, parsePDB } from '../utils/pdbParser';
import { parseGromacsLog, parseXVG } from '../utils/xvgParser';
import { parseLammpsData, parseLammpsLog } from '../utils/lammpsGenerator';
import { GromacsFile, MoleculeStructure, XvgSeries } from '../types/gromacs';
import { getSampleMolecule, generateSampleXvgData } from '../utils/sampleData';
import { fetchPdbFromRcsb } from '../utils/rcsbPdb';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronRight, Database, FileCode, FileText, FlaskConical, FolderArchive, Layers, Loader2, Scale, Search, Sparkles, Split, Terminal, UploadCloud } from 'lucide-react';

interface DropZoneProps {
  onLoadStructure: (mol: MoleculeStructure) => void;
  onLoadXvg: (xvg: XvgSeries) => void;
  onFilesUpdated: (files: GromacsFile[]) => void;
  files: GromacsFile[];
  onSelectEngine?: (engine: 'gromacs' | 'lammps') => void;
  onOpenPdbModal?: () => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onLoadStructure,
  onLoadXvg,
  onFilesUpdated,
  files,
  onSelectEngine,
  onOpenPdbModal,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileFilter, setFileFilter] = useState<'all' | 'gromacs' | 'lammps'>('all');
  const [directPdbInput, setDirectPdbInput] = useState('');
  const [isPdbLoading, setIsPdbLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File): Promise<GromacsFile | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const lowerName = file.name.toLowerCase();

    // Handle ZIP bundles
    if (ext === 'zip') {
      try {
        const zip = await JSZip.loadAsync(file);
        const extractedFiles: GromacsFile[] = [];

        for (const [filename, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;
          const entryExt = filename.split('.').pop()?.toLowerCase() || '';
          const entryLower = filename.toLowerCase();
          const content = await zipEntry.async('string');
          
          let fileType: GromacsFile['type'] = 'other';
          let engine: GromacsFile['engine'] = 'universal';

          if (['pdb', 'gro'].includes(entryExt)) {
            fileType = 'structure';
            engine = 'gromacs';
          } else if (entryLower.startsWith('data.') || entryExt === 'data' || entryExt === 'lmp') {
            fileType = 'lammps_data';
            engine = 'lammps';
          } else if (entryLower.startsWith('in.') || entryExt === 'in') {
            fileType = 'lammps_input';
            engine = 'lammps';
          } else if (['top', 'itp'].includes(entryExt)) {
            fileType = 'topology';
            engine = 'gromacs';
          } else if (['mdp'].includes(entryExt)) {
            fileType = 'parameter';
            engine = 'gromacs';
          } else if (['xvg'].includes(entryExt)) {
            fileType = 'analysis';
            engine = 'gromacs';
          } else if (['log'].includes(entryExt) || entryLower.includes('lammps')) {
            fileType = 'log';
            engine = entryLower.includes('lammps') ? 'lammps' : 'gromacs';
          }

          const gmxFile: GromacsFile = {
            name: filename,
            size: content.length,
            type: fileType,
            engine,
            content,
            lastModified: Date.now(),
          };

          extractedFiles.push(gmxFile);

          // Auto-load primary structure or XVG from ZIP
          if (fileType === 'structure') {
            try {
              const mol = entryExt === 'gro' ? parseGRO(content, filename) : parsePDB(content, filename);
              onLoadStructure(mol);
            } catch (err) {
              console.warn('Failed parsing zip structure', err);
            }
          } else if (fileType === 'lammps_data') {
            try {
              const mol = parseLammpsData(content, filename);
              onLoadStructure(mol);
            } catch (err) {
              console.warn('Failed parsing zip lammps data', err);
            }
          } else if (fileType === 'analysis') {
            try {
              const xvg = parseXVG(content, filename);
              onLoadXvg(xvg);
            } catch (err) {
              console.warn('Failed parsing zip xvg', err);
            }
          }
        }

        onFilesUpdated([...files, ...extractedFiles]);
        setStatusMessage(`Extracted ${extractedFiles.length} simulation files from archive`);
        return null;
      } catch (err) {
        console.error('ZIP extraction error', err);
        setStatusMessage('Error unpacking ZIP archive');
        return null;
      }
    }

    // Handle single text/data files
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = (e.target?.result as string) || '';
        let fileType: GromacsFile['type'] = 'other';
        let engine: GromacsFile['engine'] = 'universal';
        let summary = '';

        if (ext === 'pdb') {
          fileType = 'structure';
          engine = 'gromacs';
          try {
            const mol = parsePDB(content, file.name);
            onLoadStructure(mol);
            summary = `${mol.numAtoms} atoms · ${mol.numResidues} residues · Charge: ${mol.totalCharge > 0 ? '+' : ''}${mol.totalCharge}`;
          } catch (err) {
            summary = 'Error parsing PDB';
          }
        } else if (ext === 'gro') {
          fileType = 'structure';
          engine = 'gromacs';
          try {
            const mol = parseGRO(content, file.name);
            onLoadStructure(mol);
            summary = `${mol.numAtoms} atoms · ${mol.box ? `${(mol.box.x/10).toFixed(1)}x${(mol.box.y/10).toFixed(1)}x${(mol.box.z/10).toFixed(1)} nm` : ''}`;
          } catch (err) {
            summary = 'Error parsing GRO';
          }
        } else if (lowerName.startsWith('data.') || ext === 'data' || content.includes('xlo xhi')) {
          fileType = 'lammps_data';
          engine = 'lammps';
          try {
            const mol = parseLammpsData(content, file.name);
            onLoadStructure(mol);
            summary = `LAMMPS System · ${mol.numAtoms} atoms · Box: ${mol.box?.x}x${mol.box?.y}x${mol.box?.z} Å`;
          } catch (err) {
            summary = 'Error parsing LAMMPS data';
          }
        } else if (lowerName.startsWith('in.') || ext === 'in' || ext === 'lammps') {
          fileType = 'lammps_input';
          engine = 'lammps';
          summary = 'LAMMPS Control Script';
        } else if (['top', 'itp'].includes(ext)) {
          fileType = 'topology';
          engine = 'gromacs';
          summary = 'GROMACS Molecular Topology';
        } else if (ext === 'mdp') {
          fileType = 'parameter';
          engine = 'gromacs';
          summary = 'GROMACS Parameters (MDP)';
        } else if (ext === 'xvg') {
          fileType = 'analysis';
          engine = 'gromacs';
          try {
            const xvg = parseXVG(content, file.name);
            onLoadXvg(xvg);
            summary = `${xvg.data.length} points · ${xvg.yLabel}`;
          } catch (err) {
            summary = 'Error parsing XVG';
          }
        } else if (ext === 'log' || lowerName.includes('lammps')) {
          fileType = 'log';
          if (content.includes('Step') && content.includes('TotEng')) {
            engine = 'lammps';
            const parsed = parseLammpsLog(content);
            const seriesKeys = Object.keys(parsed.series);
            if (seriesKeys.length > 0) {
              onLoadXvg(parsed.series[seriesKeys[0]]);
            }
            summary = `LAMMPS Log (${seriesKeys.length} series extracted)`;
          } else {
            engine = 'gromacs';
            const logInfo = parseGromacsLog(content);
            summary = logInfo.version || 'GROMACS Run Log';
          }
        }

        const gmxFile: GromacsFile = {
          name: file.name,
          size: file.size,
          type: fileType,
          engine,
          content,
          lastModified: file.lastModified,
          parsedSummary: summary,
        };

        resolve(gmxFile);
      };
      reader.readAsText(file);
    });
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsProcessing(true);
    setStatusMessage('Reading input files...');

    const newFiles: GromacsFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = await processFile(fileList[i]);
      if (f) newFiles.push(f);
    }

    if (newFiles.length > 0) {
      onFilesUpdated([...files, ...newFiles]);
      setStatusMessage(`Successfully loaded ${newFiles.length} file${newFiles.length > 1 ? 's' : ''}`);
    }

    setIsProcessing(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const loadPreset = (preset: 'lysozyme' | 'ubiquitin' | 'alanine' | 'graphene' | 'copper' | 'analytics' | 'cbdock_complex' | 'cbdock_mpro') => {
    if (preset === 'analytics') {
      const sample = generateSampleXvgData();
      onLoadXvg(sample.rmsd);
      setStatusMessage('Loaded sample trajectory analytics (RMSD, RMSF, Energy, Rg)');
      return;
    }

    const mol = getSampleMolecule(preset);
    onLoadStructure(mol);

    const isLmp = preset === 'graphene' || preset === 'copper';
    const isDock = preset === 'cbdock_complex' || preset === 'cbdock_mpro';

    const syntheticFile: GromacsFile = {
      name: mol.filename,
      size: 45000,
      type: isLmp ? 'lammps_data' : 'structure',
      engine: isLmp ? 'lammps' : 'gromacs',
      content: '',
      lastModified: Date.now(),
      parsedSummary: isDock
        ? `CB-Dock Complex · ${mol.numAtoms} atoms · Vina Score: ${mol.dockingScore ? `${mol.dockingScore} kcal/mol` : '-8.6 kcal/mol'}`
        : `${mol.numAtoms} atoms · ${isLmp ? 'LAMMPS Structure' : `${mol.numResidues} residues`}`,
    };

    onFilesUpdated([...files.filter(f => f.name !== mol.filename), syntheticFile]);
    setStatusMessage(`Loaded benchmark model: ${mol.name}`);
  };

  const handleDirectPdbFetch = async (targetIdOrName?: string) => {
    const rawInput = (targetIdOrName || directPdbInput).trim();
    if (!rawInput) return;

    setIsPdbLoading(true);
    setStatusMessage(`Searching & fetching structure "${rawInput}" from Protein Data Bank (RCSB)...`);

    try {
      const { structure, pdbText, metadata, separationAnalysis } = await fetchPdbFromRcsb(rawInput);
      onLoadStructure(structure);

      const targetId = structure.pdbId || rawInput.toUpperCase();
      const pdbFile: GromacsFile = {
        name: `${targetId}.pdb`,
        size: pdbText.length,
        type: 'structure',
        engine: 'gromacs',
        content: pdbText,
        lastModified: Date.now(),
        parsedSummary: `RCSB PDB ${targetId} · Favorable Chain: ${separationAnalysis.favorableChainID} · ${structure.numAtoms} atoms · ${structure.numResidues} residues${metadata.resolution ? ` · ${metadata.resolution} Å` : ''}`,
      };

      onFilesUpdated([...files.filter(f => f.name !== `${targetId}.pdb`), pdbFile]);
      setStatusMessage(`Imported ${targetId}: ${metadata.title || structure.name} (Favorable Chain: ${separationAnalysis.favorableChainID}) into Mol* 3D Viewer`);
      setDirectPdbInput('');
    } catch (err: any) {
      console.error('Direct PDB fetch error', err);
      setStatusMessage(`Error fetching "${rawInput}": ${err?.message || 'Check PDB code or name'}`);
    } finally {
      setIsPdbLoading(false);
    }
  };

  const filteredFiles = files.filter(f => {
    if (fileFilter === 'gromacs') return f.engine === 'gromacs';
    if (fileFilter === 'lammps') return f.engine === 'lammps';
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Direct RCSB Protein Data Bank Fetch Card */}
      <div className="p-4 rounded-xl border border-cyan-800/60 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-slate-900/40 space-y-3 font-mono">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Database className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Fetch from Protein Data Bank (RCSB PDB)
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              Direct Live Stream
            </span>
          </div>

          <div className="flex items-center gap-3">
            {onOpenPdbModal && (
              <>
                <button
                  onClick={onOpenPdbModal}
                  className="text-xs text-amber-300 hover:text-amber-200 flex items-center gap-1 font-semibold"
                >
                  <Split className="w-3.5 h-3.5 text-amber-400" />
                  <span>Separate Chains</span>
                </button>
                <button
                  onClick={onOpenPdbModal}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                >
                  <Search className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Search by ID / Name</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Input Form & Instant Quick Pills */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={directPdbInput}
              onChange={(e) => setDirectPdbInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleDirectPdbFetch();
                }
              }}
              placeholder="Enter PDB ID (e.g. 6LU7, 1AKI) or protein name (e.g. Protease, Lysozyme, Spike RBD)..."
              className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono"
              disabled={isPdbLoading}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDirectPdbFetch()}
              disabled={isPdbLoading || !directPdbInput.trim()}
              className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shrink-0"
            >
              {isPdbLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Fetching...</span>
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" />
                  <span>Fetch to Mol*</span>
                </>
              )}
            </button>

            {onOpenPdbModal && (
              <button
                onClick={onOpenPdbModal}
                disabled={isPdbLoading}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 hover:border-cyan-500/50 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 shrink-0"
                title="Separate favorable chain and ligand"
              >
                <Split className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Separate Chains</span>
              </button>
            )}
          </div>
        </div>

        {/* Popular 1-Click PDB Targets */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
          <span className="text-slate-400">Popular Targets:</span>
          {[
            { id: '6LU7', label: '6LU7 (Mpro + N3)', desc: 'Antiviral target' },
            { id: '1AKI', label: '1AKI (Lysozyme)', desc: 'Benchmark protein' },
            { id: '1UBQ', label: '1UBQ (Ubiquitin)', desc: 'Regulatory' },
            { id: '6M0J', label: '6M0J (Spike RBD)', desc: 'ACE2 complex' },
            { id: '4DFR', label: '4DFR (DHFR)', desc: 'Methotrexate drug target' },
            { id: '1MBN', label: '1MBN (Myoglobin)', desc: 'Heme enzyme' },
            { id: '3PBL', label: '3PBL (Dopamine D3)', desc: 'GPCR membrane' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleDirectPdbFetch(item.id)}
              disabled={isPdbLoading}
              title={item.desc}
              className="px-2 py-0.5 rounded bg-slate-900/80 hover:bg-cyan-950 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 transition-colors flex items-center gap-1"
            >
              <span className="text-cyan-400 font-bold">{item.id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Drag & Drop Target Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center group ${
          isDragging
            ? 'border-cyan-400 bg-cyan-950/20'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdb,.gro,.top,.itp,.mdp,.ndx,.xvg,.log,.zip,.in,.data,.lmp,.lammps,.lammpstrj,.pdbqt,.mol2,.sdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Drag & Drop Molecular Dynamics & Docking Files
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xl mx-auto">
              Drop GROMACS (<span className="text-cyan-400 font-mono">.pdb</span>, <span className="text-cyan-400 font-mono">.gro</span>, <span className="text-cyan-400 font-mono">.top</span>, <span className="text-cyan-400 font-mono">.mdp</span>), LAMMPS (<span className="text-amber-400 font-mono">in.*</span>, <span className="text-amber-400 font-mono">data.*</span>), or <strong className="text-white">CB-Dock / AutoDock Vina</strong> complexes (<span className="text-emerald-400 font-mono">docked.pdb</span>, <span className="text-emerald-400 font-mono">.pdbqt</span>, <span className="text-emerald-400 font-mono">.zip</span>).
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <span>CB-Dock cavity detection</span>
            <span>·</span>
            <span>GAFF2 / CGenFF parameterization</span>
            <span>·</span>
            <span>Dual-thermostat MD</span>
          </div>
        </div>
      </div>

      {/* Preset Quick Load Bar */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <FlaskConical className="w-4 h-4 text-cyan-400" />
          <span>Quick Benchmark Presets:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* CB-Dock Presets */}
          <button
            onClick={() => loadPreset('cbdock_complex')}
            className="px-2.5 py-1.5 text-xs font-mono text-emerald-200 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-700/60 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span className="text-emerald-400 text-[10px] font-bold">CB-DOCK</span>
            <span>1AKI + Inhibitor (-8.6 kcal)</span>
          </button>

          <button
            onClick={() => loadPreset('cbdock_mpro')}
            className="px-2.5 py-1.5 text-xs font-mono text-emerald-200 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-700/60 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span className="text-emerald-400 text-[10px] font-bold">CB-DOCK</span>
            <span>Mpro + Paxlovid (-9.4 kcal)</span>
          </button>

          {/* Biomolecular (GROMACS) */}
          <button
            onClick={() => loadPreset('lysozyme')}
            className="px-2.5 py-1.5 text-xs font-mono text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <span className="text-cyan-400 text-[10px]">GMX</span>
            <span>1AKI Lysozyme</span>
          </button>

          <button
            onClick={() => loadPreset('ubiquitin')}
            className="px-2.5 py-1.5 text-xs font-mono text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <span className="text-cyan-400 text-[10px]">GMX</span>
            <span>1UBQ Ubiquitin</span>
          </button>

          {/* Materials & Carbon (LAMMPS) */}
          <button
            onClick={() => loadPreset('graphene')}
            className="px-2.5 py-1.5 text-xs font-mono text-amber-200 bg-amber-950/30 hover:bg-amber-900/40 border border-amber-800/60 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <span className="text-amber-400 text-[10px]">LMP</span>
            <span>Graphene Ribbon</span>
          </button>

          <button
            onClick={() => loadPreset('copper')}
            className="px-2.5 py-1.5 text-xs font-mono text-amber-200 bg-amber-950/30 hover:bg-amber-900/40 border border-amber-800/60 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <span className="text-amber-400 text-[10px]">LMP</span>
            <span>Copper FCC</span>
          </button>

          <button
            onClick={() => loadPreset('analytics')}
            className="px-3 py-1.5 text-xs font-mono text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/60 rounded-lg transition-colors"
          >
            Load Trajectory Data
          </button>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>{statusMessage}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-500 hover:text-slate-300 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Uploaded File Inventory with Engine Filter */}
      {files.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
                Workspace Files ({files.length})
              </span>

              {/* Engine filter segmented control */}
              <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded border border-slate-800 text-[11px] font-mono">
                <button
                  onClick={() => setFileFilter('all')}
                  className={`px-2 py-0.5 rounded transition-colors ${fileFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  All ({files.length})
                </button>
                <button
                  onClick={() => setFileFilter('gromacs')}
                  className={`px-2 py-0.5 rounded transition-colors ${fileFilter === 'gromacs' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/50' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  GROMACS ({files.filter(f => f.engine === 'gromacs').length})
                </button>
                <button
                  onClick={() => setFileFilter('lammps')}
                  className={`px-2 py-0.5 rounded transition-colors ${fileFilter === 'lammps' ? 'bg-amber-950 text-amber-300 border border-amber-800/50' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  LAMMPS ({files.filter(f => f.engine === 'lammps').length})
                </button>
              </div>
            </div>

            <button
              onClick={() => onFilesUpdated([])}
              className="text-xs text-rose-400 hover:text-rose-300 transition-colors font-mono"
            >
              Clear Workspace
            </button>
          </div>

          <div className="divide-y divide-slate-800/60 max-h-52 overflow-y-auto font-mono text-xs">
            {filteredFiles.map((file, idx) => (
              <div
                key={idx}
                className="px-4 py-2 flex items-center justify-between hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 truncate">
                  {file.engine === 'lammps' ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      LMP
                    </span>
                  ) : file.engine === 'gromacs' ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      GMX
                    </span>
                  ) : null}

                  {file.type === 'structure' && <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                  {file.type === 'lammps_data' && <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  {file.type === 'lammps_input' && <Terminal className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  {file.type === 'parameter' && <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                  {file.type === 'topology' && <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                  {file.type === 'analysis' && <FlaskConical className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  {file.type === 'log' && <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  {file.type === 'other' && <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  <span className="text-slate-200 truncate">{file.name}</span>
                </div>

                <div className="flex items-center gap-3 text-slate-400 text-[11px] shrink-0">
                  {file.parsedSummary && (
                    <span className="text-slate-500">{file.parsedSummary}</span>
                  )}
                  <span className="text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
