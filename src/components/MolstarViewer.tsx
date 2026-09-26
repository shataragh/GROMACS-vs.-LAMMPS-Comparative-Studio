import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MoleculeStructure } from '../types/gromacs';
import { exportStructureToPdb } from '../utils/pdbParser';
import {
  Camera,
  Compass,
  Download,
  ExternalLink,
  Eye,
  Focus,
  Layers,
  Maximize2,
  Minimize2,
  Palette,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  Zap,
  HelpCircle,
  Search,
  Database,
  Split,
} from 'lucide-react';

interface MolstarViewerProps {
  structure: MoleculeStructure | null;
  height?: string;
  onOpenPdbModal?: () => void;
  onTogglePhysicsViewer?: () => void;
  showEngineToggle?: boolean;
}

type VisualStyle = 'cartoon' | 'ball-and-stick' | 'molecular-surface' | 'spacefill' | 'putty';
type ColorScheme = 'secondary' | 'chain' | 'bfactor' | 'element' | 'hydrophobicity';

export const MolstarViewer: React.FC<MolstarViewerProps> = ({
  structure,
  height = '620px',
  onOpenPdbModal,
  onTogglePhysicsViewer,
  showEngineToggle = true,
}) => {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const pluginInstanceRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('cartoon');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('secondary');
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [isLigandFocused, setIsLigandFocused] = useState<boolean>(false);
  const [showSequence, setShowSequence] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [quickPdbInput, setQuickPdbInput] = useState<string>('');
  const [currentBgColor, setCurrentBgColor] = useState<{ r: number; g: number; b: number }>({ r: 7, g: 9, b: 14 }); // Obsidian #07090e

  // Initialize or re-render Mol* viewer
  const initMolstar = useCallback(async () => {
    if (!viewerContainerRef.current) return;
    setIsLoading(true);
    setLoadError(null);

    // Wait for window.PDBeMolstarPlugin to be available
    let attempts = 0;
    while (!(window as any).PDBeMolstarPlugin && attempts < 25) {
      await new Promise(r => setTimeout(r, 150));
      attempts++;
    }

    const PDBeMolstarPlugin = (window as any).PDBeMolstarPlugin;
    if (!PDBeMolstarPlugin) {
      setLoadError('Mol* 3D engine script is still loading. Please check connection or reload.');
      setIsLoading(false);
      return;
    }

    try {
      // Clear previous container contents
      const container = viewerContainerRef.current;
      container.innerHTML = '';

      const targetDiv = document.createElement('div');
      targetDiv.style.width = '100%';
      targetDiv.style.height = '100%';
      targetDiv.style.position = 'relative';
      container.appendChild(targetDiv);

      const viewer = new PDBeMolstarPlugin();
      pluginInstanceRef.current = viewer;

      // Prepare options based on whether we have a PDB ID or custom structure
      const options: any = {
        bgColor: currentBgColor,
        hideCanvasControls: ['selection', 'animation'],
        hideControls: false,
        sequencePanel: showSequence,
        pdbeLink: false,
        loadMaps: false,
        visualStyle: visualStyle,
        lighting: 'matte',
        assemblyId: '1',
      };

      if (structure?.pdbId && !structure.rawPdbText) {
        // Direct RCSB/PDBe entry load
        options.moleculeId = structure.pdbId.toLowerCase();
      } else if (structure) {
        // Custom coordinates data
        const pdbData = structure.rawPdbText || exportStructureToPdb(structure);
        options.customData = {
          data: pdbData,
          format: 'pdb',
          binary: false,
        };
      } else {
        // Fallback demo structure 1AKI
        options.moleculeId = '1aki';
      }

      await viewer.render(targetDiv, options);

      // Listen to load completion
      if (viewer.events && viewer.events.loadComplete) {
        viewer.events.loadComplete.subscribe(() => {
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Failed to initialize Mol* viewer', err);
      setLoadError(err?.message || 'Error rendering structure with Mol*');
      setIsLoading(false);
    }
  }, [structure, visualStyle, currentBgColor, showSequence]);

  useEffect(() => {
    initMolstar();

    return () => {
      // Cleanup viewer if needed
      pluginInstanceRef.current = null;
    };
  }, [initMolstar]);

  // Handle Visual Style changes
  const handleChangeVisualStyle = (style: VisualStyle) => {
    setVisualStyle(style);
    const viewer = pluginInstanceRef.current;
    if (viewer && viewer.visual && viewer.visual.update) {
      try {
        viewer.visual.update({ visualStyle: style });
      } catch (e) {
        initMolstar();
      }
    }
  };

  // Toggle Spin / Auto-rotation
  const handleToggleSpin = () => {
    const viewer = pluginInstanceRef.current;
    if (!viewer) return;

    try {
      if (viewer.plugin && viewer.plugin.canvas3d) {
        const currentSpin = !isSpinning;
        setIsSpinning(currentSpin);
        viewer.plugin.canvas3d.setProps({
          trackball: {
            animate: currentSpin ? { name: 'spin', params: { speed: 1.0 } } : { name: 'off', params: {} },
          },
        });
      }
    } catch (err) {
      console.warn('Spin toggle fallback', err);
      setIsSpinning(!isSpinning);
    }
  };

  // Reset Camera View
  const handleResetCamera = () => {
    const viewer = pluginInstanceRef.current;
    if (!viewer) return;
    try {
      if (viewer.visual && viewer.visual.reset) {
        viewer.visual.reset({ camera: true, theme: false });
      } else if (viewer.plugin && viewer.plugin.canvas3d) {
        viewer.plugin.canvas3d.requestCameraReset();
      }
    } catch (err) {
      console.warn('Reset camera error', err);
    }
  };

  // Focus on Ligand & Binding Pocket (CB-Dock docked pose or native ligand)
  const handleFocusLigand = () => {
    const viewer = pluginInstanceRef.current;
    if (!viewer) return;

    setIsLigandFocused(prev => !prev);

    try {
      if (viewer.visual && viewer.visual.focus) {
        // If we have parsed ligands
        const firstLigand = structure?.ligands?.[0];
        if (firstLigand) {
          viewer.visual.focus({
            auth_seq_id: firstLigand.resSeq,
            auth_asym_id: firstLigand.atoms[0]?.chainID || 'A',
          });
        } else if (structure?.cavityInfo) {
          viewer.visual.reset({ camera: true });
        }
      }
    } catch (err) {
      console.warn('Focus ligand error', err);
    }
  };

  // Capture High-Res Screenshot
  const handleScreenshot = () => {
    const viewer = pluginInstanceRef.current;
    if (!viewer) return;
    try {
      const canvas = viewerContainerRef.current?.querySelector('canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.download = `${structure?.pdbId || structure?.name || 'molstar_structure'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } catch (err) {
      console.error('Screenshot capture failed', err);
    }
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!viewerContainerRef.current) return;
    if (!document.fullscreenElement) {
      viewerContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#07090E] overflow-hidden flex flex-col shadow-2xl relative">
      {/* Mol* Viewer Control Header Bar */}
      <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono z-10">
        {/* Left: Structure Identity & Engine Branding */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>MOL* 3D VIEWER</span>
          </div>

          {structure?.pdbId ? (
            <div className="flex items-center gap-1.5">
              <span className="text-white font-bold px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">
                PDB: {structure.pdbId}
              </span>
              {structure.pdbMetadata?.resolution && (
                <span className="text-slate-400 text-[11px]">
                  {structure.pdbMetadata.resolution} Å
                </span>
              )}
              {structure.pdbMetadata?.experimentalMethod && (
                <span className="hidden sm:inline text-slate-500 text-[11px]">
                  · {structure.pdbMetadata.experimentalMethod}
                </span>
              )}
              <a
                href={`https://www.rcsb.org/structure/${structure.pdbId}`}
                target="_blank"
                rel="noreferrer"
                title="Open entry in Protein Data Bank (rcsb.org)"
                className="text-cyan-400 hover:text-cyan-300 p-0.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            <span className="text-slate-300 font-medium truncate max-w-[200px] sm:max-w-xs">
              {structure?.name || 'Local Molecule'}
            </span>
          )}

          {structure?.hasLigand && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
              Ligand Present
            </span>
          )}

          {structure?.dockingScore !== undefined && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
              Vina {structure.dockingScore} kcal/mol
            </span>
          )}
        </div>

        {/* Center/Right: Representation & Toolbar Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Representation Selector */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
            <button
              onClick={() => handleChangeVisualStyle('cartoon')}
              className={`px-2 py-0.5 rounded transition-colors ${
                visualStyle === 'cartoon' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cartoon
            </button>
            <button
              onClick={() => handleChangeVisualStyle('ball-and-stick')}
              className={`px-2 py-0.5 rounded transition-colors ${
                visualStyle === 'ball-and-stick' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ball & Stick
            </button>
            <button
              onClick={() => handleChangeVisualStyle('molecular-surface')}
              className={`px-2 py-0.5 rounded transition-colors ${
                visualStyle === 'molecular-surface' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Surface
            </button>
            <button
              onClick={() => handleChangeVisualStyle('spacefill')}
              className={`px-2 py-0.5 rounded transition-colors ${
                visualStyle === 'spacefill' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Spacefill
            </button>
          </div>

          {/* Ligand / Pocket Focus button if ligand present */}
          {(structure?.hasLigand || structure?.ligands?.length) && (
            <button
              onClick={handleFocusLigand}
              title="Focus camera directly on docked ligand & binding pocket"
              className={`px-2 py-1 rounded-lg border text-[11px] transition-colors flex items-center gap-1 font-semibold ${
                isLigandFocused
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                  : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/50'
              }`}
            >
              <Focus className="w-3.5 h-3.5" />
              <span>Ligand Pocket</span>
            </button>
          )}

          {/* Spin Auto-Rotation */}
          <button
            onClick={handleToggleSpin}
            title={isSpinning ? 'Pause auto-rotation' : 'Auto-rotate structure'}
            className={`p-1.5 rounded-lg border transition-colors ${
              isSpinning
                ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isSpinning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          {/* Reset Camera */}
          <button
            onClick={handleResetCamera}
            title="Reset camera center and zoom"
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>

          {/* Screenshot */}
          <button
            onClick={handleScreenshot}
            title="Download high-resolution PNG screenshot"
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Separate Chains & Ligand button */}
          {onOpenPdbModal && (
            <button
              onClick={onOpenPdbModal}
              title="Separate favorable chain from protein and ligand"
              className="px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-700/60 text-amber-300 hover:bg-amber-900/50 transition-colors flex items-center gap-1.5 text-[11px] font-bold"
            >
              <Split className="w-3.5 h-3.5 text-amber-400" />
              <span>Separate Chains</span>
            </button>
          )}

          {/* Direct PDB Fetch button */}
          {onOpenPdbModal && (
            <button
              onClick={onOpenPdbModal}
              title="Fetch structure directly from Protein Data Bank (by ID or Name)"
              className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-700/60 text-cyan-300 hover:bg-cyan-900/60 transition-colors flex items-center gap-1.5 text-[11px] font-bold"
            >
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Fetch PDB</span>
            </button>
          )}

          {/* Toggle to Physics Sandbox if requested */}
          {showEngineToggle && onTogglePhysicsViewer && (
            <button
              onClick={onTogglePhysicsViewer}
              title="Switch to Real-Time Interactive Physics Sandbox"
              className="px-2 py-1 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300 hover:bg-amber-900/40 transition-colors flex items-center gap-1 text-[11px]"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Physics Sandbox</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Mol* Canvas Viewport Container */}
      <div
        ref={viewerContainerRef}
        style={{ height }}
        className="w-full bg-[#07090E] relative overflow-hidden"
      >
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-[#07090E]/80 backdrop-blur-xs flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" />
            <div className="text-center font-mono text-xs">
              <span className="text-white font-medium block">
                Loading Mol* 3D Graphics Engine...
              </span>
              <span className="text-slate-400 text-[11px] mt-1 block">
                {structure?.pdbId ? `Streaming mmCIF coordinates for PDB ${structure.pdbId}` : 'Parsing atomic positions & secondary structure ribbons'}
              </span>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {loadError && (
          <div className="absolute top-4 left-4 right-4 z-20 p-3 rounded-lg bg-rose-950/90 border border-rose-800 text-xs font-mono text-rose-200 flex items-center justify-between">
            <span>{loadError}</span>
            <button
              onClick={() => initMolstar()}
              className="px-2 py-1 bg-rose-900 hover:bg-rose-800 rounded text-[11px] text-white"
            >
              Retry Load
            </button>
          </div>
        )}
      </div>

      {/* Footer Info & Mol* Interaction Bar */}
      <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span>
            {structure?.numAtoms ?? 0} atoms · {structure?.numResidues ?? 0} residues · {structure?.chains?.length ?? 1} chains
          </span>
          {structure?.box && (
            <span className="text-slate-500 hidden md:inline">
              Box: {(structure.box.x / 10).toFixed(1)} × {(structure.box.y / 10).toFixed(1)} × {(structure.box.z / 10).toFixed(1)} nm
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-slate-500">
          <span>Left-Drag: Rotate</span>
          <span>·</span>
          <span>Right-Drag: Translate</span>
          <span>·</span>
          <span>Wheel: Zoom / Clip</span>
          <span>·</span>
          <span className="text-cyan-500">Mol* v5 Engine</span>
        </div>
      </div>
    </div>
  );
};
