import React, { useState, useEffect } from 'react';
import { MoleculeStructure } from '../types/gromacs';
import {
  fetchPdbFromRcsb,
  POPULAR_PDB_BENCHMARKS,
  PdbBenchmark,
  searchRcsbPdbDetailed,
  PdbSearchHit,
  RcsbMetadata,
} from '../utils/rcsbPdb';
import {
  analyzeChainsAndLigands,
  executeStructureSeparation,
  ChainProfile,
  LigandProfile,
  SeparatedSystemResult,
  SeparationAnalysis,
  SeparationOptions,
} from '../utils/structureSeparation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Database,
  Dna,
  Download,
  ExternalLink,
  FlaskConical,
  Layers,
  Loader2,
  Pill,
  Search,
  Sliders,
  Sparkles,
  Split,
  X,
  Zap,
} from 'lucide-react';

interface PdbFetchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadPdb: (structure: MoleculeStructure, pdbText: string) => void;
  onLoadSeparatedSystem?: (result: SeparatedSystemResult) => void;
  currentPdbId?: string;
  initialStructure?: MoleculeStructure | null;
  initialPdbText?: string;
}

export const PdbFetchModal: React.FC<PdbFetchModalProps> = ({
  isOpen,
  onClose,
  onLoadPdb,
  onLoadSeparatedSystem,
  currentPdbId,
  initialStructure,
  initialPdbText,
}) => {
  // Step 1: 'search' | Step 2: 'separate'
  const [step, setStep] = useState<'search' | 'separate'>('search');
  const [pdbQuery, setPdbQuery] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<'all' | 'id' | 'name'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<PdbSearchHit[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Staged fetched structure awaiting chain separation
  const [stagedStructure, setStagedStructure] = useState<MoleculeStructure | null>(null);
  const [stagedPdbText, setStagedPdbText] = useState<string>('');
  const [separationAnalysis, setSeparationAnalysis] = useState<SeparationAnalysis | null>(null);

  // Separation configuration state
  const [separationMode, setSeparationMode] = useState<SeparationOptions['separationMode']>('favorable_complex');
  const [selectedChainIDs, setSelectedChainIDs] = useState<string[]>([]);
  const [selectedLigandKeys, setSelectedLigandKeys] = useState<string[]>([]);
  const [includeSolvent, setIncludeSolvent] = useState<boolean>(false);

  // If opened with an initial structure to separate, open directly on step 2
  useEffect(() => {
    if (isOpen && initialStructure) {
      setStagedStructure(initialStructure);
      setStagedPdbText(initialPdbText || initialStructure.rawPdbText || '');
      const analysis = analyzeChainsAndLigands(initialStructure);
      setSeparationAnalysis(analysis);
      setSelectedChainIDs([analysis.favorableChainID]);
      const primaryLig = analysis.ligands.find(l => l.isPrimaryDrug) || analysis.ligands[0];
      setSelectedLigandKeys(primaryLig ? [primaryLig.key] : []);
      setStep('separate');
    } else if (isOpen && !initialStructure && step === 'separate' && !stagedStructure) {
      setStep('search');
    }
  }, [isOpen, initialStructure]);

  if (!isOpen) return null;

  // Handle direct fetch by ID or Name
  const handleFetchAndStage = async (queryOrId: string, directSeparate = true) => {
    const clean = queryOrId.trim();
    if (!clean) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { structure, pdbText, separationAnalysis: analysis } = await fetchPdbFromRcsb(clean);
      setStagedStructure(structure);
      setStagedPdbText(pdbText);
      setSeparationAnalysis(analysis);

      // Default favorable chain and primary ligand selection
      setSelectedChainIDs([analysis.favorableChainID]);
      const primaryLig = analysis.ligands.find(l => l.isPrimaryDrug) || analysis.ligands[0];
      setSelectedLigandKeys(primaryLig ? [primaryLig.key] : []);

      setIsLoading(false);

      if (directSeparate) {
        setStep('separate');
      } else {
        // Direct favorable complex load
        applySeparationAndLoad('favorable_complex', structure, analysis, [analysis.favorableChainID], primaryLig ? [primaryLig.key] : []);
      }
    } catch (err: any) {
      console.error('PDB fetch failed', err);
      setErrorMessage(err?.message || `Failed to fetch structure for "${clean}".`);
      setIsLoading(false);
    }
  };

  // Search handler (ID or Name)
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = pdbQuery.trim();
    if (!clean) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const hits = await searchRcsbPdbDetailed(clean);
      setSearchResults(hits);
      setHasSearched(true);
      setIsLoading(false);
    } catch (err: any) {
      setErrorMessage('Search query failed. Please check network connection.');
      setIsLoading(false);
    }
  };

  // Toggle chain selection
  const handleToggleChain = (chainId: string) => {
    setSelectedChainIDs((prev) => {
      if (prev.includes(chainId)) {
        if (prev.length === 1) return prev; // Keep at least one chain
        return prev.filter((c) => c !== chainId);
      }
      return [...prev, chainId];
    });
    setSeparationMode('custom');
  };

  // Toggle ligand selection
  const handleToggleLigand = (ligKey: string) => {
    setSelectedLigandKeys((prev) => {
      if (prev.includes(ligKey)) {
        return prev.filter((k) => k !== ligKey);
      }
      return [...prev, ligKey];
    });
    setSeparationMode('custom');
  };

  // Select Preset Separation Mode
  const handleSelectPresetMode = (mode: SeparationOptions['separationMode']) => {
    setSeparationMode(mode);
    if (!separationAnalysis) return;

    if (mode === 'favorable_complex') {
      setSelectedChainIDs([separationAnalysis.favorableChainID]);
      const primaryLig = separationAnalysis.ligands.find(l => l.isPrimaryDrug) || separationAnalysis.ligands[0];
      setSelectedLigandKeys(primaryLig ? [primaryLig.key] : []);
      setIncludeSolvent(false);
    } else if (mode === 'chain_only') {
      setSelectedChainIDs([separationAnalysis.favorableChainID]);
      setSelectedLigandKeys([]);
      setIncludeSolvent(false);
    } else if (mode === 'ligand_only') {
      const primaryLig = separationAnalysis.ligands.find(l => l.isPrimaryDrug) || separationAnalysis.ligands[0];
      setSelectedLigandKeys(primaryLig ? [primaryLig.key] : []);
      setSelectedChainIDs([separationAnalysis.favorableChainID]);
      setIncludeSolvent(false);
    } else if (mode === 'all') {
      setSelectedChainIDs(separationAnalysis.chains.map(c => c.chainID));
      setSelectedLigandKeys(separationAnalysis.ligands.map(l => l.key));
      setIncludeSolvent(true);
    } else if (mode === 'split_both') {
      setSelectedChainIDs([separationAnalysis.favorableChainID]);
      const primaryLig = separationAnalysis.ligands.find(l => l.isPrimaryDrug) || separationAnalysis.ligands[0];
      setSelectedLigandKeys(primaryLig ? [primaryLig.key] : []);
      setIncludeSolvent(false);
    }
  };

  // Apply separation and load structure into Mol* & App
  const applySeparationAndLoad = (
    overrideMode?: SeparationOptions['separationMode'],
    overrideStruct?: MoleculeStructure,
    overrideAnalysis?: SeparationAnalysis,
    overrideChains?: string[],
    overrideLigands?: string[]
  ) => {
    const struct = overrideStruct || stagedStructure;
    const analysis = overrideAnalysis || separationAnalysis;
    if (!struct || !analysis) return;

    const mode = overrideMode || separationMode;
    const chains = overrideChains || (selectedChainIDs.length > 0 ? selectedChainIDs : [analysis.favorableChainID]);
    const ligands = overrideLigands || selectedLigandKeys;

    const separationResult = executeStructureSeparation(struct, {
      separationMode: mode,
      selectedChainIDs: chains,
      selectedLigandKeys: ligands,
      includeSolvent,
    });

    if (onLoadSeparatedSystem) {
      onLoadSeparatedSystem(separationResult);
    } else {
      onLoadPdb(separationResult.complexStructure, separationResult.complexPdbText);
    }

    onClose();
  };

  // Download separated PDB files directly
  const handleDownloadSeparatedPdb = (type: 'complex' | 'receptor' | 'ligand') => {
    if (!stagedStructure || !separationAnalysis) return;

    const result = executeStructureSeparation(stagedStructure, {
      separationMode,
      selectedChainIDs,
      selectedLigandKeys,
      includeSolvent,
    });

    let content = result.complexPdbText;
    let filename = result.complexFilename;

    if (type === 'receptor') {
      content = result.receptorPdbText;
      filename = result.receptorFilename;
    } else if (type === 'ligand') {
      content = result.ligandPdbText;
      filename = result.ligandFilename;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in font-mono">
      <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              {step === 'search' ? <Database className="w-4 h-4" /> : <Split className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {step === 'search' ? 'Fetch from Protein Data Bank (PDB)' : 'Separate Favorable Chain & Ligand'}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {step === 'search' ? 'ID & Name Fetch' : 'Chain Separation Studio'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {step === 'search'
                  ? 'Fetch structures by PDB ID or protein name, then isolate favorable chains and drug ligands for Mol* 3D Viewer & MD pipelines'
                  : `Isolate favorable receptor chains, bioactive ligands, or clean complexes for ${stagedStructure?.pdbId || stagedStructure?.name}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {step === 'separate' && (
              <button
                onClick={() => setStep('search')}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change Search</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* ======================================================== */}
          {/* STEP 1: SEARCH & FETCH (BY PDB ID OR PROTEIN NAME) */}
          {/* ======================================================== */}
          {step === 'search' && (
            <>
              {/* Direct Search Form */}
              <div className="space-y-3">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={pdbQuery}
                      onChange={(e) => setPdbQuery(e.target.value)}
                      placeholder="Enter 4-character PDB ID (e.g. 6LU7, 1AKI) OR protein name (e.g. protease, lysozyme, spike, DHFR)..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
                      disabled={isLoading}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || !pdbQuery.trim()}
                    className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer shrink-0"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <span>Search & Fetch</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Search Mode Quick Helper Pills */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <span>Search Mode:</span>
                    <button
                      type="button"
                      onClick={() => setPdbQuery('6LU7')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono"
                    >
                      PDB ID (e.g. 6LU7)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPdbQuery('SARS-CoV-2 main protease');
                      }}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300"
                    >
                      Name (e.g. SARS-CoV-2 main protease)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPdbQuery('Lysozyme');
                      }}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300"
                    >
                      Name (e.g. Lysozyme)
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-500">Live RCSB Query API</span>
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-xs text-rose-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Failed to fetch structure</span>
                    <span className="text-slate-300 mt-0.5 block">{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Search Results Grid (by ID or Name) */}
              {hasSearched && searchResults.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                    <span>Matching Structures for "{pdbQuery}"</span>
                    <span className="text-cyan-400">{searchResults.length} entries found</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {searchResults.map((hit) => (
                      <div
                        key={hit.id}
                        className="p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 transition-all flex flex-col justify-between gap-3 group"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-cyan-400 font-mono px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60">
                                {hit.id}
                              </span>
                              {hit.resolution && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                  {hit.resolution}
                                </span>
                              )}
                              {hit.isBenchmark && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                  Featured
                                </span>
                              )}
                            </div>
                            {hit.organism && (
                              <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
                                {hit.organism}
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs font-semibold text-white mt-2 group-hover:text-cyan-300 transition-colors line-clamp-2">
                            {hit.title}
                          </h4>

                          {hit.ligands && hit.ligands.length > 0 && (
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-400">
                              <Pill className="w-3 h-3" />
                              <span>Ligand: {hit.ligands.join(', ')}</span>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                          <button
                            onClick={() => handleFetchAndStage(hit.id, true)}
                            disabled={isLoading}
                            className="flex-1 py-1.5 px-3 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Split className="w-3.5 h-3.5" />
                            <span>Inspect & Separate Chains</span>
                          </button>
                          <button
                            onClick={() => handleFetchAndStage(hit.id, false)}
                            disabled={isLoading}
                            className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            <span>Quick Load</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Curated Benchmarks Selection */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Featured Benchmark Complexes (Ready for Separation)</span>
                  </span>
                  <span className="text-[11px] text-slate-500">1-click inspect & separate</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {POPULAR_PDB_BENCHMARKS.map((bm) => (
                    <div
                      key={bm.id}
                      className="p-3.5 rounded-xl border bg-slate-900/40 hover:bg-slate-900/80 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-2.5"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-cyan-400 font-mono">
                              {bm.id}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {bm.resolution}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400">
                              {bm.category}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">{bm.organism}</span>
                        </div>

                        <h4 className="text-xs font-semibold text-white mt-1.5">
                          {bm.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {bm.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                        <div>
                          {bm.hasLigand ? (
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <Pill className="w-3 h-3" />
                              <span>Ligand: {bm.ligandName}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 flex items-center gap-1">
                              <Dna className="w-3 h-3" />
                              <span>Apo Protein</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleFetchAndStage(bm.id, true)}
                            disabled={isLoading}
                            className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                          >
                            <Split className="w-3 h-3" />
                            <span>Separate Chains</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ======================================================== */}
          {/* STEP 2: FAVORABLE CHAIN & LIGAND SEPARATION STUDIO */}
          {/* ======================================================== */}
          {step === 'separate' && stagedStructure && separationAnalysis && (
            <div className="space-y-5 animate-fade-in">
              {/* Structure Overview Banner */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-cyan-400 font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                      {stagedStructure.pdbId || 'PDB Structure'}
                    </span>
                    <h3 className="text-xs font-semibold text-white">
                      {stagedStructure.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                    <span>Total Atoms: <b className="text-slate-200">{stagedStructure.numAtoms}</b></span>
                    <span>Residues: <b className="text-slate-200">{stagedStructure.numResidues}</b></span>
                    <span>Chains: <b className="text-slate-200">{separationAnalysis.chains.length}</b></span>
                    <span>Ligands: <b className="text-slate-200">{separationAnalysis.ligands.length}</b></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`https://www.rcsb.org/structure/${stagedStructure.pdbId || ''}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 border border-slate-700"
                  >
                    <span>RCSB Entry</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Favorable Chain Scientific Recommendation Callout */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/60 via-slate-900/80 to-slate-900 border border-cyan-500/50 text-xs text-cyan-100 flex items-start gap-3 shadow-md">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 mt-0.5 border border-cyan-500/40">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <div className="font-bold flex items-center gap-2">
                    <span>Favorable Chain Recommendation:</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-400 text-slate-950 font-extrabold text-[11px]">
                      Chain {separationAnalysis.favorableChainID}
                    </span>
                    {separationAnalysis.favorableLigandResName && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px]">
                        Bound Ligand: {separationAnalysis.favorableLigandResName}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {separationAnalysis.summaryRecommendation}
                  </p>
                </div>
              </div>

              {/* Separation Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Choose Separation Strategy</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {/* Mode 1: Favorable Complex */}
                  <button
                    type="button"
                    onClick={() => handleSelectPresetMode('favorable_complex')}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      separationMode === 'favorable_complex'
                        ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Favorable Complex</span>
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Isolates Chain {separationAnalysis.favorableChainID} + active ligand ({separationAnalysis.favorableLigandResName || 'None'}). Strips waters & salts.
                    </p>
                  </button>

                  {/* Mode 2: Favorable Chain Only */}
                  <button
                    type="button"
                    onClick={() => handleSelectPresetMode('chain_only')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      separationMode === 'chain_only'
                        ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-slate-100 flex items-center gap-1">
                      <Dna className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Protein Chain Only</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Apo-receptor protein (Chain {separationAnalysis.favorableChainID}), ideal for docking screens or apo-MD simulations.
                    </p>
                  </button>

                  {/* Mode 3: Ligand Only */}
                  <button
                    type="button"
                    onClick={() => handleSelectPresetMode('ligand_only')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      separationMode === 'ligand_only'
                        ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-slate-100 flex items-center gap-1">
                      <Pill className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Ligand Only</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Extracts small-molecule inhibitor ({separationAnalysis.favorableLigandResName || 'LIG'}) coordinate file for GAFF/CGenFF parameters.
                    </p>
                  </button>

                  {/* Mode 4: Split Both to Files */}
                  <button
                    type="button"
                    onClick={() => handleSelectPresetMode('split_both')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      separationMode === 'split_both'
                        ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-slate-100 flex items-center gap-1">
                      <Split className="w-3.5 h-3.5 text-amber-400" />
                      <span>Split Both (Receptor + Ligand)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Creates both separate <code className="text-cyan-300">receptor.pdb</code> and <code className="text-emerald-300">ligand.pdb</code> in files manifest.
                    </p>
                  </button>

                  {/* Mode 5: All Chains */}
                  <button
                    type="button"
                    onClick={() => handleSelectPresetMode('all')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      separationMode === 'all'
                        ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-slate-100 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Full Asymmetric Unit</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Preserves all {separationAnalysis.chains.length} chains, heteroatoms, and crystal solvent unmodified.
                    </p>
                  </button>

                  {/* Mode 6: Custom */}
                  <button
                    type="button"
                    onClick={() => setSeparationMode('custom')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      separationMode === 'custom'
                        ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-slate-100 flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-slate-300" />
                      <span>Custom Selection</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Manually select individual chains, ligands, and solvent using checkboxes below.
                    </p>
                  </button>
                </div>
              </div>

              {/* Interactive Chain & Ligand Inspector Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Chains Section */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Dna className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Identified Protein Chains ({separationAnalysis.chains.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Click to select/toggle</span>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {separationAnalysis.chains.map((chain) => {
                      const isSelected = selectedChainIDs.includes(chain.chainID);
                      return (
                        <div
                          key={chain.chainID}
                          onClick={() => handleToggleChain(chain.chainID)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-cyan-950/40 border-cyan-500 text-white'
                              : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 bg-slate-900"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs font-mono text-cyan-300">
                                  Chain {chain.chainID}
                                </span>
                                {chain.isFavorable && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    <span>Favorable</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                {chain.numResidues} residues (span {chain.firstResSeq}–{chain.lastResSeq}) · {chain.numAtoms} atoms
                              </span>
                            </div>
                          </div>

                          <div className="text-right text-[11px]">
                            <span className="text-slate-400 block">
                              B-factor: <b className="text-slate-200">{chain.meanBfactor} Å²</b>
                            </span>
                            {chain.boundLigands.length > 0 && (
                              <span className="text-emerald-400 text-[10px] font-medium block">
                                Ligands: {chain.boundLigands.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ligands Section */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Co-Crystallized Ligands ({separationAnalysis.ligands.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Click to include/exclude</span>
                  </div>

                  {separationAnalysis.ligands.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                      No heteroatom ligands or small molecules detected (Apo-protein system)
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {separationAnalysis.ligands.map((lig) => {
                        const isSelected = selectedLigandKeys.includes(lig.key);
                        return (
                          <div
                            key={lig.key}
                            onClick={() => handleToggleLigand(lig.key)}
                            className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-emerald-950/30 border-emerald-500/80 text-white'
                                : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-900"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs font-mono text-emerald-300">
                                    {lig.resName} #{lig.resSeq}
                                  </span>
                                  {lig.isPrimaryDrug && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                                      Active Drug / Inhibitor
                                    </span>
                                  )}
                                  {lig.isSolventOrIon && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                      Buffer / Solvent
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 block mt-0.5">
                                  Chain {lig.chainID} · {lig.atomCount} atoms · {lig.formula}
                                </span>
                              </div>
                            </div>

                            <div className="text-right text-[11px]">
                              {lig.contactChains.length > 0 ? (
                                <span className="text-cyan-400 text-[10px] block">
                                  Contacts Chain {lig.contactChains.join(', ')}
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[10px] block">No protein contact</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Solvent / Water Inclusion Toggle */}
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <FlaskConical className="w-4 h-4 text-cyan-400" />
                  <span>Include Crystallographic Waters (HOH / TIP3) and Buffer Salts</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSolvent}
                    onChange={(e) => setIncludeSolvent(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 bg-slate-900"
                  />
                  <span className="text-[11px] text-slate-400">
                    {includeSolvent ? 'Included' : 'Stripped (Recommended for MD)'}
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            {step === 'search' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>RCSB PDB Live Stream Ready</span>
              </>
            ) : (
              <>
                <span>Selected: </span>
                <span className="text-cyan-300 font-semibold">Chain {selectedChainIDs.join('+') || 'None'}</span>
                <span> + </span>
                <span className="text-emerald-300 font-semibold">{selectedLigandKeys.length} ligand(s)</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {step === 'separate' ? (
              <>
                <button
                  onClick={() => handleDownloadSeparatedPdb('complex')}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Download clean separated PDB file directly to computer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .PDB</span>
                </button>

                <button
                  onClick={() => applySeparationAndLoad()}
                  className="px-5 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-cyan-950 transition-all cursor-pointer"
                >
                  <Split className="w-4 h-4" />
                  <span>Separate & Load into Mol* 3D Viewer</span>
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
