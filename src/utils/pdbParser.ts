import { Atom, MoleculeStructure, Residue } from '../types/gromacs';

// Standard amino acid standard charges at pH 7.0
const AMINO_ACID_CHARGES: Record<string, number> = {
  ARG: 1,
  LYS: 1,
  HIS: 0.1,
  ASP: -1,
  GLU: -1,
  // Terminal residues typically add +1 (N-term) and -1 (C-term)
};

export function parsePDB(content: string, filename = 'molecule.pdb'): MoleculeStructure {
  const lines = content.split('\n');
  const atoms: Atom[] = [];
  const residueMap = new Map<string, Residue>();
  const chains = new Set<string>();

  let boxX = 0;
  let boxY = 0;
  let boxZ = 0;

  for (const line of lines) {
    if (line.startsWith('CRYST1')) {
      const a = parseFloat(line.substring(6, 15).trim());
      const b = parseFloat(line.substring(15, 24).trim());
      const c = parseFloat(line.substring(24, 33).trim());
      if (!isNaN(a) && !isNaN(b) && !isNaN(c)) {
        boxX = a;
        boxY = b;
        boxZ = c;
      }
    } else if (line.startsWith('ATOM  ') || line.startsWith('HETATM')) {
      const id = parseInt(line.substring(6, 11).trim(), 10) || atoms.length + 1;
      const name = line.substring(12, 16).trim();
      const resName = line.substring(17, 20).trim();
      const chainID = line.substring(21, 22).trim() || 'A';
      const resSeq = parseInt(line.substring(22, 26).trim(), 10) || 1;
      const x = parseFloat(line.substring(30, 38).trim());
      const y = parseFloat(line.substring(38, 46).trim());
      const z = parseFloat(line.substring(46, 54).trim());
      const occupancy = parseFloat(line.substring(54, 60).trim()) || 1.0;
      const tempFactor = parseFloat(line.substring(60, 66).trim()) || 0.0;
      
      let element = line.substring(76, 78).trim().toUpperCase();
      if (!element) {
        // Infer from atom name
        const cleanName = name.replace(/[0-9]/g, '');
        element = cleanName.charAt(0);
        if (cleanName.startsWith('CL')) element = 'CL';
        else if (cleanName.startsWith('NA')) element = 'NA';
        else if (cleanName.startsWith('FE')) element = 'FE';
        else if (cleanName.startsWith('MG')) element = 'MG';
        else if (cleanName.startsWith('ZN')) element = 'ZN';
      }

      if (isNaN(x) || isNaN(y) || isNaN(z)) continue;

      const isBackbone = ['N', 'CA', 'C', 'O'].includes(name);

      const atom: Atom = {
        id,
        name,
        resName,
        resSeq,
        chainID,
        x,
        y,
        z,
        occupancy,
        tempFactor,
        element: element || 'C',
        isBackbone,
      };

      atoms.push(atom);
      chains.add(chainID);

      const resKey = `${chainID}_${resSeq}_${resName}`;
      if (!residueMap.has(resKey)) {
        residueMap.set(resKey, {
          seq: resSeq,
          name: resName,
          chain: chainID,
          atoms: [],
        });
      }
      residueMap.get(resKey)!.atoms.push(atom);
    }
  }

  const residues = Array.from(residueMap.values()).sort((a, b) => a.seq - b.seq);

  // Assign approximate secondary structures based on CA distances / geometry
  assignSecondaryStructure(residues);

  // Calculate system bounding box if CRYST1 was absent
  if (boxX === 0 && atoms.length > 0) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const a of atoms) {
      if (a.x < minX) minX = a.x;
      if (a.x > maxX) maxX = a.x;
      if (a.y < minY) minY = a.y;
      if (a.y > maxY) maxY = a.y;
      if (a.z < minZ) minZ = a.z;
      if (a.z > maxZ) maxZ = a.z;
    }
    // Add 20 Å buffer for standard GROMACS 1.0 nm margin
    boxX = Math.round((maxX - minX + 20) * 10) / 10;
    boxY = Math.round((maxY - minY + 20) * 10) / 10;
    boxZ = Math.round((maxZ - minZ + 20) * 10) / 10;
  }

  // Calculate estimated total charge
  let totalCharge = 0;
  for (const r of residues) {
    if (AMINO_ACID_CHARGES[r.name] !== undefined) {
      totalCharge += AMINO_ACID_CHARGES[r.name];
    }
  }
  // Round to nearest integer (due to Histidine fraction)
  totalCharge = Math.round(totalCharge);

  const massApprox = Math.round((atoms.length * 13.5) / 100) / 10; // Approx average atomic weight per Da

  return {
    name: filename.replace(/\.[^/.]+$/, ''),
    filename,
    atoms,
    residues,
    chains: Array.from(chains),
    box: {
      x: boxX,
      y: boxY,
      z: boxZ,
      type: 'cubic',
    },
    totalCharge,
    numAtoms: atoms.length,
    numResidues: residues.length,
    massApprox,
  };
}

export function parseGRO(content: string, filename = 'molecule.gro'): MoleculeStructure {
  const lines = content.trim().split('\n');
  if (lines.length < 3) {
    throw new Error('Invalid GRO file: File too short');
  }

  const title = lines[0].trim();
  const numAtomsDeclared = parseInt(lines[1].trim(), 10);
  const atoms: Atom[] = [];
  const residueMap = new Map<string, Residue>();
  const chains = new Set<string>(['A']);

  for (let i = 2; i < lines.length - 1; i++) {
    const line = lines[i];
    if (line.length < 30) continue;

    // GRO fixed columns:
    // 0-4: residue number (5 chars)
    // 5-9: residue name (5 chars)
    // 10-14: atom name (5 chars)
    // 15-19: atom number (5 chars)
    // 20-27: x in nm (8 chars, 3 decimals)
    // 28-35: y in nm
    // 36-43: z in nm
    const resSeq = parseInt(line.substring(0, 5).trim(), 10) || 1;
    const resName = line.substring(5, 10).trim();
    const name = line.substring(10, 15).trim();
    const id = parseInt(line.substring(15, 20).trim(), 10) || atoms.length + 1;
    
    // GRO is in nanometers, convert to Angstroms (*10) for standard 3D viewer
    const xNm = parseFloat(line.substring(20, 28).trim());
    const yNm = parseFloat(line.substring(28, 36).trim());
    const zNm = parseFloat(line.substring(36, 44).trim());

    if (isNaN(xNm) || isNaN(yNm) || isNaN(zNm)) continue;

    const x = xNm * 10;
    const y = yNm * 10;
    const z = zNm * 10;

    let element = name.replace(/[0-9]/g, '').charAt(0).toUpperCase();
    if (name.startsWith('CL')) element = 'CL';
    else if (name.startsWith('NA')) element = 'NA';
    else if (name.startsWith('MG')) element = 'MG';

    const isBackbone = ['N', 'CA', 'C', 'O'].includes(name);

    const atom: Atom = {
      id,
      name,
      resName,
      resSeq,
      chainID: 'A',
      x,
      y,
      z,
      element: element || 'C',
      isBackbone,
    };

    atoms.push(atom);

    const resKey = `A_${resSeq}_${resName}`;
    if (!residueMap.has(resKey)) {
      residueMap.set(resKey, {
        seq: resSeq,
        name: resName,
        chain: 'A',
        atoms: [],
      });
    }
    residueMap.get(resKey)!.atoms.push(atom);
  }

  // Last line is box vectors (in nm)
  const boxLine = lines[lines.length - 1].trim().split(/\s+/);
  const boxX = boxLine[0] ? parseFloat(boxLine[0]) * 10 : 50;
  const boxY = boxLine[1] ? parseFloat(boxLine[1]) * 10 : 50;
  const boxZ = boxLine[2] ? parseFloat(boxLine[2]) * 10 : 50;

  const residues = Array.from(residueMap.values()).sort((a, b) => a.seq - b.seq);
  assignSecondaryStructure(residues);

  let totalCharge = 0;
  for (const r of residues) {
    if (AMINO_ACID_CHARGES[r.name] !== undefined) {
      totalCharge += AMINO_ACID_CHARGES[r.name];
    }
  }

  return {
    name: title || filename.replace(/\.[^/.]+$/, ''),
    filename,
    atoms,
    residues,
    chains: Array.from(chains),
    box: {
      x: boxX,
      y: boxY,
      z: boxZ,
      type: 'cubic',
    },
    totalCharge: Math.round(totalCharge),
    numAtoms: atoms.length,
    numResidues: residues.length,
    massApprox: Math.round((atoms.length * 13.5) / 100) / 10,
  };
}

function assignSecondaryStructure(residues: Residue[]): void {
  // Simple geometric heuristic using CA distances
  for (let i = 0; i < residues.length; i++) {
    const res = residues[i];
    const ca = res.atoms.find(a => a.name === 'CA');
    const caPlus3 = residues[i + 3]?.atoms.find(a => a.name === 'CA');
    const caPlus4 = residues[i + 4]?.atoms.find(a => a.name === 'CA');

    if (ca && caPlus4) {
      const dist = Math.sqrt(
        Math.pow(ca.x - caPlus4.x, 2) +
        Math.pow(ca.y - caPlus4.y, 2) +
        Math.pow(ca.z - caPlus4.z, 2)
      );
      // In an alpha-helix, CA(i) to CA(i+4) is typically ~5.0 - 6.2 Angstroms
      if (dist >= 4.8 && dist <= 6.5) {
        res.secondaryStructure = 'helix';
        continue;
      }
    }

    if (ca && caPlus3) {
      const dist = Math.sqrt(
        Math.pow(ca.x - caPlus3.x, 2) +
        Math.pow(ca.y - caPlus3.y, 2) +
        Math.pow(ca.z - caPlus3.z, 2)
      );
      if (dist >= 8.5 && dist <= 11.0) {
        res.secondaryStructure = 'sheet';
        continue;
      }
    }

    res.secondaryStructure = 'coil';
  }
}
