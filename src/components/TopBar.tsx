import React from 'react';
import { Download, FlaskConical } from 'lucide-react';

export type NavView = 'workspace' | 'structure' | 'protocol' | 'comparative' | 'simulation' | 'analytics' | 'diagnostics';

interface TopBarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  onOpenExport: () => void;
  systemName: string;
  activeEngine: 'gromacs' | 'lammps' | 'comparative';
  onSelectEngine: (engine: 'gromacs' | 'lammps') => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  onSelectView,
  onOpenExport,
  systemName,
  activeEngine,
  onSelectEngine,
}) => {
  const navItems: { id: NavView; label: string }[] = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'structure', label: '3D Structure' },
    { id: 'protocol', label: 'Protocol' },
    { id: 'comparative', label: 'Comparative (GMX vs LMP)' },
    { id: 'simulation', label: 'Real-Time MD' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'diagnostics', label: 'Diagnostics' },
  ];

  return (
    <header className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-[#07090E]/95 backdrop-blur-md sticky top-0 z-40">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3">
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); onSelectView('workspace'); }}
          className="text-base font-bold font-mono tracking-tight text-white hover:text-cyan-400 transition-colors"
        >
          MD Studio
        </a>
        <span className="hidden sm:inline text-xs font-mono text-slate-500">
          · GROMACS & LAMMPS Suite
        </span>
      </div>

      {/* Zone 2: Clean text navigation links with active state */}
      <nav className="hidden md:flex items-center gap-5 text-xs font-mono">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectView(item.id)}
            className={`transition-colors whitespace-nowrap py-1 ${
              currentView === item.id
                ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Zone 3: 1-2 primary actions */}
      <div className="flex items-center gap-3 font-mono">
        {/* Engine switcher quick toggle */}
        <div className="hidden sm:flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px]">
          <button
            onClick={() => onSelectEngine('gromacs')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeEngine === 'gromacs'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            GROMACS
          </button>
          <button
            onClick={() => onSelectEngine('lammps')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeEngine === 'lammps'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            LAMMPS
          </button>
        </div>

        <button
          onClick={onOpenExport}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Package</span>
        </button>
      </div>
    </header>
  );
};
