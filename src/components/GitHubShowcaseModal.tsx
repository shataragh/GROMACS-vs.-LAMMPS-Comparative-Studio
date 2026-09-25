import React, { useState } from 'react';
import { Check, Copy, Download, Github, Image as ImageIcon, X } from 'lucide-react';

interface GitHubShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
}

export const GitHubShowcaseModal: React.FC<GitHubShowcaseModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
}) => {
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  if (!isOpen) return null;

  const markdownSnippet = `# GMX & LAMMPS Molecular Dynamics Studio

> Interactive browser suite for high-performance biomolecular and materials simulations with drag-and-drop workspace ingestion, 3D structure inspection, dual-engine protocol translation, and real-time physics integration.

![MD Studio Banner](${imageSrc})

## Features
- **Dual-Engine Support**: Seamlessly configure and cross-compile simulations for **GROMACS** (proteins, membranes, nucleic acids) and **LAMMPS** (alloys, crystals, graphene, polymers).
- **Drag-and-Drop Ingestion**: Ingest \`.pdb\`, \`.gro\`, \`.top\`, \`.mdp\`, \`.xvg\`, \`data.*\`, \`in.*\`, \`log.lammps\`, or \`.zip\` archives.
- **3D Molecular Graphics**: Ribbon cartoons, ball-and-stick, CPK spacefill, distance ruler, and periodic box wireframes.
- **Side-by-Side Comparative Studio**: Direct syntax translation, unit conversion (kJ/mol $\\leftrightarrow$ kcal/mol $\\leftrightarrow$ eV), and domain recommendation matrix.
- **Live In-Browser MD**: Numerical Velocity-Verlet physics engine with interactive thermostat controls.
- **Analytics & Diagnostics**: Interactive RMSD, RMSF, Rg, and Ramachandran plots with instant cross-engine error resolution.
`;

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdownSnippet);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const handleDownloadImage = () => {
    const a = document.createElement('a');
    a.href = imageSrc;
    a.download = 'md_studio_github_banner.jpg';
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-xl border border-slate-800 bg-[#0B0F19] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <Github className="w-5 h-5 text-white" />
            <div>
              <h3 className="text-sm font-semibold text-white font-mono">
                GitHub Project Banner & Social Preview
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                High-resolution 16:9 banner ready for README.md and repository social preview
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#07090E]">
          {/* Image Preview Container with fallback */}
          <div className="relative rounded-xl overflow-hidden border border-slate-800 group shadow-lg bg-slate-950">
            <img
              src={imageSrc}
              alt="GMX and LAMMPS Molecular Dynamics Studio GitHub Banner"
              referrerPolicy="no-referrer"
              className="w-full h-auto object-cover max-h-[360px] block"
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-90 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleDownloadImage}
                className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-900 text-cyan-300 text-xs font-mono font-semibold rounded-lg border border-cyan-500/40 backdrop-blur-md flex items-center gap-1.5 shadow-md transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Image (16:9 HD)</span>
              </button>
            </div>
          </div>

          {/* GitHub README Markdown Snippet */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
                Ready-to-Paste README.md Template
              </span>
              <button
                onClick={handleCopyMarkdown}
                className="px-3 py-1 text-xs font-mono text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                {copiedMarkdown ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-400" />
                    <span>Copy Markdown</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 max-h-40 overflow-y-auto leading-relaxed">
              <pre className="whitespace-pre-wrap">{markdownSnippet}</pre>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <span className="text-xs font-mono text-slate-400">
            Resolution: 1920 × 1080 (16:9) · High-Fidelity Render
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-mono text-slate-300 hover:text-white transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleDownloadImage}
              className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg font-mono flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save Image</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
