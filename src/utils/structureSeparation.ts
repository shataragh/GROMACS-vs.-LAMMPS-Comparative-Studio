import { Atom, MoleculeStructure, Residue } from '../types/gromacs';
import { parsePDB } from './pdbParser';

export const SOLVENT_AND_BUFFER_RESIDUES = new Set([
  'HOH', 'WAT', 'TIP3', 'SOL', 'NA', 'CL', 'K', 'MG', 'ZN', 'CA', 'FE', 'MN', 'IOD', 'BR',
  'SO4', 'PO4', 'ACT', 'EDO', 'DMS', 'GOL', 'PEG', 'PG4', 'MPD', 'BME', 'TRS', 'FMT', 'CIT'
]);

export interface ChainProfile {
  chainID: string;
  type: 'protein' | 'nucleic' | 'other';
  numResidues: number;
  numAtoms: number;
  firstResSeq: number;
  lastResSeq: number;
  meanBfactor: number;
  boundLigands: string[];
  hasLigandContact: boolean;
  favorableScore: number;
  isFavorable: boolean;
  favorableReason?: string;
  residues: Residue[];
}

export interface LigandProfile {
  key: string; // e.g. "A_501_N3"
  resName: string;
  resSeq: number;
  chainID: string;
  atomCount: number;
  formula: string;
  center: [number, number, number];
  contactChains: string[];
  isSolventOrIon: boolean;
  isPrimaryDrug: boolean;
  atoms: Atom[];
}

export interface SeparationAnalysis {
  chains: ChainProfile[];
  ligands: LigandProfile[];
  favorableChainID: string;
  favorableLigandResName: string | null;
  summaryRecommendation: string;
}

/**
 * Analyzes a MoleculeStructure to identify all chains and ligands,
 * scoring them to automatically determine the most favorable chain and active ligand.
 */
export function analyzeChainsAndLigands(structure: MoleculeStructure): SeparationAnalysis {
  const chainMap = new Map<string, {
    atoms: Atom[];
    residues: Residue[];
    bFactorSum: number;
  }>();

  // Initialize chain buckets
  for (const c of structure.chains) {
    chainMap.set(c, { atoms: [], residues: [], bFactorSum: 0 });
  }

  // Populate atoms and residues
  for (const atom of structure.atoms) {
    const chainID = atom.chainID || 'A';
    if (!chainMap.has(chainID)) {
      chainMap.set(chainID, { atoms: [], residues: [], bFactorSum: 0 });
    }
    const bucket = chainMap.get(chainID)!;
    bucket.atoms.push(atom);
    bucket.bFactorSum += atom.tempFactor || 0;
  }

  for (const res of structure.residues) {
    const chainID = res.chain || 'A';
    const bucket = chainMap.get(chainID);
    if (bucket) {
      bucket.residues.push(res);
    }
  }

  // Identify ligands (heteroatoms with >= 3 atoms, or non-solvents)
  const ligandMap = new Map<string, {
    resName: string;
    resSeq: number;
    chainID: string;
    atoms: Atom[];
  }>();

  for (const atom of structure.atoms) {
    if (atom.isLigand || (!SOLVENT_AND_BUFFER_RESIDUES.has(atom.resName) && !isStandardAminoAcid(atom.resName))) {
      const key = `${atom.chainID}_${atom.resSeq}_${atom.resName}`;
      if (!ligandMap.has(key)) {
        ligandMap.set(key, {
          resName: atom.resName,
          resSeq: atom.resSeq,
          chainID: atom.chainID,
          atoms: [],
        });
      }
      ligandMap.get(key)!.atoms.push(atom);
    }
  }

  // Build ligand profiles
  const ligands: LigandProfile[] = [];
  for (const [key, ligData] of ligandMap.entries()) {
    if (ligData.atoms.length === 0) continue;

    const isSolvent = SOLVENT_AND_BUFFER_RESIDUES.has(ligData.resName) || ['HOH', 'WAT'].includes(ligData.resName);
    let cx = 0, cy = 0, cz = 0;
    const elementCounts: Record<string, number> = {};

    for (const a of ligData.atoms) {
      cx += a.x;
      cy += a.y;
      cz += a.z;
      const el = a.element || 'C';
      elementCounts[el] = (elementCounts[el] || 0) + 1;
    }

    const n = ligData.atoms.length;
    cx /= n;
    cy /= n;
    cz /= n;

    // Formula representation (Hill system order: C, H, then alphabetical)
    const formulaParts: string[] = [];
    if (elementCounts['C']) {
      formulaParts.push(`C${elementCounts['C'] > 1 ? elementCounts['C'] : ''}`);
      delete elementCounts['C'];
    }
    if (elementCounts['H']) {
      formulaParts.push(`H${elementCounts['H'] > 1 ? elementCounts['H'] : ''}`);
      delete elementCounts['H'];
    }
    for (const el of Object.keys(elementCounts).sort()) {
      formulaParts.push(`${el}${elementCounts[el] > 1 ? elementCounts[el] : ''}`);
    }

    // Check contact with chains (within 4.5 Å)
    const contactChains = new Set<string>();
    for (const a of ligData.atoms) {
      if (a.element === 'H') continue;
      for (const [chainID, cBucket] of chainMap.entries()) {
        if (contactChains.has(chainID)) continue;
        for (const pAtom of cBucket.atoms) {
          if (pAtom.isLigand || pAtom.element === 'H') continue;
          const d = Math.hypot(a.x - pAtom.x, a.y - pAtom.y, a.z - pAtom.z);
          if (d <= 4.5) {
            contactChains.add(chainID);
            break;
          }
        }
      }
    }

    // Primary drug is non-solvent, has >= 5 heavy atoms, or interacts with protein
    const isPrimaryDrug = !isSolvent && ligData.atoms.length >= 4 && contactChains.size > 0;

    ligands.push({
      key,
      resName: ligData.resName,
      resSeq: ligData.resSeq,
      chainID: ligData.chainID,
      atomCount: ligData.atoms.length,
      formula: formulaParts.join(' ') || ligData.resName,
      center: [Math.round(cx * 10) / 10, Math.round(cy * 10) / 10, Math.round(cz * 10) / 10],
      contactChains: Array.from(contactChains),
      isSolventOrIon: isSolvent,
      isPrimaryDrug,
      atoms: ligData.atoms,
    });
  }

  // Sort ligands so primary bioactive drug candidates appear first
  ligands.sort((a, b) => {
    if (a.isPrimaryDrug && !b.isPrimaryDrug) return -1;
    if (!a.isPrimaryDrug && b.isPrimaryDrug) return 1;
    return b.atomCount - a.atomCount;
  });

  const primaryDrug = ligands.find(l => l.isPrimaryDrug);

  // Build chain profiles and compute Favorable Chain Score
  const chains: ChainProfile[] = [];
  let highestScore = -Infinity;
  let favorableChainID = structure.chains[0] || 'A';

  for (const [chainID, data] of chainMap.entries()) {
    const proteinResidues = data.residues.filter(r => !r.isLigand && !SOLVENT_AND_BUFFER_RESIDUES.has(r.name));
    const numRes = proteinResidues.length;
    const numAtoms = data.atoms.filter(a => !a.isLigand && !SOLVENT_AND_BUFFER_RESIDUES.has(a.resName)).length;

    if (numAtoms === 0 && numRes === 0) continue;

    const firstResSeq = proteinResidues[0]?.seq ?? 1;
    const lastResSeq = proteinResidues[proteinResidues.length - 1]?.seq ?? numRes;
    const meanBfactor = data.atoms.length > 0 ? Math.round((data.bFactorSum / data.atoms.length) * 10) / 10 : 30;

    // Ligands contacting this chain
    const boundLigands = ligands
      .filter(l => l.contactChains.includes(chainID) && !l.isSolventOrIon)
      .map(l => l.resName);

    // Heuristic score for Favorable Chain:
    // 1. Contact with primary bioactive drug / inhibitor (+60)
    // 2. High residue completeness (up to +30)
    // 3. Low B-factor (crystallographic thermal stability / quality) (up to +20)
    // 4. Chain A priority (+5)
    let score = 0;
    if (primaryDrug && primaryDrug.contactChains.includes(chainID)) {
      score += 60;
    } else if (boundLigands.length > 0) {
      score += 35;
    }

    score += Math.min(30, numRes * 0.1);
    if (meanBfactor > 0) {
      score += Math.max(0, 30 - meanBfactor * 0.5);
    }
    if (chainID === 'A') score += 5;

    if (score > highestScore) {
      highestScore = score;
      favorableChainID = chainID;
    }

    chains.push({
      chainID,
      type: 'protein',
      numResidues: numRes,
      numAtoms,
      firstResSeq,
      lastResSeq,
      meanBfactor,
      boundLigands: Array.from(new Set(boundLigands)),
      hasLigandContact: boundLigands.length > 0,
      favorableScore: Math.round(score),
      isFavorable: false,
      residues: proteinResidues,
    });
  }

  // Mark the favorable chain and explain reason
  for (const c of chains) {
    if (c.chainID === favorableChainID) {
      c.isFavorable = true;
      const ligNote = c.boundLigands.length > 0 ? `bound to ligand ${c.boundLigands.join(', ')}` : 'primary catalytic polymer';
      c.favorableReason = `Chain ${c.chainID}: ${ligNote}, ${c.numResidues} residues (span ${c.firstResSeq}-${c.lastResSeq}), mean B-factor ${c.meanBfactor} Å²`;
    }
  }

  // Summary recommendation
  const favChain = chains.find(c => c.isFavorable);
  const summaryRecommendation = favChain
    ? `Chain ${favChain.chainID} is designated the Favorable Chain: ${favChain.favorableReason || ''}.`
    : 'Default Chain A selected as primary protein chain.';

  return {
    chains,
    ligands,
    favorableChainID,
    favorableLigandResName: primaryDrug?.resName || (ligands[0] && !ligands[0].isSolventOrIon ? ligands[0].resName : null),
    summaryRecommendation,
  };
}

function isStandardAminoAcid(res: string): boolean {
  const std = new Set([
    'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'HSE', 'HSD', 'HSP',
    'ILE', 'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL', 'SEC', 'PYL'
  ]);
  return std.has(res);
}

export interface SeparationOptions {
  selectedChainIDs: string[]; // e.g. ['A']
  selectedLigandKeys: string[]; // e.g. ['A_501_N3']
  includeSolvent?: boolean;
  includeIons?: boolean;
  separationMode: 'favorable_complex' | 'chain_only' | 'ligand_only' | 'split_both' | 'all' | 'custom';
}

export interface SeparatedSystemResult {
  complexStructure: MoleculeStructure;
  complexPdbText: string;
  receptorPdbText: string;
  ligandPdbText: string;
  receptorFilename: string;
  ligandFilename: string;
  complexFilename: string;
  activeChainID: string;
  activeLigandName?: string;
  stats: {
    totalAtoms: number;
    proteinAtoms: number;
    ligandAtoms: number;
    residueCount: number;
    removedAtoms: number;
  };
}

/**
 * Executes separation of the favorable chain from the protein and ligand,
 * generating clean coordinates, PDB text files, and updated MoleculeStructure.
 */
export function executeStructureSeparation(
  originalStructure: MoleculeStructure,
  options: SeparationOptions
): SeparatedSystemResult {
  const analysis = analyzeChainsAndLigands(originalStructure);
  const prefix = originalStructure.pdbId || originalStructure.name.replace(/[^a-zA-Z0-9_-]/g, '_');

  const chosenChainIDs = new Set(
    options.selectedChainIDs.length > 0 ? options.selectedChainIDs : [analysis.favorableChainID]
  );
  const chosenLigandKeys = new Set(options.selectedLigandKeys);

  // If favorable complex mode, ensure primary drug ligand is included
  if (options.separationMode === 'favorable_complex') {
    const primaryDrug = analysis.ligands.find(l => l.isPrimaryDrug);
    if (primaryDrug) {
      chosenLigandKeys.add(primaryDrug.key);
    }
  }

  // Filter atoms for Receptor, Ligand, and Complex
  const receptorAtoms: Atom[] = [];
  const ligandAtoms: Atom[] = [];
  const complexAtoms: Atom[] = [];

  for (const atom of originalStructure.atoms) {
    const isSolvent = SOLVENT_AND_BUFFER_RESIDUES.has(atom.resName);
    const ligKey = `${atom.chainID}_${atom.resSeq}_${atom.resName}`;
    const isTargetLigand = chosenLigandKeys.has(ligKey) || (options.separationMode === 'all' && atom.isLigand);

    // Ligand atoms collection
    if (isTargetLigand && (!isSolvent || options.includeSolvent)) {
      ligandAtoms.push(atom);
    }

    // Receptor protein atoms collection (must belong to chosen chains and not be ligand/solvent)
    if (chosenChainIDs.has(atom.chainID) && !atom.isLigand && !isSolvent) {
      receptorAtoms.push(atom);
    }
  }

  // Determine what atoms compose the active complexStructure based on separationMode
  if (options.separationMode === 'chain_only') {
    complexAtoms.push(...receptorAtoms);
  } else if (options.separationMode === 'ligand_only') {
    complexAtoms.push(...ligandAtoms);
  } else {
    // favorable_complex, split_both, custom, all
    complexAtoms.push(...receptorAtoms, ...ligandAtoms);
  }

  // Generate PDB text for Receptor
  const receptorPdbText = buildPdbString(
    receptorAtoms,
    `${prefix} Receptor Chain ${Array.from(chosenChainIDs).join('+')}`,
    originalStructure.box
  );

  // Generate PDB text for Ligand
  const ligandPdbText = buildPdbString(
    ligandAtoms,
    `${prefix} Extracted Ligand(s)`,
    undefined,
    true
  );

  // Generate PDB text for Complex
  const complexPdbText = buildPdbString(
    complexAtoms,
    `${prefix} Separated System (${Array.from(chosenChainIDs).join('+')})`,
    originalStructure.box
  );

  // Re-parse complexStructure from the generated complex PDB text for pristine consistency
  const activeChainID = Array.from(chosenChainIDs)[0] || 'A';
  const primaryLigand = analysis.ligands.find(l => chosenLigandKeys.has(l.key)) || analysis.ligands[0];
  const activeLigandName = primaryLigand?.resName;

  const complexFilename = `${prefix}_separated_${activeChainID}${activeLigandName ? `_${activeLigandName}` : ''}.pdb`;
  const complexStructure = parsePDB(complexPdbText, complexFilename);

  // Carry over metadata
  complexStructure.pdbId = originalStructure.pdbId;
  complexStructure.rawPdbText = complexPdbText;
  complexStructure.pdbMetadata = originalStructure.pdbMetadata;
  complexStructure.dockingScore = originalStructure.dockingScore;
  complexStructure.cavityInfo = originalStructure.cavityInfo;
  complexStructure.name = `${originalStructure.name} [Chain ${activeChainID}${activeLigandName ? ` + ${activeLigandName}` : ''}]`;

  const receptorFilename = `${prefix}_chain${activeChainID}_receptor.pdb`;
  const ligandFilename = `${prefix}_ligand_${activeLigandName || 'mol'}.pdb`;

  const removedAtoms = originalStructure.atoms.length - complexAtoms.length;

  return {
    complexStructure,
    complexPdbText,
    receptorPdbText,
    ligandPdbText,
    receptorFilename,
    ligandFilename,
    complexFilename,
    activeChainID,
    activeLigandName,
    stats: {
      totalAtoms: complexAtoms.length,
      proteinAtoms: receptorAtoms.length,
      ligandAtoms: ligandAtoms.length,
      residueCount: complexStructure.residues.length,
      removedAtoms,
    },
  };
}

function buildPdbString(
  atoms: Atom[],
  title: string,
  box?: { x: number; y: number; z: number },
  forceHetatm = false
): string {
  const lines: string[] = [];
  lines.push(`REMARK 220 MD STUDIO - SEPARATED STRUCTURE`.padEnd(80, ' '));
  lines.push(`TITLE     ${title.slice(0, 70)}`);

  if (box && box.x > 0) {
    lines.push(
      `CRYST1${box.x.toFixed(3).padStart(9, ' ')}${box.y.toFixed(3).padStart(9, ' ')}${box.z.toFixed(3).padStart(9, ' ')}  90.00  90.00  90.00 P 1           1`
    );
  }

  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    const recType = (forceHetatm || a.isLigand) ? 'HETATM' : 'ATOM  ';
    const atomNum = (i + 1).toString().padStart(5, ' ');
    const atomName = a.name.length < 4 ? ` ${a.name.padEnd(3, ' ')}` : a.name.slice(0, 4);
    const resName = a.resName.padEnd(3, ' ').slice(0, 3);
    const chain = (a.chainID || 'A').slice(0, 1);
    const resSeq = (a.resSeq || 1).toString().padStart(4, ' ');
    const x = a.x.toFixed(3).padStart(8, ' ');
    const y = a.y.toFixed(3).padStart(8, ' ');
    const z = a.z.toFixed(3).padStart(8, ' ');
    const occ = (a.occupancy ?? 1.0).toFixed(2).padStart(6, ' ');
    const temp = (a.tempFactor ?? 20.0).toFixed(2).padStart(6, ' ');
    const elem = (a.element || a.name.slice(0, 1)).padStart(2, ' ');

    lines.push(
      `${recType}${atomNum} ${atomName} ${resName} ${chain}${resSeq}    ${x}${y}${z}${occ}${temp}          ${elem}`
    );
  }

  lines.push('TER');
  lines.push('END');
  return lines.join('\n');
}
